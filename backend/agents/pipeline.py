from sqlmodel import Session
from database import engine
from models import Project
from datetime import datetime


def _set_status(project_id: int, status: str):
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if project:
            project.status = status
            project.updated_at = datetime.utcnow()
            session.add(project)
            session.commit()


def run_full_pipeline(project_id: int):
    from agents.guion import run as run_guion
    from agents.audio import run as run_audio
    from agents.sincronizacion import run as run_sync
    from agents.metadatos import run as run_metadatos

    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            return
        folder = project.folder
        title = project.title
        topic = project.topic

    steps = [
        ('guion',    lambda: run_guion(project_id, title, topic, folder)),
        ('audio',    lambda: run_audio(project_id, folder)),
        ('sync',     lambda: run_sync(project_id, folder)),
        ('metadata', lambda: run_metadatos(project_id, folder)),
    ]

    for status, fn in steps:
        _set_status(project_id, status)
        fn()

    _set_status(project_id, 'done')
