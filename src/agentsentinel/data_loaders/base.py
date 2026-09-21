from typing import Iterator
from src.agentsentinel.models.trajectory import Trajectory

class BaseDataLoader:
    """Base interface for all AgentSentinel data loaders."""
    
    def load(self) -> Iterator[Trajectory]:
        """
        Loads the dataset and yields Trajectory objects.
        Returns an Iterator to efficiently handle large datasets (e.g., jsonl).
        """
        raise NotImplementedError("Subclasses must implement the load method")
