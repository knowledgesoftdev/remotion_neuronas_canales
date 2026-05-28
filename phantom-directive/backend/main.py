from dotenv import load_dotenv
load_dotenv()

import pathlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import create_db, migrate_db
from api.projects import router as projects_router
from api.analytics import router as analytics_router
from api.agents import router as agents_router

app = FastAPI(title="Neural Studio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:3001",   # Remotion Studio
        "http://localhost:3000",   # Remotion Studio (alt port)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Necesario para que Remotion pueda leer video range requests cross-origin
    expose_headers=["Content-Range", "Content-Length", "Accept-Ranges"],
)

app.include_router(projects_router, prefix="/projects", tags=["projects"])
app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
app.include_router(agents_router, prefix="/agents", tags=["agents"])


_PROJECTS_DIR = pathlib.Path(__file__).parent.parent / "projects"
if _PROJECTS_DIR.exists():
    app.mount("/files/projects", StaticFiles(directory=str(_PROJECTS_DIR)), name="projects_files")


@app.on_event("startup")
def on_startup():
    create_db()
    migrate_db()


@app.get("/")
def root():
    return {"status": "Neural Studio online"}
