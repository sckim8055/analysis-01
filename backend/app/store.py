from typing import Dict, Any
import pandas as pd

# In-memory store for prototype
# (project_id, session_id) -> { "df": DataFrame, "original_df": DataFrame, "filename": str }
store: Dict[str, Dict[str, Any]] = {}

def get_store_key(project_id: str, session_id: str) -> str:
    return f"{project_id}_{session_id}"

def get_project_data(project_id: str, session_id: str, original: bool = False) -> pd.DataFrame:
    key = get_store_key(project_id, session_id)
    if key in store:
        data_key = "original_df" if original else "df"
        if data_key in store[key]:
            return store[key][data_key]
    return None

def set_project_data(project_id: str, session_id: str, df: pd.DataFrame, filename: str):
    key = get_store_key(project_id, session_id)
    if key not in store:
        store[key] = {}
    store[key]["df"] = df
    # Store original data only when it's first set (or we could just overwrite both if this is called on upload)
    # Since set_project_data is only called in upload.py on new file/url, we can overwrite original_df too.
    store[key]["original_df"] = df.copy()
    store[key]["filename"] = filename

