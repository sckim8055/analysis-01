import re

path = 'backend/app/routers/upload.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the writing logic
content = re.sub(
    r'\s+# analysis\.py 등 다른 곳에서 읽을 수 있도록 파일로도 저장\n\s+os\.makedirs\("data", exist_ok=True\)\n\s+df\.to_csv\("data/uploaded_data\.csv", index=False\)',
    '',
    content
)

content = re.sub(
    r'\s+# 다른 곳에서 읽을 수 있도록 파일로도 저장\n\s+os\.makedirs\("data", exist_ok=True\)\n\s+df\.to_csv\("data/uploaded_data\.csv", index=False\)',
    '',
    content
)

content = re.sub(
    r'\s+df\.to_csv\("data/uploaded_data\.csv", index=False\)',
    '',
    content
)

# Remove the reading fallback logic
fallback_pattern = r'''def _get_active_df\(\):\n    df = get_project_data\("test-project-1"\)\n    if df is None:\n        file_path = "data/uploaded_data\.csv"\n        if os\.path\.exists\(file_path\):\n            df = pd\.read_csv\(file_path\)\n            set_project_data\("test-project-1", df, "uploaded_data\.csv"\)\n    return df'''

new_fallback = '''def _get_active_df():
    return get_project_data("test-project-1")'''

content = re.sub(fallback_pattern, new_fallback, content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement completed for upload.py")
