import os

files_to_patch = ['backend/app/routers/analysis.py', 'backend/app/routers/report.py']

for path in files_to_patch:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace the chunk
    old_chunk = '''    file_path = "data/uploaded_data.csv"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="데이터 파일이 존재하지 않습니다. 먼저 업로드해주세요.")
    
    try:
        # 1. 데이터 로드 및 전처리
        df = pd.read_csv(file_path)'''

    new_chunk = '''    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 존재하지 않습니다. 먼저 데이터를 업로드해주세요.")
    
    try:
        # df = get_project_data("test-project-1")'''
        
    content = content.replace(old_chunk, new_chunk)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Replacement completed!")
