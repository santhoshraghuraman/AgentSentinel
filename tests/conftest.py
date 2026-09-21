import os
from pathlib import Path

# Isolate automated tests from the live local database.
# Ensure test database has fresh tables matching all current models.
test_db_path = Path("test_agentsentinel.db")
if test_db_path.exists():
    try:
        test_db_path.unlink()
    except Exception:
        pass

os.environ["DATABASE_URL"] = "sqlite:///./test_agentsentinel.db"

from src.agentsentinel.db.database import Base, engine
import src.agentsentinel.db.models  # noqa: F401
Base.metadata.create_all(bind=engine)
