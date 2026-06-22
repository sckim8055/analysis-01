import os
import re

src_dir = r'd:\test\claudecode\files\analysis-01\frontend\src'

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if 'http://localhost:8000' in content:
                # Regex to match 'http://localhost:8000/api/something' or "http://localhost:8000/api/something"
                # Replacement will use javascript template literal syntax
                new_content = re.sub(
                    r"(['\"])http://localhost:8000(.*?)(\1)", 
                    r"`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}\2`", 
                    content
                )
                
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")
