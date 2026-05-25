import os
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import Project

router = APIRouter()

PROJECTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "projects")


@router.get("/", response_model=List[Project])
def list_projects(session: Session = Depends(get_session)):
    return session.exec(select(Project).order_by(Project.created_at.desc())).all()


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/", response_model=Project)
def create_project(project: Project, session: Session = Depends(get_session)):
    folder_name = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{project.title[:30].replace(' ', '_')}"
    folder_path = os.path.join(PROJECTS_DIR, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    project.folder = folder_path
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    session.delete(project)
    session.commit()
    return {"ok": True}
