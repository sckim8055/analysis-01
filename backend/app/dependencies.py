from fastapi import Header

def get_session_id(x_session_id: str = Header("default-session", alias="X-Session-Id")) -> str:
    return x_session_id

def get_project_id(x_project_id: str = Header("analysis-01", alias="X-Project-Id")) -> str:
    return x_project_id
