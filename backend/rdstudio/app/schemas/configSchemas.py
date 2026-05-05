from pydantic import BaseModel


class ServiceLineResponse(BaseModel):
    id: int
    name: str
    code: str
    icon: str | None

    class Config:
        from_attributes = True


class ServiceLineCategoryResponse(BaseModel):
    id: int
    name: str
    code: str
    service_lines: list[ServiceLineResponse]

    class Config:
        from_attributes = True


class MethodologyResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str | None

    class Config:
        from_attributes = True


class ServiceLineCreateResponse(BaseModel):
    id: int
    name: str
    code: str
    icon: str | None
    category_id: int
    extra_artifact_types: list[str] | None

    class Config:
        from_attributes = True


class MethodologyCreateResponse(BaseModel):
    id: int
    name: str
    code: str
    description: str | None
    artifact_types: list[str] | None

    class Config:
        from_attributes = True


class DeleteResponse(BaseModel):
    detail: str