from sqlmodel import SQLModel, Session, create_engine
from typing import Generator

DATABASE_URL = "sqlite:///./vantage.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
