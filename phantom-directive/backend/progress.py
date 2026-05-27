import threading
import queue
from typing import Dict, List

_lock = threading.Lock()
_queues: Dict[int, List[queue.Queue]] = {}


def subscribe(project_id: int) -> queue.Queue:
    q: queue.Queue = queue.Queue()
    with _lock:
        _queues.setdefault(project_id, []).append(q)
    return q


def unsubscribe(project_id: int, q: queue.Queue):
    with _lock:
        lst = _queues.get(project_id, [])
        try:
            lst.remove(q)
        except ValueError:
            pass


def emit(project_id: int, step: str, message: str, done: bool = False):
    with _lock:
        qs = list(_queues.get(project_id, []))
    event = {"step": step, "message": message, "done": done}
    for q in qs:
        try:
            q.put_nowait(event)
        except Exception:
            pass
