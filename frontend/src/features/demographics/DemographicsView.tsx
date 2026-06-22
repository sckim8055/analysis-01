import React, { useState, useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { CheckSquare, Users, GitMerge, Trash2, History } from 'lucide-react';

export const DemographicsView: React.FC = () => {
  const { setCurrentStep } = useUiStore();
  const { originalColumns, demographicColumns, setDemographicColumns, recodeLogs, addRecodeLog } = useProjectStore();
  
  const [selectedCols, setSelectedCols] = useState<string[]>(demographicColumns || []);
  const [frequencies, setFrequencies] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  
  // UI State for Recoding
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string[]>>({});
  const [mergeName, setMergeName] = useState('');

  // Fetch Frequencies for selected columns
  const fetchFrequencies = async (cols: string[]) => {
    if (cols.length === 0) {
      setFrequencies({});
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analysis/frequency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: cols })
      });
      if (res.ok) {
        const data = await res.json();
        setFrequencies(data.frequencies);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFrequencies(selectedCols);
  }, [selectedCols]);

  const toggleColumnSelection = (col: string) => {
    setSelectedCols(prev => {
      if (prev.includes(col)) return prev.filter(c => c !== col);
      return [...prev, col];
    });
  };

  const toggleCategorySelection = (col: string, category: string) => {
    setSelectedCategories(prev => {
      const colSelected = prev[col] || [];
      if (colSelected.includes(category)) {
        return { ...prev, [col]: colSelected.filter(c => c !== category) };
      }
      return { ...prev, [col]: [...colSelected, category] };
    });
  };

  const handleMerge = async (col: string) => {
    const catsToMerge = selectedCategories[col] || [];
    if (catsToMerge.length < 2) {
      alert("병합할 카테고리를 2개 이상 선택해주세요.");
      return;
    }
    const targetName = mergeName.trim();
    if (!targetName) {
      alert("새로운 병합 카테고리 이름을 입력해주세요.");
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/recode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_name: col,
          old_values: catsToMerge,
          new_value: targetName
        })
      });
      if (res.ok) {
        addRecodeLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          type: 'MERGE',
          column: col,
          message: `'${catsToMerge.join(', ')}' ➔ '${targetName}'`
        });
        
        setMergeName('');
        setSelectedCategories({ ...selectedCategories, [col]: [] });
        // Refresh frequency
        await fetchFrequencies(selectedCols);
      } else {
        alert("병합 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDrop = async (col: string) => {
    const catsToDrop = selectedCategories[col] || [];
    if (catsToDrop.length === 0) {
      alert("제외할 카테고리를 1개 이상 선택해주세요.");
      return;
    }

    if (!confirm(`정말 선택한 범주의 응답자를 데이터에서 완전히 제외하시겠습니까?\n이 작업은 전체 데이터 N수에 영향을 미칩니다.`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/drop_values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          column_name: col,
          values_to_drop: catsToDrop
        })
      });
      if (res.ok) {
        const result = await res.json();
        
        addRecodeLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          type: 'DROP',
          column: col,
          message: `'${catsToDrop.join(', ')}' 제외 완료 (현재 N=${result.new_total_rows})`
        });

        setSelectedCategories({ ...selectedCategories, [col]: [] });
        // Refresh frequency
        await fetchFrequencies(selectedCols);
      } else {
        alert("삭제 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>
      
      {/* 상단 공통 액션 바 */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>인구통계 사전 처리</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            일반적 특성(인구통계) 변수를 선택하고, 도수가 적은 항목을 병합하거나 분석에서 제외하세요.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <a 
            href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/download`} 
            download="cleansed_data.xlsx"
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', color: 'inherit' }}
          >
            엑셀로 다운로드
          </a>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => {
              setDemographicColumns(selectedCols);
              setCurrentStep('mapping');
            }}
          >
            <CheckSquare size={18} /> 전처리 완료 (매핑으로 이동) ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
        
        {/* 좌측 패널: 전체 원본 컬럼 목록 */}
        <div className="glass-panel" style={{ width: '250px', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <h2 className="text-h3" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} /> 원본 컬럼 목록
            </h2>
            <p className="text-small" style={{ marginTop: '4px', color: 'var(--text-muted)' }}>클릭하여 문항을 선택하세요.</p>
          </div>
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            {originalColumns.map((col) => (
              <div 
                key={col}
                onClick={() => toggleColumnSelection(col)}
                style={{
                  padding: '10px 12px', marginBottom: '8px', borderRadius: '6px', cursor: 'pointer',
                  backgroundColor: selectedCols.includes(col) ? 'var(--bg-surface)' : 'transparent',
                  border: `1px solid ${selectedCols.includes(col) ? 'var(--accent-primary)' : 'var(--border-light)'}`,
                  color: selectedCols.includes(col) ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontWeight: selectedCols.includes(col) ? 600 : 400,
                  transition: 'all 0.2s'
                }}
              >
                {col}
              </div>
            ))}
          </div>
        </div>

        {/* 중앙 패널: 선택된 컬럼 빈도표 및 조작부 */}
        <div className="glass-panel" style={{ flex: 1, borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: 0, padding: '24px', overflowY: 'auto', backgroundColor: 'var(--bg-base)' }}>
          {selectedCols.length === 0 ? (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>좌측에서 인구통계 변수를 선택해주세요.</div>
          ) : loading && Object.keys(frequencies).length === 0 ? (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>빈도 분석을 계산 중입니다...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {selectedCols.map(col => {
                const freqs = frequencies[col];
                if (!freqs) return null;
                
                const colSelected = selectedCategories[col] || [];
                
                return (
                  <div key={col} style={{ backgroundColor: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <h3 className="text-h3" style={{ margin: 0, color: 'var(--accent-primary)' }}>{col}</h3>
                      
                      {/* 액션 버튼 */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {colSelected.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '16px', borderRight: '1px solid var(--border-color)', paddingRight: '16px' }}>
                            <input 
                              type="text" 
                              placeholder="새 이름 입력" 
                              value={mergeName}
                              onChange={(e) => setMergeName(e.target.value)}
                              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', width: '130px', outline: 'none' }}
                            />
                            <button className="btn-secondary" onClick={() => handleMerge(col)} style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <GitMerge size={16} /> 병합
                            </button>
                          </div>
                        )}
                        <button 
                          className="btn-secondary" 
                          onClick={() => handleDrop(col)} 
                          disabled={colSelected.length === 0}
                          style={{ color: colSelected.length > 0 ? 'var(--danger)' : 'var(--text-muted)', borderColor: colSelected.length > 0 ? 'var(--danger)' : 'var(--border-color)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Trash2 size={16} /> 응답 제외
                        </button>
                      </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}>선택</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>범주 (Category)</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>빈도 (N)</th>
                          <th style={{ padding: '10px', textAlign: 'right' }}>퍼센트 (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {freqs.map((f, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-light)', backgroundColor: colSelected.includes(f.category) ? 'rgba(99, 102, 241, 0.05)' : 'transparent', transition: 'background-color 0.2s' }}>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                              <input 
                                type="checkbox" 
                                checked={colSelected.includes(f.category)}
                                onChange={() => toggleCategorySelection(col, f.category)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
                              />
                            </td>
                            <td style={{ padding: '10px', textAlign: 'left', fontWeight: colSelected.includes(f.category) ? '600' : '400', color: colSelected.includes(f.category) ? 'var(--accent-primary)' : 'inherit' }}>
                              {f.category}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', color: f.count < 30 ? 'var(--danger)' : 'inherit', fontWeight: f.count < 30 ? '600' : '400' }}>
                              {f.count}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                              {f.percent.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 우측 패널: 데이터 변환 이력 (History) */}
        <div className="glass-panel" style={{ width: '300px', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="var(--accent-secondary)" />
            <h2 className="text-h3" style={{ margin: 0 }}>데이터 변경 이력</h2>
          </div>
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recodeLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '14px' }}>
                아직 데이터 변경 이력이 없습니다.<br/>병합이나 제외를 실행하면 여기에 기록됩니다.
              </div>
            ) : (
              recodeLogs.map(log => (
                <div key={log.id} style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', borderLeft: `3px solid ${log.type === 'MERGE' ? 'var(--accent-primary)' : 'var(--danger)'}`, fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>[{log.column}]</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {log.type === 'MERGE' ? (
                      <><GitMerge size={12} style={{ display: 'inline', marginRight: '4px', color: 'var(--accent-primary)' }}/> 병합: {log.message}</>
                    ) : (
                      <><Trash2 size={12} style={{ display: 'inline', marginRight: '4px', color: 'var(--danger)' }}/> 삭제: {log.message}</>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
