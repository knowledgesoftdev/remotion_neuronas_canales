from datetime import datetime
from zoneinfo import ZoneInfo
from sqlmodel import Session
from database import engine
from models import Project


def _now_lima() -> datetime:
    return datetime.now(ZoneInfo("America/Lima"))


def _set_status(project_id: int, status: str):
    with Session(engine) as session:
        project = session.get(Project, project_id)
        if project:
            project.status = status
            project.updated_at = _now_lima()
            session.add(project)
            session.commit()


def run_full_pipeline(project_id: int):
    from agents.guion          import run as run_guion
    from agents.audio          import run as run_audio
    from agents.sincronizacion import run as run_sync
    from agents.media          import run as run_media
    from agents.metadatos      import run as run_metadatos

    with Session(engine) as session:
        project = session.get(Project, project_id)
        if not project:
            return
        folder = project.folder
        title  = project.title
        topic  = project.topic

    steps = [
        ('guion',    lambda: run_guion(project_id, title, topic, folder)),
        ('audio',    lambda: run_audio(project_id, folder)),
        ('sync',     lambda: run_sync(project_id, folder)),
        ('pexels',   lambda: run_media(project_id, folder)),
        ('metadata', lambda: run_metadatos(project_id, folder)),
    ]

    for status, fn in steps:
        _set_status(project_id, status)
        fn()

    _set_status(project_id, 'done')
