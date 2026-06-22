import React from 'react';
import { useUiStore } from '../../store/uiStore';
import { X, Pin } from 'lucide-react';
import styles from './Layout.module.css';

export const FlyoutPanel: React.FC = () => {
  const { isFlyoutOpen, toggleFlyout, currentStep } = useUiStore();

  return (
    <aside className={`${styles.flyout} ${isFlyoutOpen ? styles.open : ''} glass-panel`}>
      <div className={styles.flyoutHeader}>
        <div className="flex-center" style={{ gap: '8px' }}>
          <button className="btn-icon" onClick={toggleFlyout}>
            <X size={20} />
          </button>
          <span className="text-h3">
            {currentStep === 'upload' ? '업로드 설정' :
             currentStep === 'frequency' ? '빈도분석 옵션' :
             currentStep === 'factor' ? '요인분석 설정' :
             currentStep === 'reliability' ? '신뢰도 분석 옵션' : '분석 옵션'}
          </span>
        </div>
        <button className="btn-icon">
          <Pin size={18} />
        </button>
      </div>
      
      <div className={styles.flyoutContent}>
        {/* 임시 콘텐츠: 추후 각 분석 단계별 상세 옵션 컴포넌트로 교체 */}
        <p className="text-body">
          여기에 {currentStep}에 해당하는 구체적인 설정 항목들이 들어갑니다.
        </p>
        
        {currentStep === 'factor' && (
          <div style={{ marginTop: '20px', color: 'var(--text-muted)' }}>
            <p>요인분석 옵션은 메인 화면의 우측 패널에서 설정할 수 있습니다.</p>
          </div>
        )}
      </div>
    </aside>
  );
};
