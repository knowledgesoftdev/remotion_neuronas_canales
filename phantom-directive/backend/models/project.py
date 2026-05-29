from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo
from sqlmodel import SQLModel, Field


def _now_lima() -> datetime:
    return datetime.now(ZoneInfo("America/Lima"))


class Project(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    topic: str
    status: str = "pending"  # pending | guion | audio | sync | visual | metadata | done
    mood: Optional[str] = None
    folder: Optional[str] = None
    youtube_video_id: Optional[str] = None
    created_at: datetime = Field(default_factory=_now_lima)
    updated_at: datetime = Field(default_factory=_now_lima)


class ChannelStats(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    fetched_at: datetime = Field(default_factory=_now_lima)
    total_views: int = 0
    total_videos: int = 0
    subscribers: int = 0
    avg_ctr: float = 0.0
    avg_retention: float = 0.0
    top_topics: str = "[]"   # JSON string
    top_styles: str = "[]"   # JSON string


class VideoMetrics(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    youtube_video_id: str
    title: str = ""
    views: int = 0
    likes: int = 0
    comments: int = 0
    ctr: float = 0.0
    impressions: int = 0
    avg_view_duration: float = 0.0
    avg_view_percentage: float = 0.0
    published_at: Optional[datetime] = Field(default=None)
    fetched_at: datetime = Field(default_factory=_now_lima)


class SuggestedTitle(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str
    topic: str
    reason: str = ""
    used: bool = False
    created_at: datetime = Field(default_factory=_now_lima)
