import React, { useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { generateAiInterpretation } from '../utils/apiClient';
import { useAnalysisStore } from '../store/analysisStore';

interface AiInterpretationPanelProps {
  analysisType: string;
  results: any;
  cacheKey: string;
  defaultText: string;
}

export const AiInterpretationPanel: React.FC<AiInterpretationPanelProps> = ({ 
  analysisType, 
  results, 
  cacheKey, 
  defaultText 
}) => {
  const { cachedResults, setCachedResult } = useAnalysisStore();
  const cachedAi = cachedResults[cacheKey]?.aiInterpretation;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const text = await generateAiInterpretation(analysisType, results);
      setCachedResult(cacheKey, { aiInterpretation: text });
    } catch (err: any) {
      setError(err.message || 'AI 해석 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const textToDisplay = cachedAi || defaultText;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, flex: 1, paddingRight: '16px' }}>
          우측 표를 바탕으로 논문에 즉시 복사하여 사용할 수 있는 해석문입니다. (AI 심층 해석을 권장합니다)
        </p>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '14px', whiteSpace: 'nowrap' }}
          onClick={handleGenerate}
          disabled={loading}
        >
          {loading ? <RefreshCw size={16} className="spin" /> : <Bot size={16} />}
          {loading ? 'AI 분석 중...' : (cachedAi ? 'AI 재해석' : '🤖 AI 심층 해석 (Beta)')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(255, 77, 79, 0.1)', border: '1px solid #ff4d4f', color: '#ff4d4f', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div
        style={{
          flex: 1,
          backgroundColor: cachedAi ? 'rgba(0, 102, 255, 0.02)' : 'var(--bg-base)',
          border: cachedAi ? '1px solid rgba(0, 102, 255, 0.3)' : '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '24px',
          fontSize: '15px',
          lineHeight: '1.8',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          boxShadow: cachedAi ? 'inset 0 0 10px rgba(0, 102, 255, 0.05)' : 'none'
        }}
        contentEditable
        suppressContentEditableWarning
      >
        {textToDisplay}
      </div>
      
      {cachedAi && (
        <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '12px', color: 'var(--primary)', fontWeight: 'bold' }}>
          ✨ Gemini 2.0 AI가 작성한 맞춤형 심층 해석입니다.
        </div>
      )}
    </>
  );
};
