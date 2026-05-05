import logging
import httpx
import asyncio
from app.config.settings import (
    LLM_BASE_URL,
    LLM_MAX_RETRIES,
    LLM_MAX_TOKENS,
    LLM_REQUEST_TIMEOUT,
    LLM_TEMPERATURE,
    LLM_MODEL_NAME,
)

logger = logging.getLogger(__name__)

# max concurrent LLM calls — prevents overwhelming the server
MAX_CONCURRENT_LLM_CALLS = 3


class LLMClient:
    """Async client for the self-hosted LLM (Ollama)."""

    def __init__(self, base_url: str = LLM_BASE_URL) -> None:
        self.base_url = base_url.rstrip("/")
        self.endpoint = f"{self.base_url}/chat"
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_LLM_CALLS)

    async def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = LLM_TEMPERATURE,
        max_tokens: int = LLM_MAX_TOKENS,
    ):
        """Single LLM call with retry + exponential backoff.
        Respects concurrency limit via semaphore."""

        async with self._semaphore:
            payload = {
                "model": LLM_MODEL_NAME,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            }

            last_exception = None
            for attempt in range(LLM_MAX_RETRIES):
                try:
                    async with httpx.AsyncClient(
                        timeout=LLM_REQUEST_TIMEOUT,
                        verify=False
                    ) as client:
                        response = await client.post(
                            self.endpoint, json=payload
                        )
                        response.raise_for_status()
                        data = response.json()

                        content = data.get("message", {}).get("content", "")

                        logger.info(
                            f"LLM call succeeded (attempt {attempt + 1}, "
                            f"{len(content)} chars)"
                        )

                        return content

                except httpx.TimeoutException as e:
                    logger.warning(
                        f"LLM timeout (attempt {attempt + 1}): {e}"
                    )
                    last_exception = e
                except httpx.HTTPStatusError as e:
                    logger.warning(
                        f"LLM HTTP error (attempt {attempt + 1}): {e}"
                    )
                    last_exception = e
                except Exception as e:
                    logger.error(
                        f"LLM unexpected error (attempt {attempt + 1}): {e}"
                    )
                    last_exception = e

                if attempt < LLM_MAX_RETRIES - 1:
                    await asyncio.sleep(2 ** (attempt + 1))

            raise LLMConnectionError(
                f"LLM failed after {LLM_MAX_RETRIES} attempts: {last_exception}"
            )

    async def generate_with_retry_parse(
        self,
        system_prompt: str,
        user_prompt: str,
        parser_fn,
        correction_prompt_fn=None,
        max_parse_retries: int = 2,
        temperature: float = LLM_TEMPERATURE,
        max_tokens: int    = LLM_MAX_TOKENS,
    ):
        """Generate + parse. If parsing fails, retry with correction prompt
        that includes the malformed output."""

        raw_output = await self.generate(
            system_prompt=system_prompt, user_prompt=user_prompt
        )

        for parse_attempt in range(max_parse_retries):
            try:
                return parser_fn(raw_output)
            except ParseError as e:
                logger.warning(
                    f"Parse failed (attempt {parse_attempt + 1}): {e}"
                )
                if correction_prompt_fn and parse_attempt < max_parse_retries - 1:
                    corrected_prompt = correction_prompt_fn(
                        user_prompt, raw_output, str(e)
                    )
                    raw_output = await self.generate(
                        system_prompt=system_prompt,
                        user_prompt=corrected_prompt,
                        temperature   = temperature,   
                        max_tokens    = max_tokens, 
                    )
                else:
                    raise

        raise ParseError(f"Parse failed after {max_parse_retries} attempts")


class ParseError(Exception):
    pass


class LLMConnectionError(Exception):
    pass        