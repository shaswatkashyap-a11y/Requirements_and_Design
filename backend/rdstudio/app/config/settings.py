from dotenv import load_dotenv
import os

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:11434")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.3"))
LLM_MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", 4096))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "3"))
LLM_REQUEST_TIMEOUT = int(os.getenv("LLM_REQUEST_TIMEOUT", 180))
LLM_MODEL_NAME = os.getenv("LLM_MODEL_NAME","llama3.1:8b")
print(f"LLM_MODEL_NAME loaded as: {LLM_MODEL_NAME}")  # ← add this

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")

DATABASE_URL=os.getenv("DATABASE_URL","mysql+pymysql://root:Jade2025@localhost:3306/rdstudio")