from typing import Dict, Any
import pandas as pd

# In-memory store for prototype
# project_id -> { "df": DataFrame, "filename": str }
store: Dict[str, Dict[str, Any]] = {}

def get_project_data(project_id: str) -> pd.DataFrame:
    if project_id in store and "df" in store[project_id]:
        return store[project_id]["df"]
    return None

def set_project_data(project_id: str, df: pd.DataFrame, filename: str):
    if project_id not in store:
        store[project_id] = {}
    store[project_id]["df"] = df
    store[project_id]["filename"] = filename
