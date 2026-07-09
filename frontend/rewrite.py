import re

with open(r'd:\test\claudecode\files\analysis-01\frontend\src\features\factor\FactorAnalysisView.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. activeVarId -> activeTargetId
code = code.replace("const [activeVarId, setActiveVarId] = useState<string | null>(null);", 
"const [activeTargetId, setActiveTargetId] = useState<string | null>(null);\n  const [expandedVars, setExpandedVars] = useState<Set<string>>(new Set());")

code = code.replace("if (!activeVarId && allVariables.length > 0) {", "if (!activeTargetId && allVariables.length > 0) {")
code = code.replace("setActiveVarId(allVariables[0].v.id);", "const firstVar = allVariables[0].v;\n      if (firstVar.subFactors && firstVar.subFactors.length > 0) {\n        setActiveTargetId(firstVar.subFactors[0].id);\n        setExpandedVars(prev => new Set(prev).add(firstVar.id));\n      } else {\n        setActiveTargetId(firstVar.id);\n      }")
code = code.replace("[allVariables, activeVarId]", "[allVariables, activeTargetId]")

code = code.replace("const activeVarContext = useMemo(() => allVariables.find(x => x.v.id === activeVarId), [allVariables, activeVarId]);",
"""const activeTargetContext = useMemo(() => {
    for (const { type, v } of allVariables) {
      if (v.id === activeTargetId) return { type, v, sf: undefined };
      if (v.subFactors) {
        const sf = v.subFactors.find(s => s.id === activeTargetId);
        if (sf) return { type, v, sf };
      }
    }
    return null;
  }, [allVariables, activeTargetId]);""")

# Replace activeVarContext usage
code = code.replace("!activeVarContext", "!activeTargetContext")
code = code.replace("activeVarContext.v", "activeTargetContext.v")
code = code.replace("activeVarContext?.v", "activeTargetContext?.v")
code = code.replace("activeVarContext.type", "activeTargetContext.type")

# 2. itemIds selection
code = code.replace("""if (activeTargetContext.v.itemIds) activeTargetContext.v.itemIds.forEach(id => allItemIds.add(id));
      if (activeTargetContext.v.subFactors) {
        activeTargetContext.v.subFactors.forEach(sf => {
          if (sf.itemIds) sf.itemIds.forEach(id => allItemIds.add(id));
        });
      }""", """if (activeTargetContext.sf) {
        if (activeTargetContext.sf.itemIds) activeTargetContext.sf.itemIds.forEach(id => allItemIds.add(id));
      } else {
        if (activeTargetContext.v.itemIds) activeTargetContext.v.itemIds.forEach(id => allItemIds.add(id));
      }""")

# 3. excludedItems
code = code.replace("excludedItems[activeTargetContext.v.id]", "excludedItems[activeTargetId!]")

# 4. Factor Names (replace big block)
block_to_replace = """// 하위 요인(subFactors)이 정의된 경우, 추출된 요인과 매칭하여 이름 자동 부여
      const finalFNames = [...fNames];
      if (activeTargetContext?.v.subFactors && activeTargetContext.v.subFactors.length > 0) {
        // 요인별로 할당된 문항(column)들 그룹화
        const factorToCols: Record<number, string[]> = {};
        mItems.forEach(m => {
          const maxAbs = Math.max(...m.loadings.map(Math.abs));
          const domIdx = m.loadings.findIndex(v => Math.abs(v) === maxAbs);
          if (!factorToCols[domIdx]) factorToCols[domIdx] = [];
          factorToCols[domIdx].push(m.id);
        });

        // 각 요인별로 가장 많이 겹치는 하위 요인 이름 찾기
        const usedNames = new Set<string>();
        for (let i = 0; i < result.n_factors; i++) {
          const cols = factorToCols[i] || [];
          let bestMatch = null;
          let bestCount = 0;

          activeTargetContext.v.subFactors.forEach(sf => {
            if (usedNames.has(sf.name)) return; // 이미 매칭된 이름은 제외
            const overlap = cols.filter(c => sf.itemIds.includes(c)).length;
            if (overlap > bestCount) {
              bestCount = overlap;
              bestMatch = sf.name;
            }
          });

          if (bestMatch && bestCount > 0) {
            finalFNames[i] = bestMatch;
            usedNames.add(bestMatch);
          }
        }
      } else if (activeTargetContext) {
        // 하위 요인이 없는 경우 변수명으로 대체
        if (result.n_factors === 1) {
          finalFNames[0] = activeTargetContext.v.name;
        } else {
          for (let i = 0; i < result.n_factors; i++) {
            finalFNames[i] = `${activeTargetContext.v.name} ${i + 1}`;
          }
        }
      }"""

replacement = """const finalFNames = [...fNames];
      const targetName = activeTargetContext.sf ? activeTargetContext.sf.name : activeTargetContext.v.name;
      if (result.n_factors === 1) {
        finalFNames[0] = targetName;
      } else {
        for (let i = 0; i < result.n_factors; i++) {
          finalFNames[i] = `${targetName} ${i + 1}`;
        }
      }"""
code = code.replace(block_to_replace, replacement)

# 5. useEffect activeVarId -> activeTargetId
code = code.replace("if (activeVarId) {", "if (activeTargetId) {")
code = code.replace("!approvedVariables.includes(activeVarId)", "!approvedVariables.includes(activeTargetId)")
code = code.replace("factorResults[activeVarId]", "factorResults[activeTargetId]")
code = code.replace("}, [activeVarId]);", "}, [activeTargetId]);")

# 6. handleApprove
code = code.replace("if (!activeVarId) return;", "if (!activeTargetId) return;")
code = code.replace("id: `${activeVarId}_sf_auto_${i}`", "id: `${activeTargetId}_sf_auto_${i}`")
code = code.replace("setFactorResult(activeVarId, {", "setFactorResult(activeTargetId, {")
code = code.replace("approveVariable(activeVarId);", "approveVariable(activeTargetId);")
code = code.replace("variableId: activeVarId,", "variableId: activeTargetId,")
code = code.replace("variableName: activeTargetContext?.v.name,", "variableName: activeTargetContext.sf ? activeTargetContext.sf.name : activeTargetContext.v.name,")

# nextUnapproved logic
code = code.replace("""const currentIndex = allVariables.findIndex(x => x.v.id === activeVarId);
    const nextUnapproved = allVariables.slice(currentIndex + 1).find(x => !approvedVariables.includes(x.v.id));
    if (nextUnapproved) setActiveVarId(nextUnapproved.v.id);""",
"""// Find next unapproved target
    const allTargets: { id: string }[] = [];
    allVariables.forEach(x => {
        if (x.v.subFactors && x.v.subFactors.length > 0) {
            x.v.subFactors.forEach(sf => allTargets.push({ id: sf.id }));
        } else {
            allTargets.push({ id: x.v.id });
        }
    });
    const currentIndex = allTargets.findIndex(x => x.id === activeTargetId);
    const nextUnapproved = allTargets.slice(currentIndex + 1).find(x => !approvedVariables.includes(x.id));
    if (nextUnapproved) setActiveTargetId(nextUnapproved.id);""")

# 7. allApproved logic
code = code.replace("""const allApproved = allVariables.length > 0 && allVariables.every(x => approvedVariables.includes(x.v.id));""",
"""const allTargets = allVariables.flatMap(x => (x.v.subFactors && x.v.subFactors.length > 0) ? x.v.subFactors : [x.v]);
  const allApproved = allTargets.length > 0 && allTargets.every(t => approvedVariables.includes(t.id));""")

# 8. allCurrentVarItems
code = code.replace("""if (activeTargetContext.v.itemIds) activeTargetContext.v.itemIds.forEach(id => ids.add(id));
    if (activeTargetContext.v.subFactors) {
      activeTargetContext.v.subFactors.forEach(sf => {
        if (sf.itemIds) sf.itemIds.forEach(id => ids.add(id));
      });
    }""", """if (activeTargetContext.sf) {
      if (activeTargetContext.sf.itemIds) activeTargetContext.sf.itemIds.forEach(id => ids.add(id));
    } else {
      if (activeTargetContext.v.itemIds) activeTargetContext.v.itemIds.forEach(id => ids.add(id));
    }""")

# 9. Sidebar Render
code = code.replace("const isApproved = approvedVariables.includes(v.id);", "const hasSubFactors = v.subFactors && v.subFactors.length > 0;\n              const isApproved = hasSubFactors ? v.subFactors!.every(sf => approvedVariables.includes(sf.id)) : approvedVariables.includes(v.id);")
code = code.replace("const isActive = activeVarId === v.id;", "const isActive = !hasSubFactors && activeTargetId === v.id;")
code = code.replace("onClick={() => setActiveVarId(v.id)}", 
"""onClick={() => {
                      if (hasSubFactors) {
                        setExpandedVars(prev => {
                          const next = new Set(prev);
                          if (next.has(v.id)) next.delete(v.id);
                          else next.add(v.id);
                          return next;
                        });
                      } else {
                        setActiveTargetId(v.id);
                      }
                    }}""")

sidebar_sub_replace = """{v.subFactors && v.subFactors.length > 0 && (
                    <div style={{ marginLeft: '18px', borderLeft: '1px solid var(--border-light)', paddingLeft: '8px', marginTop: '4px' }}>
                      {v.subFactors.map(sf => (
                        <div key={sf.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <Layers size={12} />
                          <span>{sf.name}</span>
                          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>({sf.itemIds?.length || 0})</span>
                        </div>
                      ))}
                    </div>
                  )}"""

sidebar_sub_replacement = """{hasSubFactors && expandedVars.has(v.id) && (
                    <div style={{ marginLeft: '18px', borderLeft: '1px solid var(--border-light)', paddingLeft: '8px', marginTop: '4px' }}>
                      {v.subFactors!.map(sf => {
                        const isSfActive = activeTargetId === sf.id;
                        const isSfApproved = approvedVariables.includes(sf.id);
                        return (
                          <div 
                            key={sf.id} 
                            onClick={(e) => { e.stopPropagation(); setActiveTargetId(sf.id); }}
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', fontSize: '0.85rem', 
                              color: isSfActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                              backgroundColor: isSfActive ? 'var(--bg-panel)' : 'transparent',
                              borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
                              fontWeight: isSfActive ? 600 : 400
                            }}
                          >
                            <Layers size={14} color={isSfActive ? color : 'var(--text-muted)'} />
                            <span style={{ flex: 1 }}>{sf.name}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>({sf.itemIds?.length || 0})</span>
                            {isSfApproved && <Check size={12} color="var(--success)" />}
                          </div>
                        );
                      })}
                    </div>
                  )}"""
code = code.replace(sidebar_sub_replace, sidebar_sub_replacement)

# 10. Main Canvas header
code = code.replace("activeTargetContext.v.name} 요인분석", "{(activeTargetContext.sf ? activeTargetContext.sf.name : activeTargetContext.v.name)} 요인분석")
code = code.replace("approvedVariables.includes(activeTargetContext.v.id)", "approvedVariables.includes(activeTargetId!)")
code = code.replace("toggleItemExclusion(activeTargetContext.v.id, id);", "toggleItemExclusion(activeTargetId!, id);")

with open(r'd:\test\claudecode\files\analysis-01\frontend\src\features\factor\FactorAnalysisView.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Rewrote FactorAnalysisView.tsx")
