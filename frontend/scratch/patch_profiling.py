import os

with open('src/features/cleansing/CleansingView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace activeTab state
content = content.replace("useState<'missing' | 'anomalies' | 'recode' | 'reverse'>('missing')", "useState<'missing' | 'profiling' | 'reverse'>('missing')")

# Add profiles state
content = content.replace("const [selectedColumn, setSelectedColumn] = useState<string>('');", "const [selectedColumn, setSelectedColumn] = useState<string>('');\n  const [profiles, setProfiles] = useState<Record<string, {value: string, count: number}[]>>({});")

# Replace fetch logic for distinct values with profiles logic
old_fetch_logic = """  useEffect(() => {
    if ((activeTab === 'anomalies' || activeTab === 'recode') && selectedColumn) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/distinct/${encodeURIComponent(selectedColumn)}`)
        .then(res => res.json())
        .then(resData => {
          setDistinctValues(resData.data || []);
          setRecodeMap({});
        })
        .catch(err => console.error(err));
    } else {
      setDistinctValues([]);
    }
  }, [activeTab, selectedColumn]);"""

new_fetch_logic = """  useEffect(() => {
    if (activeTab === 'profiling') {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/profiles`)
        .then(res => res.json())
        .then(resData => {
          setProfiles(resData.data || {});
        })
        .catch(err => console.error(err));
    }
  }, [activeTab]);
  
  useEffect(() => {
    if (selectedColumn && profiles[selectedColumn]) {
      setDistinctValues(profiles[selectedColumn]);
      setRecodeMap({});
    }
  }, [selectedColumn, profiles]);
"""
content = content.replace(old_fetch_logic, new_fetch_logic)

# Replace the Apply Recode logic to refetch profiles
old_apply_logic = """      // Reload distinct
      const resDist = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/distinct/${encodeURIComponent(selectedColumn)}`);
      const distData = await resDist.json();
      setDistinctValues(distData.data || []);"""

new_apply_logic = """      // Reload profiles
      const resProf = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/profiles`);
      const profData = await resProf.json();
      setProfiles(profData.data || {});
      setSelectedColumn(''); // Close modal after apply"""
content = content.replace(old_apply_logic, new_apply_logic)

# Change tabs UI
old_tabs_ui = """          <button 
            className={`btn-secondary ${activeTab === 'anomalies' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'anomalies' ? 'var(--primary)' : '', color: activeTab === 'anomalies' ? 'white' : '' }}
            onClick={() => setActiveTab('anomalies')}
          >
            <AlertTriangle size={18} /> 이상치 수정
          </button>

          <button 
            className={`btn-secondary ${activeTab === 'recode' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'recode' ? 'var(--primary)' : '', color: activeTab === 'recode' ? 'white' : '' }}
            onClick={() => setActiveTab('recode')}
          >
            <ArrowLeftRight size={18} /> 코딩 변경
          </button>"""

new_tabs_ui = """          <button 
            className={`btn-secondary ${activeTab === 'profiling' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'profiling' ? 'var(--primary)' : '', color: activeTab === 'profiling' ? 'white' : '' }}
            onClick={() => setActiveTab('profiling')}
          >
            <ArrowLeftRight size={18} /> 데이터 프로파일링 (이상치/코딩변경)
          </button>"""
content = content.replace(old_tabs_ui, new_tabs_ui)

# Replace the distinct tab rendering block
old_tab_content = """        {/* 이상치/코딩변경 탭 (공통 레이아웃) */}
        {(activeTab === 'anomalies' || activeTab === 'recode') && ("""
# Find the end of the block
end_idx = content.find("        {/* 역코딩 탭 */}")

profiling_tab_content = """        {/* 데이터 프로파일링 탭 */}
        {activeTab === 'profiling' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {originalColumns.map(col => {
                const profile = profiles[col] || [];
                const maxCount = Math.max(...profile.map(p => p.count), 1);
                return (
                  <div 
                    key={col} 
                    onClick={() => setSelectedColumn(col)}
                    className="glass-panel"
                    style={{ 
                      padding: '20px', 
                      borderRadius: '16px', 
                      cursor: 'pointer', 
                      border: '1px solid var(--border-color)',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      backgroundColor: 'var(--bg-panel)',
                      minHeight: '200px'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={col}>{col}</h4>
                    {profile.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>데이터 없음</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {profile.slice(0, 5).map(item => (
                          <div key={item.value} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                            <div style={{ width: '80px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-secondary)' }} title={item.value}>
                              {item.value}
                            </div>
                            <div style={{ flex: 1, height: '8px', background: 'var(--bg-base)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${(item.count / maxCount) * 100}%`, height: '100%', background: 'var(--primary)', borderRadius: '4px' }} />
                            </div>
                            <div style={{ width: '35px', textAlign: 'right', fontWeight: '500' }}>{item.count}</div>
                          </div>
                        ))}
                        {profile.length > 5 && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px', padding: '4px', background: 'var(--bg-base)', borderRadius: '4px' }}>
                            + {profile.length - 5}개의 고유값 (클릭하여 수정)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            
            {/* 인라인 편집 모달 */}
            {selectedColumn && (
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setSelectedColumn('')}>
                <div 
                  className="glass-panel" 
                  style={{ width: '600px', maxHeight: '80vh', borderRadius: '16px', padding: '32px', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ margin: 0, fontSize: '20px' }}>{selectedColumn} 이상치 수정 및 코딩 변경</h3>
                    <button onClick={() => setSelectedColumn('')} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '28px', lineHeight: 1 }}>&times;</button>
                  </div>
                  
                  <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '24px' }}>
                      <thead style={{ backgroundColor: 'var(--bg-base)', position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr>
                          <th style={{ padding: '12px 16px', borderRadius: '8px 0 0 8px' }}>기존 값 (고유값)</th>
                          <th style={{ padding: '12px 16px', width: '100px' }}>빈도수</th>
                          <th style={{ padding: '12px 16px', width: '200px', borderRadius: '0 8px 8px 0' }}>새로운 값 입력</th>
                        </tr>
                      </thead>
                      <tbody>
                        {distinctValues.map(item => (
                          <tr key={item.value} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '16px', fontWeight: '500' }}>{item.value}</td>
                            <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{item.count}개</td>
                            <td style={{ padding: '12px 16px' }}>
                              <input 
                                type="text"
                                placeholder="예: 1"
                                value={recodeMap[item.value] || ''}
                                onChange={e => setRecodeMap({...recodeMap, [item.value]: e.target.value})}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                    <button className="btn-secondary" onClick={() => setSelectedColumn('')} style={{ padding: '12px 24px' }}>취소</button>
                    <button 
                      className="btn-primary" 
                      onClick={handleApplyRecode}
                      disabled={isRecoding || Object.values(recodeMap).filter(v => v.trim() !== '').length === 0}
                      style={{ padding: '12px 24px' }}
                    >
                      {isRecoding ? '처리 중...' : '입력한 값 일괄 변경 적용'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

"""

if old_tab_content in content:
    idx_start = content.index(old_tab_content)
    content = content[:idx_start] + profiling_tab_content + content[end_idx:]
else:
    print("Could not find the old tab content block.")

with open('src/features/cleansing/CleansingView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
