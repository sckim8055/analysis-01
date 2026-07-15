import os
import re

FRONTEND_DIR = r"d:\test\claudecode\files\analysis-01\frontend\src"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if fetch exists and VITE_API_URL is used
    if "fetch(" not in content or "VITE_API_URL" not in content:
        # Some files might just use fetch without VITE_API_URL, let's skip them or handle manually
        return False

    # Replace fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/...`)
    # We want to keep the URL part but remove the base URL and change fetch to apiFetch
    
    # Pattern to match fetch call:
    # fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/xxx`, { ... })
    # We can match: fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}
    # and replace with: apiFetch(`
    
    # Wait, some might use double quotes or different spacing. Let's use regex
    pattern = re.compile(r"fetch\(\s*`\$\{import\.meta\.env\.VITE_API_URL\s*\|\|\s*'http://localhost:8000'\}")
    
    if not pattern.search(content):
        return False

    new_content = pattern.sub(r"apiFetch(`", content)
    
    # Check if we also have fetch( without VITE_API_URL, e.g. using string concat or just relative path?
    # Usually they all use the env var template string.

    # Now we need to add the import statement.
    # import { apiFetch } from '../../utils/apiClient';
    # We need to figure out the relative path.
    # filepath is like frontend/src/features/upload/UploadView.tsx
    # apiClient is at frontend/src/utils/apiClient.ts
    
    rel_path = os.path.relpath(os.path.join(FRONTEND_DIR, "utils", "apiClient"), os.path.dirname(filepath))
    rel_path = rel_path.replace("\\", "/")
    if not rel_path.startswith('.'):
        rel_path = './' + rel_path
        
    import_stmt = f"import {{ apiFetch }} from '{rel_path}';\n"
    
    if "apiFetch" not in content:
        # insert after the last import statement
        lines = new_content.split('\n')
        last_import_idx = 0
        for i, line in enumerate(lines):
            if line.startswith('import '):
                last_import_idx = i
                
        lines.insert(last_import_idx + 1, import_stmt)
        new_content = '\n'.join(lines)
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
        
    return True

changed_files = []
for root, dirs, files in os.walk(FRONTEND_DIR):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            if process_file(filepath):
                changed_files.append(filepath)

print(f"Replaced in {len(changed_files)} files:")
for f in changed_files:
    print(f)
