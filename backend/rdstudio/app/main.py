from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import checkConnection

from app.routers import *


app = FastAPI(title="RDStudio", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----ROUTERS------
app.include_router(projectRouter.router, prefix="/api")
app.include_router(sowRouter.router, prefix="/api")
app.include_router(generationRouter.router, prefix="/api")
app.include_router(configRouter.router, prefix="/api")


