import React, { useState, useEffect } from 'react';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { AlertTriangle, ArrowLeftRight, CheckSquare } from 'lucide-react';
import { EditableCell } from './components/EditableCell';
import { apiFetch } from '../../utils/apiClient';


export const CleansingView: React.FC = () => {
  const { setCurrentStep } = useUiStore();
  const { originalColumns, demographicColumns, setOriginalColumns } = useProjectStore();
  const addAuditLog = useAnalysisStore(state => state.addAuditLog);
  
  const [activeTab, setActiveTab] = useState<'missing' | 'profiling' | 'reverse'>('missing');

  // Recode / Anomalies State
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [profiles, setProfiles] = useState<Record<string, {value: string, count: number}[]>>({});
  const [distinctValues, setDistinctValues] = useState<{value: string, count: number}[]>([]);
  const [recodeMap, setRecodeMap] = useState<Record<string, string>>({});
  const [isRecoding, setIsRecoding] = useState(false);
  
  // Data State
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<ColumnDef<any>[]>([]);
  const [abnormalCount, setAbnormalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Reverse Coding State
  const [revSelectedCols, setRevSelectedCols] = useState<string[]>([]);
  const [revMin, setRevMin] = useState<number>(1);
  const [revMax, setRevMax] = useState<number>(5);
  const [revLoading, setRevLoading] = useState(false);

  const fetchData = () => {
    setIsLoading(true);
    apiFetch(`/api/data/smart`, { cache: 'no-store', headers: { 'Pragma': 'no-cache' } })
      .then(res => {
        if (!res.ok) throw new Error('업로드된 데이터가 없거나 서버 에러입니다.');
        return res.json();
      })
      .then(resData => {
        const cols: ColumnDef<any>[] = resData.columns.map((colName: string) => ({
          accessorKey: colName,
          header: colName,
          size: colName === 'id' ? 80 : 120,
          cell: EditableCell
        }));

        setColumns(cols);
        setAbnormalCount(resData.abnormal_count || 0);
        setData(resData.data);

        if (originalColumns.length === 0 && resData.columns && resData.columns.length > 0) {
          const actualCols = resData.columns.filter((c: string) => c !== 'id');
          setOriginalColumns(actualCols);
        }

        setIsLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // 항상 마운트 시 전체 프로필을 가져와 완료 검증 등에 사용
    apiFetch(`/api/data/profiles`)
      .then(res => res.json())
      .then(resData => {
        setProfiles(resData.data || {});
      })
      .catch(err => console.error(err));
  }, []);
  
  useEffect(() => {
    if (selectedColumn && profiles[selectedColumn]) {
      setDistinctValues(profiles[selectedColumn]);
      setRecodeMap({});
    }
  }, [selectedColumn, profiles]);


  const handleCompleteCleansing = () => {
    // Check for non-numeric values
    const textColumns: string[] = [];
    const isNumeric = (str: string) => {
      if (!str || str.trim() === '') return true; // Empty string or null is fine (handled as missing)
      return !isNaN(Number(str));
    };

    Object.entries(profiles).forEach(([col, profileData]) => {
      const hasText = profileData.some(item => !isNumeric(item.value));
      if (hasText) {
        textColumns.push(col);
      }
    });

    if (textColumns.length > 0) {
      const msg = `아직 텍스트(문자)가 포함된 변수가 ${textColumns.length}개 발견되었습니다.\n\n예: ${textColumns.slice(0, 5).join(', ')}${textColumns.length > 5 ? ' 등...' : ''}\n\n문자형 데이터가 섞여 있으면 추후 통계 분석 시 오류가 발생할 수 있습니다. 그래도 진행하시겠습니까? (취소 시 데이터를 수정할 수 있습니다.)`;
      if (!window.confirm(msg)) {
        setActiveTab('profiling');
        return;
      }
    }
    setCurrentStep('demographics');
  };

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
      const res = await apiFetch(`/api/data/recode_map`, {
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
        action: '데이터 프로파일링 (일괄 변경)',
        details: { column: selectedColumn, mappings }
      });

      alert('성공적으로 변경되었습니다.');
      setRecodeMap({});
      fetchData(); // Reload main data
      // Reload profiles
      const resProf = await apiFetch(`/api/data/profiles`);
      const profData = await resProf.json();
      setProfiles(profData.data || {});
      setSelectedColumn(''); // Close modal after apply
    } catch (err) {
      alert('오류가 발생했습니다.');
    } finally {
      setIsRecoding(false);
    }
  };


  const updateData = async (rowId: number, columnId: string, value: any) => {
    const rowToUpdate = data.find(r => r.id === rowId);
    const oldValue = rowToUpdate ? rowToUpdate[columnId] : null;

    addAuditLog({
      step: '데이터 전처리',
      action: oldValue === null || oldValue === '' ? '결측치 수정' : '셀 값 수정',
      details: { rowId, columnId, oldValue, newValue: value }
    });

    // Optimistic UI update
    setData(old =>
      old.map((row, index) => {
        if (row.id === rowId) {
          return { ...old[index], [columnId]: value };
        }
        return row;
      })
    );

    // Call API
    try {
      const res = await apiFetch(`/api/data/update_cell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          row_id: rowId,
          column_name: columnId,
          new_value: value === '' ? null : value
        })
      });
      if (!res.ok) {
        throw new Error('수정 실패');
      }
      // Reload to recalculate anomalies
      fetchData();
    } catch (err) {
      alert('수정에 실패했습니다.');
      fetchData(); // Revert
    }
  };


  // For missing tab, filter rows that have any empty/NaN values
  const displayData = activeTab === 'missing' 
    ? data.filter(row => Object.values(row).some(v => v === null || v === ''))
    : data;
    
  const table = useReactTable({
    data: displayData,
    columns,

    getCoreRowModel: getCoreRowModel(),
    meta: {
      updateData,
    },
  });

  const handleReverseCode = async () => {
    if (revSelectedCols.length === 0) {
      alert('역코딩할 변수를 선택해주세요.');
      return;
    }
    setRevLoading(true);
    try {
      const res = await apiFetch(`/api/data/reverse_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: revSelectedCols,
          min_val: revMin,
          max_val: revMax
        })
      });
      if (!res.ok) throw new Error('역코딩 실패');
      
      addAuditLog({
        step: '데이터 전처리',
        action: '역코딩 적용',
        details: { columns: revSelectedCols, min: revMin, max: revMax }
      });

      alert('역코딩이 성공적으로 적용되었습니다.');
      setRevSelectedCols([]);
      fetchData(); // reload anomalies
    } catch (err) {
      alert('역코딩 처리 중 오류가 발생했습니다.');
    } finally {
      setRevLoading(false);
    }
  };

  const toggleRevCol = (col: string) => {
    setRevSelectedCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };



  if (isLoading && data.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>데이터를 불러오는 중입니다...</div>;
  }

  if (error) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>{error} <br/><br/><button className="btn-primary" onClick={() => setCurrentStep('upload')}>업로드로 돌아가기</button></div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '24px' }}>
      
      {/* 상단 공통 액션 바 */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>데이터 클린징</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          

          <button 
            className={`btn-secondary ${activeTab === 'missing' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'missing' ? 'var(--primary)' : '', color: activeTab === 'missing' ? 'white' : '' }}
            onClick={() => setActiveTab('missing')}
          >
            <AlertTriangle size={18} /> 결측치 확인
          </button>
          
          <button 
            className={`btn-secondary ${activeTab === 'profiling' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'profiling' ? 'var(--primary)' : '', color: activeTab === 'profiling' ? 'white' : '' }}
            onClick={() => setActiveTab('profiling')}
          >
            <ArrowLeftRight size={18} /> 데이터 프로파일링 (이상치/코딩변경)
          </button>
          
          <button 
            className={`btn-secondary ${activeTab === 'reverse' ? 'active' : ''}`} 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', background: activeTab === 'reverse' ? 'var(--primary)' : '', color: activeTab === 'reverse' ? 'white' : '' }}
            onClick={() => setActiveTab('reverse')}
          >
            <ArrowLeftRight size={18} /> 역코딩
          </button>

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
          <button className="btn-primary" onClick={handleCompleteCleansing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={18} /> 클린징 완료 (인구통계 사전 처리로 이동) ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: '24px', minWidth: 0 }}>
        
        {/* 결측치 탭 */}
        {activeTab === 'missing' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', minWidth: 0, backgroundColor: 'var(--bg-base)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>결측치 수동 처리</h3>
              <span style={{ color: abnormalCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {abnormalCount > 0 ? `발견된 문제 행: ${abnormalCount}개` : '모든 데이터가 정상입니다!'}
              </span>
            </div>
            
            <div style={{ flex: 1, padding: '16px' }}>
              {abnormalCount === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                  <CheckSquare size={48} style={{ color: 'var(--success)', marginBottom: '16px' }} />
                  <p>결측치나 범위를 벗어난 이상치가 발견되지 않았습니다.</p>
                </div>
              ) : (
                <table style={{ width: 'max-content', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-surface)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--border-color)', zIndex: 1 }}>
                    {table.getHeaderGroups().map(headerGroup => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map(header => (
                          <th key={header.id} style={{ padding: '12px', fontWeight: '500', color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)', minWidth: header.getSize(), whiteSpace: 'nowrap' }}>
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map(row => (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} style={{ padding: '8px', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  </table>
              )}
            </div>
          </div>
        )}

        
        {/* 데이터 프로파일링 탭 */}
        {activeTab === 'profiling' && (
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ color: 'var(--danger)', marginTop: '2px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: 'var(--danger)', fontSize: '15px' }}>통계 분석을 위해 모든 값을 숫자로 변경해주세요!</h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
                  성별(예: '남', '여')이나 척도(예: '매우 그렇다') 같은 문자가 데이터에 섞여 있으면 이후 통계 분석 단계에서 오류가 발생할 수 있습니다.<br/>
                  아래 카드들을 확인하여 막대그래프 옆에 문자가 적혀있는 항목을 클릭한 뒤, 숫자로 일괄 변환(코딩 변경)해 주시기 바랍니다.
                </p>
              </div>
            </div>

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

        {/* 역코딩 탭 */}
        {activeTab === 'reverse' && (
          <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
            <div className="glass-panel" style={{ flex: 1, borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 16px 0' }}>역코딩 대상 변수 선택</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                부정적인 질문 등 점수를 반대로 뒤집어야 하는 설문 문항을 모두 선택해 주세요.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px', flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px', alignContent: 'start' }}>
                {originalColumns.filter(col => !demographicColumns?.includes(col)).map(col => (
                  <label key={col} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'var(--bg-panel)', borderRadius: '8px', cursor: 'pointer', border: revSelectedCols.includes(col) ? '1px solid var(--primary)' : '1px solid transparent', transition: 'all 0.2s' }}>
                    <input 
                      type="checkbox" 
                      checked={revSelectedCols.includes(col)}
                      onChange={() => toggleRevCol(col)}
                      style={{ cursor: 'pointer', marginTop: '4px', flexShrink: 0, width: '16px', height: '16px' }}
                    />
                    <span style={{ lineHeight: '1.5', fontSize: '14px', wordBreak: 'keep-all' }}>{col}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ width: '350px', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ margin: '0 0 24px 0' }}>역코딩 옵션</h3>
              
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>설문 최소값 (Min)</label>
                <input 
                  type="number" 
                  value={revMin} 
                  onChange={e => setRevMin(Number(e.target.value))}
                  className="input-field"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ marginBottom: '32px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>설문 최대값 (Max)</label>
                <input 
                  type="number" 
                  value={revMax} 
                  onChange={e => setRevMax(Number(e.target.value))}
                  className="input-field"
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
                />
              </div>

              <div style={{ padding: '16px', background: 'var(--bg-panel)', borderRadius: '8px', marginBottom: 'auto' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>미리보기 공식</p>
                <code style={{ color: 'var(--primary)' }}>새로운 값 = ({revMax} + {revMin}) - 원래 값</code>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>예: {revMax}점 입력시 {revMin}점으로 변환됨.</p>
              </div>

              <button 
                className="btn-primary" 
                onClick={handleReverseCode}
                disabled={revLoading || revSelectedCols.length === 0}
                style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', marginTop: '24px' }}
              >
                {revLoading ? '처리 중...' : `${revSelectedCols.length}개 변수 역코딩 적용`}
              </button>
            </div>
          </div>
        )}
      </div>
      
    </div>
  );
};
