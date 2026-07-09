import re
import os

files_to_patch = ['backend/app/routers/analysis.py', 'backend/app/routers/report.py']

pattern = re.compile(
    r'    file_path = "data/uploaded_data\.csv"\n'
    r'    if not os\.path\.exists\(file_path\):\n'
    r'        raise HTTPException\(status_code=400, detail="데이터 파일이 존재하지 않습니다\. 먼저 업로드해주세요\."\)\n'
    r'\s+try:\n'
    r'(.*?)(df = pd\.read_csv\(file_path\))',
    re.DOTALL
)

replacement = r'''    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 존재하지 않습니다. 먼저 데이터를 업로드해주세요.")
    
    try:
\1# df = get_project_data("test-project-1") (이미 위에서 로드함)'''

for path in files_to_patch:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Add import if missing
    if 'get_project_data' not in content:
        content = content.replace('from fastapi', 'from ..store import get_project_data\nfrom fastapi')
        
    new_content = pattern.sub(replacement, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
print("Replacement completed for analysis.py and report.py")
