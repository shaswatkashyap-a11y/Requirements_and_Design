from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.refinementRouter import router as refinement_router
from app.db.database import checkConnection
from app.routers.promptRouter import router as prompt_router
from app.routers.moduleRouter import router as module_router
from app.routers import *
from app.routers.exportRouter import router as export_router
from app.routers import designRouter, lldRouter

app = FastAPI(title="RDStudio", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:5174",  # <-- Ye tera naya entry pass hai
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----ROUTERS------
app.include_router(projectRouter.router, prefix="/api")
app.include_router(sowRouter.router, prefix="/api")
app.include_router(generationRouter.router, prefix="/api")
app.include_router(configRouter.router, prefix="/api")
app.include_router(refinement_router, prefix="/api")
app.include_router(prompt_router, prefix="/api")
app.include_router(module_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(designRouter.router, prefix="/api")
app.include_router(lldRouter.router, prefix="/api")
