import os
import re

BACKEND_DIR = r"d:\test\claudecode\files\analysis-01\backend\app\routers"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if '"test-project-1"' not in content:
        return False

    # 1. Add imports for Depends, get_session_id, get_project_id
    if 'from fastapi import Depends' not in content:
        content = content.replace('from fastapi import', 'from fastapi import Depends,')
        if 'Depends,' not in content:
            # Maybe it imports something else
            content = "from fastapi import Depends\n" + content
            
    if 'from ..dependencies import get_session_id, get_project_id' not in content:
        content = content.replace('from fastapi import', 'from ..dependencies import get_session_id, get_project_id\nfrom fastapi import')

    # 2. Add dependencies to all router endpoints that use "test-project-1"
    # Find all defs
    def_pattern = re.compile(r'(async def [a-zA-Z0-9_]+)\((.*?)\):')
    
    # Wait, not all defs need it, only the ones that call get_project_data
    # But it's easier to just inject it if they have "test-project-1" inside them
    # Actually we can do a regex replacement on "test-project-1" to use project_id, session_id
    
    # First, let's inject Depends into every route definition
    # E.g. async def perform_efa(request: EFARequest): -> async def perform_efa(request: EFARequest, session_id: str = Depends(get_session_id), project_id: str = Depends(get_project_id)):
    
    def repl_def(match):
        func_name = match.group(1)
        args = match.group(2)
        if 'session_id: str = Depends(get_session_id)' in args:
            return match.group(0)
            
        if args.strip() == '':
            new_args = 'session_id: str = Depends(get_session_id), project_id: str = Depends(get_project_id)'
        else:
            new_args = args + ', session_id: str = Depends(get_session_id), project_id: str = Depends(get_project_id)'
        return f"{func_name}({new_args}):"
        
    content = def_pattern.sub(repl_def, content)
    
    # 3. Replace "test-project-1" with project_id, session_id
    content = content.replace('("test-project-1")', '(project_id, session_id)')
    content = content.replace('("test-project-1",', '(project_id, session_id,')
    content = content.replace('project_id = "test-project-1"', '')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
    return True

changed_files = []
for file in os.listdir(BACKEND_DIR):
    if file.endswith('.py'):
        filepath = os.path.join(BACKEND_DIR, file)
        if process_file(filepath):
            changed_files.append(filepath)

print(f"Replaced in {len(changed_files)} files:")
for f in changed_files:
    print(f)
