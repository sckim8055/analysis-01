import React from 'react';
import { useAnalysisStore } from '../../../store/analysisStore';

export const FactorAnalysisOptions: React.FC = () => {
  const { factorSettings, setFactorSettings, runAnalysisTrigger } = useAnalysisStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label className="text-small" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>요인추출</span>
          <span style={{ color: 'var(--text-secondary)' }}>주성분분석(PCA)</span>
        </label>
      </div>
      <div>
        <label className="text-small">요인회전</label>
        <select 
          value={factorSettings.rotation}
          onChange={(e) => setFactorSettings({ rotation: e.target.value as any })}
          style={{ width: '100%', padding: '8px', background: 'var(--bg-base)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px' }}
        >
          <option value="varimax">Varimax (직교)</option>
          <option value="oblimin">Oblimin (사각)</option>
        </select>
      </div>
      <div>
        <label className="text-small" style={{ display: 'block', marginBottom: '8px' }}>요인 추출 기준</label>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
            <input type="radio" name="extractionCriterion" value="eigenvalue" checked={factorSettings.extractionCriterion === 'eigenvalue'} onChange={() => setFactorSettings({ extractionCriterion: 'eigenvalue' })} style={{ accentColor: 'var(--accent-primary)' }} />
            고유값 기준
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
            <input type="radio" name="extractionCriterion" value="fixedNumber" checked={factorSettings.extractionCriterion === 'fixedNumber'} onChange={() => setFactorSettings({ extractionCriterion: 'fixedNumber' })} style={{ accentColor: 'var(--accent-primary)' }} />
            고정된 요인수
          </label>
        </div>
        
        {factorSettings.extractionCriterion === 'eigenvalue' ? (
          <div>
            <label className="text-small" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>고유값 임계치</span>
              <span>{factorSettings.eigenvalueThreshold}</span>
            </label>
            <input 
              type="range" min="0" max="2" step="0.1" 
              value={factorSettings.eigenvalueThreshold} 
              onChange={(e) => setFactorSettings({ eigenvalueThreshold: parseFloat(e.target.value) })}
              style={{ width: '100%', marginTop: '4px' }} 
            />
          </div>
        ) : (
          <div>
            <label className="text-small" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>추출할 요인 수</span>
              <span>{factorSettings.fixedFactorCount}개</span>
            </label>
            <input 
              type="range" min="1" max="10" step="1" 
              value={factorSettings.fixedFactorCount} 
              onChange={(e) => setFactorSettings({ fixedFactorCount: parseInt(e.target.value) })}
              style={{ width: '100%', marginTop: '4px' }} 
            />
          </div>
        )}
      </div>
      <div>
        <label className="text-small" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>요인적재값 기준</span>
          <span>{factorSettings.loading}</span>
        </label>
        <input 
          type="range" min="0.1" max="0.9" step="0.05" 
          value={factorSettings.loading} 
          onChange={(e) => setFactorSettings({ loading: parseFloat(e.target.value) })}
          style={{ width: '100%', marginTop: '4px' }} 
        />
      </div>
      <div>
        <label className="text-small" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>공통성 기준</span>
          <span>{factorSettings.communality}</span>
        </label>
        <input 
          type="range" min="0.1" max="0.9" step="0.05" 
          value={factorSettings.communality} 
          onChange={(e) => setFactorSettings({ communality: parseFloat(e.target.value) })}
          style={{ width: '100%', marginTop: '4px' }} 
        />
      </div>
      <div>
        <label className="text-small" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>분산설명력 기준 (%)</span>
          <span>{factorSettings.variance}%</span>
        </label>
        <input 
          type="range" min="10" max="100" step="5" 
          value={factorSettings.variance} 
          onChange={(e) => setFactorSettings({ variance: parseInt(e.target.value) })}
          style={{ width: '100%', marginTop: '4px' }} 
        />
      </div>

      <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
        <label className="text-small" style={{ display: 'block', marginBottom: '12px', color: 'var(--accent-primary)' }}>계수 출력 형식</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <input 
            type="checkbox" 
            id="sortBySize" 
            checked={factorSettings.sortBySize}
            onChange={(e) => setFactorSettings({ sortBySize: e.target.checked })}
            style={{ accentColor: 'var(--accent-primary)' }}
          />
          <label htmlFor="sortBySize" className="text-small">크기순 정렬</label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <input 
            type="checkbox" 
            id="hideSmallCoefficients" 
            checked={factorSettings.hideSmallCoefficients}
            onChange={(e) => setFactorSettings({ hideSmallCoefficients: e.target.checked })}
            style={{ accentColor: 'var(--accent-primary)' }}
          />
          <label htmlFor="hideSmallCoefficients" className="text-small">작은 계수 출력 안 함</label>
        </div>
        {factorSettings.hideSmallCoefficients && (
          <div style={{ paddingLeft: '24px', paddingBottom: '8px' }}>
            <label className="text-small" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>절대값 기준</span>
              <span>{factorSettings.smallCoefficientThreshold}</span>
            </label>
            <input 
              type="range" min="0.1" max="0.9" step="0.05" 
              value={factorSettings.smallCoefficientThreshold} 
              onChange={(e) => setFactorSettings({ smallCoefficientThreshold: parseFloat(e.target.value) })}
              style={{ width: '100%', marginTop: '4px' }} 
            />
          </div>
        )}
      </div>
      
      <button 
        className="btn-primary" 
        style={{ marginTop: '8px' }} 
        onClick={() => {
          runAnalysisTrigger();
        }}
      >
        자동 분석 재실행 ▶
      </button>
    </div>
  );
};
