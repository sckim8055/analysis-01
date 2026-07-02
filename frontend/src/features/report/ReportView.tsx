import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useProjectStore } from '../../store/projectStore';

export const ReportView: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [reportFormat, setReportFormat] = useState<'word' | 'excel'>('word');
  
  const analysisState = useAnalysisStore();
  const projectState = useProjectStore();
  
  const handleDownload = async () => {
    setIsExporting(true);
    try {
      // API call to backend to generate report
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analysis/full-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: reportFormat,
          project_config: {
            demographicColumns: projectState.demographicColumns,
            mappedVars: analysisState.mappedVars,
            excludedItems: analysisState.excludedItems,
            factorResults: analysisState.factorResults,
            savedModelEdges: analysisState.savedModelEdges,
          },
          auditLogs: analysisState.auditLogs,
          cachedResults: analysisState.cachedResults
        }),
      });

      if (!response.ok) {
        throw new Error('보고서 생성에 실패했습니다.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Full_Report.${reportFormat === 'word' ? 'docx' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error(error);
      alert('보고서 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>
      <div className="glass-panel" style={{ padding: '32px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>전체 결과 보고서 다운로드</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
          파일 업로드부터 현재까지 진행된 모든 분석 결과(표 및 해석)를 하나의 파일로 병합하여 다운로드합니다.
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '32px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="format" 
              value="word" 
              checked={reportFormat === 'word'} 
              onChange={() => setReportFormat('word')} 
            />
            <span>Word 문서 (.docx) - 논문 양식</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="format" 
              value="excel" 
              checked={reportFormat === 'excel'} 
              onChange={() => setReportFormat('excel')} 
            />
            <span>Excel 문서 (.xlsx) - 다중 시트</span>
          </label>
        </div>

        <button 
          className="btn-primary" 
          style={{ padding: '12px 32px', fontSize: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          onClick={handleDownload}
          disabled={isExporting}
        >
          <Download size={20} />
          {isExporting ? '보고서 생성 중...' : '보고서 다운로드'}
        </button>
      </div>
    </div>
  );
};
