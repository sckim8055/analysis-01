import os
import re

files_to_patch = [
    'backend/app/routers/analysis.py',
    'backend/app/routers/report.py',
    'backend/app/routers/upload.py'
]

for path in files_to_patch:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to replace blocks starting with ile_path = "data/uploaded_data.csv" 
    # down to df = pd.read_csv(file_path) (inclusive).
    
    pattern = re.compile(
        r'(\s+)file_path = "data/uploaded_data\.csv".*?df = pd\.read_csv\(file_path\)',
        re.DOTALL
    )
    
    replacement = r'''\1df = get_project_data("test-project-1")\1if df is None:\1    raise HTTPException(status_code=400, detail="데이터가 메모리에 존재하지 않습니다. 먼저 업로드해주세요.")'''
    
    content = pattern.sub(replacement, content)
    
    # And there are some set_project_data("test-project-1", df, "uploaded_data.csv") left in upload.py
    content = re.sub(
        r'\s+set_project_data\("test-project-1", df, "uploaded_data\.csv"\)',
        '',
        content
    )
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Final patch completed!")
