import React, { useState, useEffect } from 'react';
import { useReactTable, getCoreRowModel, flexRender, type ColumnDef } from '@tanstack/react-table';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { AlertTriangle, ArrowLeftRight, CheckSquare } from 'lucide-react';
import { EditableCell } from './components/EditableCell';

export const CleansingView: React.FC = () => {
  const { setCurrentStep } = useUiStore();
  const { originalColumns, demographicColumns } = useProjectStore();
  
  const [activeTab, setActiveTab] = useState<'anomalies' | 'reverse'>('anomalies');
  
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
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/smart`, { cache: 'no-store', headers: { 'Pragma': 'no-cache' } })
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

  const updateData = async (rowId: number, columnId: string, value: any) => {
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/update_cell`, {
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

  const table = useReactTable({
    data,
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/data/reverse_code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columns: revSelectedCols,
          min_val: revMin,
          max_val: revMax
        })
      });
      if (!res.ok) throw new Error('역코딩 실패');
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
          <button className="btn-primary" onClick={() => setCurrentStep('demographics')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={18} /> 클린징 완료 (인구통계 사전 처리로 이동) ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: '24px', minWidth: 0 }}>
        
        {/* 이상치/결측치 탭 */}
        {activeTab === 'anomalies' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', minWidth: 0, backgroundColor: 'var(--bg-base)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>이상치 및 결측치 수동 처리</h3>
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

        {/* 역코딩 탭 */}
        {activeTab === 'reverse' && (
          <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
            <div className="glass-panel" style={{ flex: 1, borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: '0 0 16px 0' }}>역코딩 대상 변수 선택</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
                부정적인 질문 등 점수를 반대로 뒤집어야 하는 설문 문항을 모두 선택해 주세요.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
                {originalColumns.filter(col => !demographicColumns?.includes(col)).map(col => (
                  <label key={col} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'var(--bg-panel)', borderRadius: '8px', cursor: 'pointer', border: revSelectedCols.includes(col) ? '1px solid var(--primary)' : '1px solid transparent' }}>
                    <input 
                      type="checkbox" 
                      checked={revSelectedCols.includes(col)}
                      onChange={() => toggleRevCol(col)}
                      style={{ cursor: 'pointer' }}
                    />
                    {col}
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
