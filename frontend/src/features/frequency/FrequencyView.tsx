import React, { useState, useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { Download, FileText } from 'lucide-react';

export const FrequencyView: React.FC = () => {
  const { demographicColumns } = useProjectStore();
  const { setCurrentStep } = useUiStore();
  
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [totalN, setTotalN] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!demographicColumns || demographicColumns.length === 0) return;

    const fetchFreq = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analysis/frequency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columns: demographicColumns })
        });
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        setResults(data.frequencies);
        
        // Calculate total N from the first variable (if exists)
        if (Object.keys(data.frequencies).length > 0) {
            const firstVarData = data.frequencies[Object.keys(data.frequencies)[0]];
            const total = firstVarData.reduce((acc: number, curr: any) => acc + curr.count, 0);
            setTotalN(total);
        }
        
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchFreq();
  }, [demographicColumns]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analysis/frequency/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            columns: demographicColumns,
            title: "<표 4-1> 조사대상자의 일반적 특성",
            footer: `총 유효 표본(N) = ${totalN}명`
        })
      });
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'frequency_analysis.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const generateInterpretation = () => {
    if (!results || Object.keys(results).length === 0) return "";
    
    let text = "본 연구의 실증분석에 참여한 조사대상자의 인구통계학적 및 일반적 특성을 파악하기 위해 빈도분석(Frequency Analysis)을 실시한 결과는 <표 4-1>과 같다.\n\n";
    
    let totalN = 0;
    const firstColData = Object.values(results)[0] as any[];
    if (firstColData && firstColData.length > 0) {
        totalN = firstColData.reduce((sum: number, f: any) => sum + f.count, 0);
        text += `총 ${totalN}명의 유효 표본을 대상으로 분석을 진행하였으며, 각 특성별 세부 분포는 다음과 같다.\n\n`;
    }

    Object.entries(results).forEach(([col, freqs]: [string, any], index: number) => {
      if (freqs.length === 0) return;
      
      const sorted = [...freqs].sort((a, b) => b.percent - a.percent);
      const highest = sorted[0];
      const lowest = sorted[sorted.length - 1];
      
      const orderText = index === 0 ? "첫째, " : index === 1 ? "둘째, " : index === 2 ? "셋째, " : "";
      
      text += `${orderText}'${col}'의 경우, '${highest.category}' 집단이 ${highest.count}명(${highest.percent.toFixed(1)}%)으로 전체 응답자 중 가장 높은 비중을 차지하는 것으로 나타났다. `;
      
      if (sorted.length > 2) {
          const second = sorted[1];
          text += `그 다음으로는 '${second.category}' 집단이 ${second.count}명(${second.percent.toFixed(1)}%)으로 뒤를 이었으며, `;
          const others = sorted.slice(2).map(f => `'${f.category}' ${f.count}명(${f.percent.toFixed(1)}%)`).join(', ');
          text += `나머지는 ${others} 순으로 조사되었다. `;
      } else if (sorted.length === 2) {
          text += `반면 '${lowest.category}' 집단은 ${lowest.count}명(${lowest.percent.toFixed(1)}%)으로 상대적으로 낮은 비중을 보였다. `;
      }
      
      text += `\n`;
    });
    
    text += "\n종합해보면, 본 연구의 표본은 특정 집단에 과도하게 편중되지 않고 연구 목적에 부합하는 비교적 적절한 분포를 보이고 있으며, 이는 본 연구의 가설을 검증하고 결과를 일반화하는 데 있어 충분한 대표성을 지닌다고 판단된다.";
    
    return text.trim();
  };

  useEffect(() => {
    if (results && Object.keys(results).length > 0) {
      useAnalysisStore.getState().setCachedResult('frequency', {
        results,
        settings: { totalN },
        interpretation: generateInterpretation()
      });
    }
  }, [results, totalN]);

  if (!demographicColumns || demographicColumns.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>분석할 인구통계 변수가 없습니다.</h2>
        <p>변수 매핑 또는 데이터 클린징 화면에서 일반적 특성(Demographics)을 지정해주세요.</p>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>빈도분석 중...</div>;
  if (!results) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>
      
      {/* 상단 공통 액션 바 */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>빈도분석 (일반적 특성)</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            논문 4장의 첫 번째 표인 조사대상자의 인구통계학적 특성입니다.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            <Download size={18} /> {isExporting ? '다운로드 중...' : '엑셀 다운로드'}
          </button>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setCurrentStep('reliability')}
          >
            신뢰도 분석으로 이동 ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
        
        {/* 왼쪽: 표 영역 */}
        <div className="glass-panel" style={{ flex: '1.2', display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center', backgroundColor: 'var(--bg-surface)' }}>
                <h3 style={{ margin: 0, fontWeight: 'normal' }}>&lt;표 4-1&gt; 조사대상자의 일반적 특성</h3>
            </div>
            
            <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '600px', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '15px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <th colSpan={2} style={{ padding: '12px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>구분</th>
                            <th style={{ padding: '12px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>빈도(N)</th>
                            <th style={{ padding: '12px', fontWeight: 'bold' }}>비율(%)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(results).map(([col, freqs]: [string, any], colIndex) => (
                            <React.Fragment key={col}>
                                {freqs.map((f: any, i: number) => (
                                    <tr key={i} style={{ borderBottom: (colIndex === Object.keys(results).length - 1 && i === freqs.length - 1) ? 'none' : '1px solid var(--border-color)' }}>
                                        {i === 0 && (
                                            <td rowSpan={freqs.length} style={{ padding: '8px', borderRight: '1px solid var(--border-color)', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                                                {col}
                                            </td>
                                        )}
                                        <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{f.category}</td>
                                        <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{f.count}</td>
                                        <td style={{ padding: '8px' }}>{f.percent.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        <tr style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                            <td colSpan={2} style={{ padding: '12px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>전체</td>
                            <td style={{ padding: '12px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>{totalN}</td>
                            <td style={{ padding: '12px', fontWeight: 'bold' }}>100.0</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        {/* 오른쪽: 자동 해석 영역 */}
        <div className="glass-panel" style={{ flex: '0.8', display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <FileText size={24} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0 }}>논문 텍스트 자동 해석</h3>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
                우측의 빈도분석 표를 바탕으로 논문에 즉시 복사하여 사용할 수 있는 초안 텍스트입니다. 결과 해석에 참고하시기 바랍니다.
            </p>
            
            <div 
                style={{ 
                    flex: 1, 
                    backgroundColor: 'var(--bg-base)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '24px',
                    fontSize: '15px',
                    lineHeight: '1.8',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap'
                }}
                contentEditable
                suppressContentEditableWarning
            >
                {generateInterpretation()}
            </div>
            
            <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>
                * 텍스트 영역을 클릭하여 내용을 직접 수정하거나 복사할 수 있습니다.
            </div>
        </div>

      </div>
    </div>
  );
};
