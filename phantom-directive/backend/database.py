from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

DATABASE_URL = "sqlite:///./neural_studio.db"

# StaticPool: una sola conexión reutilizada — ideal para SQLite en desarrollo.
# Evita "QueuePool limit reached" cuando el frontend hace polling frecuente.
engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

def create_db():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
