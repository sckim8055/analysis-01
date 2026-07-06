import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { UploadCloud, FileSpreadsheet, CheckCircle, Link } from 'lucide-react';

export const UploadView: React.FC = () => {
  const { setCurrentStep } = useUiStore();
  const { setOriginalColumns, resetProject } = useProjectStore();
  const { resetStore } = useAnalysisStore();
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [uploadSource, setUploadSource] = useState<'file' | 'url' | null>(null);
  const [previewData, setPreviewData] = useState<{head: any[], tail: any[], columns: string[], rowCount: number} | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  
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
        setUploadSource('file');
        setPreviewData({
          head: data.preview_head || [],
          tail: data.preview_tail || [],
          columns: data.columns || [],
          rowCount: data.row_count || 0
        });

      } catch (err) {
        console.error(err);
        alert('파일 업로드 및 파싱에 실패했습니다.');
      }
    }
  }, [setOriginalColumns]);

  const handleUrlImport = async () => {
    if (!sheetUrl.trim()) {
      alert('구글 스프레드시트 링크를 입력해주세요.');
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/import_url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sheetUrl })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || '링크 불러오기 실패');
      }
      
      const data = await res.json();
      resetProject();
      setOriginalColumns(data.columns);
      resetStore();
      
      setFile(new File([], 'imported_from_url.csv')); // 뷰 상태를 위해 더미 파일 객체 세팅
      setUploadSource('url');
      setPreviewData({
        head: data.preview_head || [],
        tail: data.preview_tail || [],
        columns: data.columns || [],
        rowCount: data.row_count || 0
      });
      
    } catch (err: any) {
      console.error(err);
      alert(err.message || '링크에서 데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '24px', paddingBottom: '40px', gap: '32px', overflowY: 'auto' }}>
        
        {/* 업로드 박스 영역 (항상 고정 크기 유지) */}
        <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '8px' }}>
            <button 
              className={`btn-secondary ${uploadMode === 'file' ? 'active' : ''}`}
              style={{ padding: '12px 24px', borderRadius: '24px', background: uploadMode === 'file' ? 'var(--primary)' : 'var(--bg-panel)', color: uploadMode === 'file' ? 'white' : 'var(--text-primary)', border: uploadMode === 'file' ? 'none' : '1px solid var(--border-color)', fontSize: '15px', fontWeight: 'bold' }}
              onClick={() => setUploadMode('file')}
            >
              내 PC 파일 업로드
            </button>
            <button 
              className={`btn-secondary ${uploadMode === 'url' ? 'active' : ''}`}
              style={{ padding: '12px 24px', borderRadius: '24px', background: uploadMode === 'url' ? 'var(--primary)' : 'var(--bg-panel)', color: uploadMode === 'url' ? 'white' : 'var(--text-primary)', border: uploadMode === 'url' ? 'none' : '1px solid var(--border-color)', fontSize: '15px', fontWeight: 'bold' }}
              onClick={() => setUploadMode('url')}
            >
              구글 링크 연동
            </button>
          </div>
          
          {uploadMode === 'file' ? (
          <div 
            {...getRootProps()} 
            style={{
              border: `2px dashed ${isDragActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              borderRadius: '16px',
              padding: (file && uploadSource === 'file') ? '32px' : '64px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              backgroundColor: isDragActive ? 'var(--bg-active)' : 'var(--bg-panel)',
              transition: 'all var(--transition-fast)',
              cursor: 'pointer'
            }}
          >
            <input {...getInputProps()} />
            
            {file && uploadSource === 'file' ? (
              <>
                <FileSpreadsheet size={48} color="var(--success)" />
                <div style={{ textAlign: 'center' }}>
                  <h2 className="text-h2" style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', margin: '0 0 8px 0' }}>
                    <CheckCircle size={20} /> 업로드 완료
                  </h2>
                  <p className="text-body" style={{ margin: 0 }}>
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
              </>
            ) : (
              <>
                <UploadCloud size={64} color={isDragActive ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                <div style={{ textAlign: 'center' }}>
                  <h2 className="text-h2" style={{ color: isDragActive ? 'var(--accent-primary)' : 'var(--text-primary)', margin: '0 0 8px 0' }}>
                    클릭하거나 파일을 이곳에 드롭하세요
                  </h2>
                  <p className="text-body" style={{ margin: 0 }}>
                    지원되는 파일: .xlsx, .csv (최대 100MB)
                  </p>
                </div>
              </>
            )}
          </div>
          ) : (
          <div style={{
            border: '2px dashed var(--border-color)',
            borderRadius: '16px',
            padding: (file && uploadSource === 'url') ? '32px' : '64px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            backgroundColor: 'var(--bg-panel)',
          }}>
            {file && uploadSource === 'url' ? (
              <>
                <CheckCircle size={48} color="var(--success)" />
                <div style={{ textAlign: 'center' }}>
                  <h2 className="text-h2" style={{ color: 'var(--success)', margin: '0 0 8px 0' }}>
                    구글 링크 데이터 가져오기 완료
                  </h2>
                </div>
              </>
            ) : (
              <>
                <Link size={64} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                <div style={{ textAlign: 'center' }}>
                  <h2 className="text-h2" style={{ color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
                    구글 스프레드시트 공유 링크 입력
                  </h2>
                  <p className="text-body" style={{ margin: 0, lineHeight: '1.5' }}>
                    설문지 응답 시트의 주소를 복사해서 붙여넣으세요.<br/>
                    (보기 권한이 '링크가 있는 모든 사용자'로 설정되어 있어야 합니다.)
                  </p>
                </div>
              </>
            )}
            
            <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '600px', marginTop: (file && uploadSource === 'url') ? '0' : '16px' }}>
              <input 
                type="text" 
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                style={{ flex: 1, padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '15px' }}
              />
              <button 
                className="btn-primary" 
                onClick={handleUrlImport}
                disabled={isLoading || !sheetUrl.trim()}
                style={{ padding: '0 32px', whiteSpace: 'nowrap', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}
              >
                {isLoading ? '불러오는 중...' : '데이터 가져오기'}
              </button>
            </div>
            
            {!(file && uploadSource === 'url') && (
              <div style={{ width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px' }}>
                <button 
                  onClick={() => setShowGuide(!showGuide)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}
                >
                  💡 구글 링크를 어떻게 가져오나요?
                </button>
                
                {showGuide && (
                  <div style={{ marginTop: '16px', padding: '20px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)', textAlign: 'left', fontSize: '14px', lineHeight: '1.6', width: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)' }}>📌 구글 링크 가져오는 5단계 방법</h4>
                    <ol style={{ margin: 0, paddingLeft: '24px', color: 'var(--text-secondary)' }}>
                      <li style={{ marginBottom: '8px' }}>구글 설문지 편집 화면의 <strong>[응답]</strong> 탭으로 이동합니다.</li>
                      <li style={{ marginBottom: '8px' }}>우측 상단의 초록색 <strong>[Sheets에 연결]</strong>을 눌러 스프레드시트를 엽니다.</li>
                      <li style={{ marginBottom: '8px' }}>열린 스프레드시트 우측 상단의 <strong>[공유]</strong> 버튼을 누릅니다.</li>
                      <li style={{ marginBottom: '8px' }}>일반 액세스를 '제한됨'에서 <strong>[링크가 있는 모든 사용자]</strong>로 변경합니다.</li>
                      <li>옆의 <strong>[링크 복사]</strong>를 눌러 복사한 뒤, 위의 주소창에 붙여넣습니다.</li>
                    </ol>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>

        {/* 하단 미리보기 테이블 영역 (넓게 표시) */}
        {file && previewData && (
          <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 24px', minHeight: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)' }}>데이터 미리보기 (총 {previewData.rowCount.toLocaleString()}행 / {previewData.columns.length}개 변수)</h3>
            </div>
            
            <div style={{ width: '100%', height: '100%', overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-panel)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left', whiteSpace: 'nowrap' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 2 }}>
                  <tr>
                    <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>#</th>
                    {previewData.columns.map((col, idx) => (
                      <th key={idx} style={{ padding: '12px 16px', fontWeight: 'bold' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.head.map((row, rIdx) => (
                    <tr key={`h-${rIdx}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>{rIdx + 1}</td>
                      {previewData.columns.map((col, cIdx) => (
                        <td key={cIdx} style={{ padding: '10px 16px' }}>{row[col] !== null ? String(row[col]) : ''}</td>
                      ))}
                    </tr>
                  ))}
                  
                  {previewData.rowCount > 10 && (
                    <tr>
                      <td colSpan={previewData.columns.length + 1} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', fontWeight: 'bold', letterSpacing: '2px' }}>
                        ... 중략 ...
                      </td>
                    </tr>
                  )}
                  
                  {previewData.tail.map((row, rIdx) => (
                    <tr key={`t-${rIdx}`} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}>{previewData.rowCount - previewData.tail.length + rIdx + 1}</td>
                      {previewData.columns.map((col, cIdx) => (
                        <td key={cIdx} style={{ padding: '10px 16px' }}>{row[col] !== null ? String(row[col]) : ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
