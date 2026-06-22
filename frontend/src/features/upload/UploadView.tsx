import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { UploadCloud, FileSpreadsheet, CheckCircle } from 'lucide-react';

export const UploadView: React.FC = () => {
  const { setCurrentStep } = useUiStore();
  const { setOriginalColumns, resetProject } = useProjectStore();
  const { resetStore } = useAnalysisStore();
  const [file, setFile] = useState<File | null>(null);
  
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/upload`, {
          method: 'POST',
          body: formData
        });
        
        if (!res.ok) throw new Error('업로드 실패');
        
        const data = await res.json();
        resetProject(); // 프로젝트 상태 초기화
        setOriginalColumns(data.columns); // 백엔드에서 파싱한 실제 컬럼 목록 저장
        resetStore(); // 새 파일이 업로드되었으므로 기존 분석 결과, 모형, 매핑을 모두 리셋

      } catch (err) {
        console.error(err);
        alert('파일 업로드 및 파싱에 실패했습니다.');
      }
    }
  }, [setOriginalColumns]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    },
    maxFiles: 1
  });

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '24px' }}>
      
      {/* 상단 공통 액션 바 (Spotfire 스타일) */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>데이터 업로드</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            분석할 엑셀(.xlsx) 또는 CSV 파일을 업로드하세요.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {file && (
            <button 
              className="btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={() => setCurrentStep('cleansing')}
            >
              데이터 클린징으로 이동 ▶
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div 
            {...getRootProps()} 
            style={{
              border: `2px dashed ${isDragActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '16px',
              padding: '64px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              backgroundColor: isDragActive ? 'var(--bg-active)' : 'transparent',
              transition: 'all var(--transition-fast)',
              cursor: 'pointer'
            }}
          >
            <input {...getInputProps()} />
            
            {file ? (
              <>
                <FileSpreadsheet size={64} color="var(--success)" />
                <div style={{ textAlign: 'center' }}>
                  <h2 className="text-h2" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <CheckCircle size={20} /> 업로드 완료
                  </h2>
                  <p className="text-body" style={{ marginTop: '8px' }}>
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
              </>
            ) : (
              <>
                <UploadCloud size={64} color={isDragActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <div style={{ textAlign: 'center' }}>
                  <h2 className="text-h2" style={{ color: isDragActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                    클릭하거나 파일을 이곳에 드롭하세요
                  </h2>
                  <p className="text-body" style={{ marginTop: '8px' }}>
                    지원되는 파일: .xlsx, .csv (최대 100MB)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
