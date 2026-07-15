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
  const [viewMode, setViewMode] = useState<'basic' | 'ai'>(cachedAi ? 'ai' : 'basic');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash');

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setViewMode('ai');
    try {
      const text = await generateAiInterpretation(analysisType, results, undefined, selectedModel);
      setCachedResult(cacheKey, { aiInterpretation: text });
    } catch (err: any) {
      setError(err.message || 'AI 해석 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const textToDisplay = viewMode === 'ai' && cachedAi ? cachedAi : defaultText;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: viewMode === 'basic' ? 'bold' : 'normal' }}>
            <input 
              type="radio" 
              checked={viewMode === 'basic'} 
              onChange={() => setViewMode('basic')} 
              style={{ accentColor: 'var(--primary)' }}
            />
            APA 7th 기본 해석
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: viewMode === 'ai' ? 'bold' : 'normal' }}>
            <input 
              type="radio" 
              checked={viewMode === 'ai'} 
              onChange={() => setViewMode('ai')} 
              style={{ accentColor: 'var(--primary)' }}
            />
            AI 해석(GPT)
          </label>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select 
            value={selectedModel} 
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', fontSize: '13px', color: 'var(--text-primary)' }}
          >
            <option value="gemini-1.5-flash">Gemini 1.5 Flash (빠름, 안정적)</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash (최신 모델)</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro (고성능)</option>
          </select>
          <button
            className={viewMode === 'ai' ? "btn-primary" : "btn-secondary"}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading && <RefreshCw size={14} className="spin" />}
            {loading ? 'AI 분석 중...' : (cachedAi ? 'AI 재해석' : 'AI 해석 생성')}
          </button>
        </div>
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
