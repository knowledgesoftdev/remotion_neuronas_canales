import os
from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from database import get_session
from models import Project, VideoMetrics

router = APIRouter()

PROJECTS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "projects")

STOP_WORDS = {
    'de','el','la','los','las','y','en','a','con','que','del','un','una',
    'es','al','lo','se','su','por','para','como','pero','o','ni','si',
    'más','ya','fue','son','era','este','esta','no','the','and','of',
}


@router.get("/", response_model=List[Project])
def list_projects(session: Session = Depends(get_session)):
    return session.exec(select(Project).order_by(Project.created_at.desc())).all()


@router.get("/neural-graph")
def neural_graph(session: Session = Depends(get_session)):
    projects = session.exec(select(Project).order_by(Project.created_at.asc())).all()

    metrics_map: dict = {}
    for m in session.exec(select(VideoMetrics)).all():
        if m.project_id is not None:
            existing = metrics_map.get(m.project_id)
            if existing is None or m.fetched_at > existing.fetched_at:
                metrics_map[m.project_id] = m

    nodes = []
    for p in projects:
        m = metrics_map.get(p.id)
        nodes.append({
            "id": p.id,
            "title": p.title,
            "topic": p.topic,
            "status": p.status,
            "mood": p.mood,
            "views": m.views if m else 0,
            "ctr": m.ctr if m else 0.0,
        })

    edges = []
    for i, a in enumerate(nodes):
        words_a = {w.lower().strip('.,;:¿?¡!') for w in a["topic"].split()
                   if w.lower() not in STOP_WORDS and len(w) > 2}
        for b in nodes[i + 1:]:
            words_b = {w.lower().strip('.,;:¿?¡!') for w in b["topic"].split()
                       if w.lower() not in STOP_WORDS and len(w) > 2}
            shared = words_a & words_b
            if shared:
                edges.append({"from": a["id"], "to": b["id"], "strength": len(shared)})
            elif a["mood"] and b["mood"] and a["mood"] == b["mood"]:
                edges.append({"from": a["id"], "to": b["id"], "strength": 1})

    return {"nodes": nodes, "edges": edges}


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
