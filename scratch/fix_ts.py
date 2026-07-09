import re

def fix_file(filepath, replacements):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements:
        content = content.replace(old, new)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# Fix MediationView.tsx
fix_file(r'd:\test\claudecode\files\analysis-01\frontend\src\features\mediation\MediationView.tsx', [
    ('(iv: any, idx: number)', '(iv: any)'),
])

# Fix RegressionView.tsx
fix_file(r'd:\test\claudecode\files\analysis-01\frontend\src\features\regression\RegressionView.tsx', [
    ('const validMods = ', '// const validMods = '),
    ('const isVarNode = ', '// const isVarNode = '),
    ('(v: any, vIdx: number)', '(v: any)')
])
