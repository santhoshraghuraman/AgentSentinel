"""
Database Configuration (Milestone 10).

SQLAlchemy session and engine initialization.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Default to an in-memory SQLite database if no URL is provided.
# In a real deployment, this would be set to a PostgreSQL URL.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./agentsentinel.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency generator for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
