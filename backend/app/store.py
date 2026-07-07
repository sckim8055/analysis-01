from typing import Dict, Any
import pandas as pd

# In-memory store for prototype
# project_id -> { "df": DataFrame, "original_df": DataFrame, "filename": str }
store: Dict[str, Dict[str, Any]] = {}

def get_project_data(project_id: str, original: bool = False) -> pd.DataFrame:
    if project_id in store:
        key = "original_df" if original else "df"
        if key in store[project_id]:
            return store[project_id][key]
    return None

def set_project_data(project_id: str, df: pd.DataFrame, filename: str):
    if project_id not in store:
        store[project_id] = {}
    store[project_id]["df"] = df
    # Store original data only when it's first set (or we could just overwrite both if this is called on upload)
    # Since set_project_data is only called in upload.py on new file/url, we can overwrite original_df too.
    store[project_id]["original_df"] = df.copy()
    store[project_id]["filename"] = filename

