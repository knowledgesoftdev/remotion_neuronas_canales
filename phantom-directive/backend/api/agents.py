import os
import sys
import json
import queue
import asyncio
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from sqlmodel import Session
from database import get_session
from models import Project
from progress import subscribe, unsubscribe, emit

# backend/api/ → backend/ → phantom-directive/ → projects/
PROJECTS_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "projects"))

router = APIRouter()


def _get_project_or_404(project_id: int, session: Session) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return project


# ── SSE: progreso en vivo ────────────────────────────────────────────────────

@router.get("/{project_id}/progress")
async def progress_stream(project_id: int):
    q = subscribe(project_id)

    async def generate():
        loop = asyncio.get_event_loop()
        keepalive = 0
        try:
            while keepalive < 7200:   # max 1h (0.5s × 7200)
                try:
                    event = await loop.run_in_executor(None, lambda: q.get(timeout=0.5))
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("done"):
                        break
                    keepalive = 0
                except queue.Empty:
                    keepalive += 1
                    yield ": keepalive\n\n"
        finally:
            unsubscribe(project_id, q)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Pipeline completo ────────────────────────────────────────────────────────

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


# ── Agentes individuales ─────────────────────────────────────────────────────

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
        emit(project_id, "guion", "Claude is researching the topic...")
        _set_status(project_id, "guion")
        run_guion_agent(project_id, project.title, project.topic, project.folder, force=force)
        _set_status(project_id, "guion_done")
        emit(project_id, "guion_done", "Script completed and saved.")

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
        emit(project_id, "audio", "Fish Audio generating voice...")
        _set_status(project_id, "audio")
        run_audio_agent(project_id, project.folder, force=force)
        _set_status(project_id, "audio_done")
        emit(project_id, "audio_done", "Audio and Whisper complete.")

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
def save_script(project_id: int, body: dict, session: Session = Depends(get_session)):
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
        emit(project_id, "sync", "Analyzing timestamps with Whisper...")
        _set_status(project_id, "sync")
        run_sync_agent(project_id, project.folder)
        _set_status(project_id, "sync_done")
        emit(project_id, "sync_done", "sequences.ts and paragraphSlides.json ready.")

    background_tasks.add_task(_task)
    return {"status": "sync_started"}


@router.post("/{project_id}/pexels")
def run_pexels(
    project_id: int,
    background_tasks: BackgroundTasks,
    force: bool = False,
    session: Session = Depends(get_session),
):
    """Alias for /media — kept for backward compatibility."""
    project = _get_project_or_404(project_id, session)

    def _task():
        from agents.media import run as run_media_agent
        from agents.pipeline import _set_status
        emit(project_id, "pexels", "Collecting background media (Pexels + Wikipedia + SerpAPI)...")
        _set_status(project_id, "pexels")
        run_media_agent(project_id, project.folder, force=force)
        _set_status(project_id, "pexels_done")
        emit(project_id, "pexels_done", "Media assets collected. Manifest saved.")

    background_tasks.add_task(_task)
    return {"status": "media_started"}


@router.post("/{project_id}/media")
def run_media(
    project_id: int,
    background_tasks: BackgroundTasks,
    force: bool = False,
    session: Session = Depends(get_session),
):
    """
    Runs the unified MediaAgent:
    Pexels video → Pexels photo → Wikipedia → SerpAPI (in priority order).
    Writes media_manifest.json.
    """
    project = _get_project_or_404(project_id, session)

    def _task():
        from agents.media import run as run_media_agent
        from agents.pipeline import _set_status
        emit(project_id, "pexels", "Collecting background media (Pexels + Wikipedia + SerpAPI)...")
        _set_status(project_id, "pexels")
        try:
            run_media_agent(project_id, project.folder, force=force)
            _set_status(project_id, "pexels_done")
            emit(project_id, "pexels_done", "Media assets collected. Ready for Remotion.")
        except Exception as e:
            emit(project_id, "error", f"MediaAgent error: {e}")
            raise

    background_tasks.add_task(_task)
    return {"status": "media_started"}


@router.get("/{project_id}/pexels/manifest")
def get_pexels_manifest(project_id: int, session: Session = Depends(get_session)):
    """Returns media_manifest.json (or pexels_manifest.json) for a project."""
    project = _get_project_or_404(project_id, session)
    for fname in ("media_manifest.json", "pexels_manifest.json"):
        manifest_path = os.path.join(project.folder, fname)
        if os.path.exists(manifest_path):
            with open(manifest_path, encoding="utf-8") as f:
                return json.load(f)
    raise HTTPException(status_code=404, detail="No media manifest found. Run /media first.")


@router.get("/{project_id}/media/{file_path:path}")
def serve_project_media(project_id: int, file_path: str, session: Session = Depends(get_session)):
    """
    Serves media files (images/videos) from the project folder.
    Used by Remotion to load media assets as backgrounds.
    URL: /api/projects/{id}/media/media/SECTION/01_slug.mp4
    """
    project   = _get_project_or_404(project_id, session)
    full_path = os.path.normpath(os.path.join(project.folder, file_path))
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail=f"Media not found: {file_path}")

    # Determine MIME type
    ext = os.path.splitext(file_path)[1].lower()
    mime_map = {
        ".mp4": "video/mp4",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = mime_map.get(ext, "application/octet-stream")

    return FileResponse(
        full_path,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


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
        json_path = os.path.join(project.folder, "metadatos.json")
        if not force and os.path.exists(json_path):
            print("[MetadatosAgent] Already exists, skipping.")
            _set_status(project_id, "done")
            return
        emit(project_id, "metadata", "Claude generating titles, description, chapters and tags...")
        _set_status(project_id, "metadata")
        try:
            run_meta_agent(project_id, project.folder)
            _set_status(project_id, "done")
            emit(project_id, "done", "Metadata complete — titles, tags, thumbnail prompt ready.", done=True)
        except Exception as e:
            emit(project_id, "error", f"MetadatosAgent error: {e}")
            raise

    background_tasks.add_task(_task)
    return {"status": "metadatos_started"}


@router.get("/{project_id}/metadatos")
def get_metadatos(project_id: int, session: Session = Depends(get_session)):
    project   = _get_project_or_404(project_id, session)
    json_path = os.path.join(project.folder, "metadatos.json")
    txt_path  = os.path.join(project.folder, "metadatos.txt")
    mini_path = os.path.join(project.folder, "prompt_miniatura.txt")

    # Structured JSON (new format)
    structured = {}
    if os.path.exists(json_path):
        with open(json_path, encoding="utf-8") as f:
            structured = json.load(f)

    # Human-readable text (legacy + fallback)
    meta_txt = ""
    if os.path.exists(txt_path):
        with open(txt_path, encoding="utf-8") as f:
            meta_txt = f.read()

    # Thumbnail prompt (standalone file)
    mini_txt = structured.get("thumbnail_prompt", "")
    if not mini_txt and os.path.exists(mini_path):
        with open(mini_path, encoding="utf-8") as f:
            mini_txt = f.read()

    return {
        # Structured fields (arrays/strings — ready for frontend)
        "titles":           structured.get("titles", []),
        "description":      structured.get("description", ""),
        "chapters":         structured.get("chapters", []),
        "tags":             structured.get("tags", []),
        "hashtags":         structured.get("hashtags", []),
        "thumbnail_prompt": mini_txt,
        # Legacy text blob (for human review / copy-paste panel)
        "metadatos":        meta_txt,
        "prompt_miniatura": mini_txt,
    }


# ── Remotion: export + render ────────────────────────────────────────────────

@router.post("/{project_id}/export-remotion")
def export_to_remotion(project_id: int, session: Session = Depends(get_session)):
    import shutil
    project = _get_project_or_404(project_id, session)

    remotion_dir = os.environ.get("REMOTION_DIR", "")
    if not remotion_dir:
        raise HTTPException(status_code=500, detail="REMOTION_DIR no configurado en .env")

    required = ["audio.mp3", "sequences.ts", "paragraphSlides.json"]
    missing = [f for f in required if not os.path.exists(os.path.join(project.folder, f))]
    if missing:
        raise HTTPException(status_code=400, detail=f"Archivos faltantes: {', '.join(missing)}")

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


@router.post("/{project_id}/render-remotion")
def render_remotion(
    project_id: int,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
):
    project = _get_project_or_404(project_id, session)

    remotion_dir = os.environ.get("REMOTION_DIR", "")
    if not remotion_dir:
        raise HTTPException(status_code=500, detail="REMOTION_DIR no configurado en .env")

    def _render():
        import subprocess
        output_path = os.path.join(project.folder, "video.mp4")
        npx = "npx.cmd" if sys.platform == "win32" else "npx"
        emit(project_id, "render", "Starting Remotion render (this may take several minutes)...")
        result = subprocess.run(
            [npx, "remotion", "render", "MainVideo", output_path],
            cwd=remotion_dir,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            emit(project_id, "render_done", f"Video ready: {output_path}", done=True)
        else:
            err = result.stderr[-300:] if result.stderr else "Unknown error"
            emit(project_id, "render_error", f"Render error: {err}", done=True)

    background_tasks.add_task(_render)
    return {"status": "render_started"}


@router.get("/{project_id}/render-status")
def render_status(project_id: int, session: Session = Depends(get_session)):
    project = _get_project_or_404(project_id, session)
    video_path = os.path.join(project.folder, "video.mp4")
    exists = os.path.exists(video_path)
    size_mb = round(os.path.getsize(video_path) / (1024 * 1024), 1) if exists else 0
    return {"rendered": exists, "size_mb": size_mb}


# ── Analíticas ───────────────────────────────────────────────────────────────

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
