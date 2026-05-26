from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db
from api.projects import router as projects_router
from api.analytics import router as analytics_router
from api.agents import router as agents_router

app = FastAPI(title="Neural Studio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router, prefix="/projects", tags=["projects"])
app.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
app.include_router(agents_router, prefix="/agents", tags=["agents"])


@app.on_event("startup")
def on_startup():
    create_db()


@app.get("/")
def root():
    return {"status": "Neural Studio online"}
