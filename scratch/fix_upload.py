import os

UPLOAD_FILE = r"d:\test\claudecode\files\analysis-01\backend\app\routers\upload.py"

with open(UPLOAD_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace _get_active_df()
content = content.replace("df = _get_active_df()", "df = get_project_data(project_id, session_id)")
content = content.replace("def _get_active_df():\n    return get_project_data(project_id, session_id)\n\n", "")

with open(UPLOAD_FILE, 'w', encoding='utf-8') as f:
    f.write(content)
