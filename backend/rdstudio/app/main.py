from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import checkConnection
import app.routers.projectRouter as projectRouter
import app.routers.sowRouter as sowRouter
import app.routers.generationRouter as generationRouter
import app.routers.configRouter as configRouter
import app.routers.refinementRouter as refinementRouter
import app.routers.promptRouter as promptRouter
import app.routers.moduleRouter as moduleRouter
import app.routers.exportRouter as exportRouter
import app.routers.designRouter as designRouter
import app.routers.lldRouter as lldRouter
app = FastAPI(title="RDStudio", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
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
app.include_router(refinementRouter.router, prefix="/api")
app.include_router(promptRouter.router, prefix="/api")
app.include_router(moduleRouter.router, prefix="/api")
app.include_router(exportRouter.router, prefix="/api")
app.include_router(designRouter.router, prefix="/api")
app.include_router(lldRouter.router, prefix="/api")
