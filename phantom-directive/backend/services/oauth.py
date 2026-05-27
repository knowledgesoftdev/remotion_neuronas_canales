import os
import json
from pathlib import Path

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

SCOPES = [
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]

REDIRECT_URI = "http://localhost:8000/analytics/oauth/callback"
TOKEN_FILE = Path(__file__).parent.parent / "youtube_token.json"

# El Flow se guarda en memoria entre /oauth/start y /oauth/callback
_active_flow: Flow | None = None


def _client_config() -> dict:
    return {
        "web": {
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI],
        }
    }


def get_auth_url() -> str:
    global _active_flow
    _active_flow = Flow.from_client_config(
        _client_config(), scopes=SCOPES, redirect_uri=REDIRECT_URI
    )
    url, _ = _active_flow.authorization_url(
        access_type="offline",
        prompt="consent",
    )
    return url


def exchange_code(code: str) -> Credentials:
    global _active_flow
    if _active_flow is None:
        raise ValueError("No hay flujo OAuth activo. Haz clic en 'Conectar CTR' primero.")
    _active_flow.fetch_token(code=code)
    creds = _active_flow.credentials
    _save_token(creds)
    _active_flow = None
    return creds


def load_credentials() -> Credentials | None:
    if not TOKEN_FILE.exists():
        return None
    data = json.loads(TOKEN_FILE.read_text())
    creds = Credentials(
        token=data["token"],
        refresh_token=data["refresh_token"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        scopes=SCOPES,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        _save_token(creds)
    return creds


def is_connected() -> bool:
    return TOKEN_FILE.exists()


def _save_token(creds: Credentials):
    TOKEN_FILE.write_text(json.dumps({
        "token": creds.token,
        "refresh_token": creds.refresh_token,
    }))
