import os
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlmodel import Session
from database import get_session
from models import Project

router = APIRouter()


def _get_project_or_404(project_id: int, session: Session) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return project


@router.post("/{project_id}/run")
def run_pipeline(
    project_id: int,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    _get_project_or_404(project_id, session)
    from agents.pipeline import run_full_pipeline
    background_tasks.add_task(run_full_pipeline, project_id)
    return {"status": "pipeline_started", "project_id": project_id}


@router.post("/{project_id}/guion")
def run_guion(
    project_id: int,
    background_tasks: BackgroundTasks,
    force: bool = False,
    session: Session = Depends(get_session),
):
    project = _get_project_or_404(project_id, session)

    def _task():
        from agents.guion import run as run_guion_agent
        from agents.pipeline import _set_status
        _set_status(project_id, "guion")
        run_guion_agent(project_id, project.title, project.topic, project.folder, force=force)
        _set_status(project_id, "guion_done")

    background_tasks.add_task(_task)
    return {"status": "guion_started"}


@router.post("/{project_id}/audio")
def run_audio(
    project_id: int,
    background_tasks: BackgroundTasks,
    force: bool = False,
    session: Session = Depends(get_session),
):
    project = _get_project_or_404(project_id, session)

    def _task():
        from agents.audio import run as run_audio_agent
        from agents.pipeline import _set_status
        _set_status(project_id, "audio")
        run_audio_agent(project_id, project.folder, force=force)
        _set_status(project_id, "audio_done")

    background_tasks.add_task(_task)
    return {"status": "audio_started"}


@router.get("/{project_id}/audio/file")
def get_audio_file(project_id: int, session: Session = Depends(get_session)):
    from fastapi.responses import FileResponse
    project = _get_project_or_404(project_id, session)
    audio_path = os.path.join(project.folder, "audio.mp3")
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio no generado aún")
    return FileResponse(audio_path, media_type="audio/mpeg", filename="audio.mp3")


@router.get("/{project_id}/script")
def get_script(project_id: int, session: Session = Depends(get_session)):
    project = _get_project_or_404(project_id, session)
    full_path = os.path.join(project.folder, "full_script.txt")
    narration_path = os.path.join(project.folder, "narration.txt")

    full = ""
    narration = ""
    if os.path.exists(full_path):
        with open(full_path, encoding="utf-8") as f:
            full = f.read()
    if os.path.exists(narration_path):
        with open(narration_path, encoding="utf-8") as f:
            narration = f.read()

    return {"full_script": full, "narration": narration}


@router.put("/{project_id}/script")
def save_script(
    project_id: int,
    body: dict,
    session: Session = Depends(get_session),
):
    project = _get_project_or_404(project_id, session)
    narration_path = os.path.join(project.folder, "narration.txt")
    narration = body.get("narration", "")
    with open(narration_path, "w", encoding="utf-8") as f:
        f.write(narration)
    return {"ok": True}


@router.post("/{project_id}/sync")
def run_sync(
    project_id: int,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    project = _get_project_or_404(project_id, session)

    def _task():
        from agents.sincronizacion import run as run_sync_agent
        from agents.pipeline import _set_status
        _set_status(project_id, "sync")
        run_sync_agent(project_id, project.folder)
        _set_status(project_id, "sync_done")

    background_tasks.add_task(_task)
    return {"status": "sync_started"}


@router.post("/{project_id}/metadatos")
def run_metadatos(
    project_id: int,
    background_tasks: BackgroundTasks,
    force: bool = False,
    session: Session = Depends(get_session),
):
    project = _get_project_or_404(project_id, session)

    def _task():
        from agents.metadatos import run as run_meta_agent
        from agents.pipeline import _set_status
        meta_path = os.path.join(project.folder, "metadatos.txt")
        if not force and os.path.exists(meta_path):
            print("[MetadatosAgent] Ya existe, saltando.")
            _set_status(project_id, "done")
            return
        _set_status(project_id, "metadata")
        run_meta_agent(project_id, project.folder)
        _set_status(project_id, "done")

    background_tasks.add_task(_task)
    return {"status": "metadatos_started"}


@router.get("/{project_id}/metadatos")
def get_metadatos(project_id: int, session: Session = Depends(get_session)):
    project = _get_project_or_404(project_id, session)
    meta_path = os.path.join(project.folder, "metadatos.txt")
    mini_path = os.path.join(project.folder, "prompt_miniatura.txt")
    meta, mini = "", ""
    if os.path.exists(meta_path):
        with open(meta_path, encoding="utf-8") as f:
            meta = f.read()
    if os.path.exists(mini_path):
        with open(mini_path, encoding="utf-8") as f:
            mini = f.read()
    return {"metadatos": meta, "prompt_miniatura": mini}


@router.post("/{project_id}/export-remotion")
def export_to_remotion(project_id: int, session: Session = Depends(get_session)):
    import shutil
    project = _get_project_or_404(project_id, session)

    remotion_dir = os.environ.get("REMOTION_DIR", "")
    if not remotion_dir:
        raise HTTPException(status_code=500, detail="REMOTION_DIR no configurado en .env")

    # Verificar archivos de sync primero
    required = ["audio.mp3", "sequences.ts", "paragraphSlides.json"]
    missing = [f for f in required if not os.path.exists(os.path.join(project.folder, f))]
    if missing:
        raise HTTPException(status_code=400, detail=f"Archivos faltantes: {', '.join(missing)}")

    # Generar visual_data.json si no existe (llama a Claude la primera vez)
    visual_path = os.path.join(project.folder, "visual_data.json")
    if not os.path.exists(visual_path):
        from agents.visual import run as run_visual
        run_visual(project_id, project.folder)

    copies = [
        (os.path.join(project.folder, "audio.mp3"),           os.path.join(remotion_dir, "public", "audio.mp3")),
        (os.path.join(project.folder, "sequences.ts"),         os.path.join(remotion_dir, "src", "sequences.ts")),
        (os.path.join(project.folder, "paragraphSlides.json"), os.path.join(remotion_dir, "src", "paragraphSlides.json")),
        (os.path.join(project.folder, "visual_data.json"),     os.path.join(remotion_dir, "src", "visualData.json")),
    ]

    for src, dst in copies:
        if os.path.exists(src):
            shutil.copy2(src, dst)

    return {"ok": True, "url": "http://localhost:3001"}


@router.get("/suggest-titles")
def suggest_titles(session: Session = Depends(get_session)):
    from agents.analiticas import suggest_video_titles
    return suggest_video_titles(session)


@router.post("/suggestions/{suggestion_id}/use")
def use_suggestion(suggestion_id: int, session: Session = Depends(get_session)):
    from models import SuggestedTitle
    s = session.get(SuggestedTitle, suggestion_id)
    if s:
        s.used = True
        session.add(s)
        session.commit()
    return {"ok": True}


@router.get("/performance-alerts")
def performance_alerts(session: Session = Depends(get_session)):
    from agents.analiticas import check_performance_alerts
    return check_performance_alerts(session)


@router.post("/{project_id}/improve")
def improve_suggestions(project_id: int, session: Session = Depends(get_session)):
    from agents.analiticas import generate_improvement_suggestions
    return generate_improvement_suggestions(project_id, session)
