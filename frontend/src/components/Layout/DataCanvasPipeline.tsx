import React from 'react';
import { useUiStore, type AnalysisStep } from '../../store/uiStore';
import { Check, Dot } from 'lucide-react';
import styles from './Layout.module.css';

const pipelineSteps: { id: AnalysisStep; label: string }[] = [
  { id: 'upload', label: '업로드' },
  { id: 'cleansing', label: '클린징' },
  { id: 'demographics', label: '인구통계' },
  { id: 'mapping', label: '매핑' },
  { id: 'factor', label: '요인분석' },
];

export const DataCanvasPipeline: React.FC = () => {
  const { currentStep, setCurrentStep } = useUiStore();
  
  // 간단한 완료 로직 (현재 스텝 기준)
  const currentIndex = pipelineSteps.findIndex(s => s.id === currentStep);

  return (
    <div className={`${styles.pipeline} glass`}>
      {pipelineSteps.map((step, idx) => {
        const isCompleted = currentIndex > idx || (idx === 4 && currentIndex >= 4);
        const isActive = currentStep === step.id;
        
        return (
          <React.Fragment key={step.id}>
            <div 
              className={styles.pipelineNode} 
              onClick={() => setCurrentStep(step.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className={`${styles.nodeCircle} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}>
                {isCompleted ? <Check size={14} color="white" /> : <Dot size={20} color={isActive ? "var(--accent-primary)" : "var(--text-muted)"} />}
              </div>
              <span className={isActive ? 'text-small' : 'text-small'} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }}>
                {step.label}
              </span>
            </div>
            
            {/* 연결선 */}
            {idx < pipelineSteps.length - 1 && (
              <div className={styles.pipelineEdge} style={{ background: isCompleted ? 'var(--success)' : 'var(--border-color)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
