import os

with open('src/features/cleansing/CleansingView.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I will replace the state initialization
content = content.replace("const [activeTab, setActiveTab] = useState<'anomalies' | 'reverse'>('anomalies');",
"""const [activeTab, setActiveTab] = useState<'missing' | 'anomalies' | 'recode' | 'reverse'>('missing');

  // Recode / Anomalies State
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [distinctValues, setDistinctValues] = useState<{value: string, count: number}[]>([]);
  const [recodeMap, setRecodeMap] = useState<Record<string, string>>({});
  const [isRecoding, setIsRecoding] = useState(false);""")

# Add fetching distinct values logic
fetch_distinct_code = """
  useEffect(() => {
    if ((activeTab === 'anomalies' || activeTab === 'recode') && selectedColumn) {
      fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/distinct/${selectedColumn}`)
        .then(res => res.json())
        .then(resData => {
          setDistinctValues(resData.data || []);
          setRecodeMap({});
        })
        .catch(err => console.error(err));
    } else {
      setDistinctValues([]);
    }
  }, [activeTab, selectedColumn]);

  const handleApplyRecode = async () => {
    const mappings: Record<string, any> = {};
    Object.entries(recodeMap).forEach(([k, v]) => {
      if (v.trim() !== '') {
        mappings[k] = v;
      }
    });
    
    if (Object.keys(mappings).length === 0) {
      alert('변경할 값을 입력해주세요.');
      return;
    }
    
    setIsRecoding(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/recode_map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_name: selectedColumn,
          mappings
        })
      });
      if (!res.ok) throw new Error('변환 실패');
      
      addAuditLog({
        step: '데이터 전처리',
        action: activeTab === 'recode' ? '문자->숫자 변환' : '이상치 일괄 수정',
        details: { column: selectedColumn, mappings }
      });

      alert('성공적으로 변경되었습니다.');
      setRecodeMap({});
      fetchData(); // Reload main data
      // Reload distinct
      const resDist = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/distinct/${selectedColumn}`);
      const distData = await resDist.json();
      setDistinctValues(distData.data || []);
    } catch (err) {
      alert('오류가 발생했습니다.');
    } finally {
      setIsRecoding(false);
    }
  };
"""

content = content.replace("useEffect(() => {\n    fetchData();\n  }, []);",
"useEffect(() => {\n    fetchData();\n  }, []);\n" + fetch_distinct_code)

# Add UI for 4 tabs
tabs_ui = """
          <button 
            className={`btn-secondary ${activeTab === 'missing' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'missing' ? 'var(--primary)' : '', color: activeTab === 'missing' ? 'white' : '' }}
            onClick={() => setActiveTab('missing')}
          >
            <AlertTriangle size={18} /> 결측치 확인
          </button>
          
          <button 
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
          </button>
          
          <button 
            className={`btn-secondary ${activeTab === 'reverse' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'reverse' ? 'var(--primary)' : '', color: activeTab === 'reverse' ? 'white' : '' }}
            onClick={() => setActiveTab('reverse')}
          >
            <ArrowLeftRight size={18} /> 역코딩
          </button>
"""
old_tabs_ui = """          <button 
            className={`btn-secondary ${activeTab === 'anomalies' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'anomalies' ? 'var(--primary)' : '', color: activeTab === 'anomalies' ? 'white' : '' }}
            onClick={() => setActiveTab('anomalies')}
          >
            <AlertTriangle size={18} /> 이상치/결측치 수정
          </button>
          
          <button 
            className={`btn-secondary ${activeTab === 'reverse' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'reverse' ? 'var(--primary)' : '', color: activeTab === 'reverse' ? 'white' : '' }}
            onClick={() => setActiveTab('reverse')}
          >
            <ArrowLeftRight size={18} /> 역코딩
          </button>"""
content = content.replace(old_tabs_ui, tabs_ui)

missing_filter = """
  // For missing tab, filter rows that have any empty/NaN values
  const displayData = activeTab === 'missing' 
    ? data.filter(row => Object.values(row).some(v => v === null || v === ''))
    : data;
    
  const table = useReactTable({
    data: displayData,
    columns,
"""
content = content.replace("  const table = useReactTable({\n    data,\n    columns,", missing_filter)

# Change Anomalies Tab UI
content = content.replace("{/* 이상치/결측치 탭 */}", "{/* 결측치 탭 */}")
content = content.replace("{activeTab === 'anomalies' && (", "{activeTab === 'missing' && (")
content = content.replace("이상치 및 결측치 수동 처리", "결측치 수동 처리")

distinct_tab_ui = """
        {/* 이상치/코딩변경 탭 (공통 레이아웃) */}
        {(activeTab === 'anomalies' || activeTab === 'recode') && (
          <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
            <div className="glass-panel" style={{ width: '300px', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 16px 0' }}>컬럼 선택</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                {activeTab === 'anomalies' ? '데이터 오류나 비정상적인 값(이상치)이 있는지 확인할 변수를 선택하세요.' : '텍스트(예: "3년 이상")를 숫자로 변환할 변수를 선택하세요.'}
              </p>
              <select 
                value={selectedColumn}
                onChange={e => setSelectedColumn(e.target.value)}
                style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
              >
                <option value="">-- 변수 선택 --</option>
                {originalColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {selectedColumn && (
              <div className="glass-panel" style={{ flex: 1, borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
                <h3 style={{ margin: '0 0 16px 0' }}>{selectedColumn} 고유값 목록</h3>
                
                {distinctValues.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)' }}>고유값이 없습니다.</p>
                ) : (
                  <>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '24px' }}>
                      <thead style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                        <tr>
                          <th style={{ padding: '12px' }}>기존 값 (고유값)</th>
                          <th style={{ padding: '12px', width: '100px' }}>빈도수</th>
                          <th style={{ padding: '12px', width: '200px' }}>새로운 값 입력</th>
                        </tr>
                      </thead>
                      <tbody>
                        {distinctValues.map(item => (
                          <tr key={item.value} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px', fontWeight: '500' }}>{item.value}</td>
                            <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{item.count}개</td>
                            <td style={{ padding: '12px' }}>
                              <input 
                                type="text"
                                placeholder={activeTab === 'anomalies' ? '수정할 경우에만 기입' : '숫자 입력 (예: 1)'}
                                value={recodeMap[item.value] || ''}
                                onChange={e => setRecodeMap({...recodeMap, [item.value]: e.target.value})}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-base)', color: 'var(--text-primary)' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <button 
                      className="btn-primary" 
                      onClick={handleApplyRecode}
                      disabled={isRecoding || Object.values(recodeMap).filter(v => v.trim() !== '').length === 0}
                      style={{ alignSelf: 'flex-end', padding: '12px 24px' }}
                    >
                      {isRecoding ? '처리 중...' : '입력한 값 일괄 변경 적용'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
"""

content = content.replace("{/* 역코딩 탭 */}", distinct_tab_ui + "\n        {/* 역코딩 탭 */}")

with open('src/features/cleansing/CleansingView.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
