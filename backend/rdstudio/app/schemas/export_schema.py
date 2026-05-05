from typing import Literal
from pydantic import BaseModel


class ExportQueryParams(BaseModel):
    format: Literal["docx", "pdf"] = "docx"
