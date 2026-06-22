import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AnalysisStep = 
  | 'upload' 
  | 'cleansing' 
  | 'demographics'
  | 'mapping' 
  | 'model'
  | 'frequency'
  | 'factor' 
  | 'reliability' 
  | 'correlation' 
  | 'ttest' 
  | 'anova' 
  | 'regression' 
  | 'mediation' 
  | 'moderation'
  | 'report';

interface UiState {
  currentStep: AnalysisStep;
  isFlyoutOpen: boolean;
  
  // Actions
  setCurrentStep: (step: AnalysisStep) => void;
  toggleFlyout: () => void;
  setFlyoutOpen: (isOpen: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      currentStep: 'upload', // 기본 시작 단계
      isFlyoutOpen: false,

      setCurrentStep: (step) => set({ 
        currentStep: step,
        // 분석 단계 전환 시 기본적으로 Flyout을 열어 분석 옵션을 보여줌
        isFlyoutOpen: ['frequency', 'factor', 'reliability', 'correlation', 'ttest', 'anova', 'regression', 'mediation', 'moderation'].includes(step) 
      }),
      
      toggleFlyout: () => set((state) => ({ isFlyoutOpen: !state.isFlyoutOpen })),
      
      setFlyoutOpen: (isOpen) => set({ isFlyoutOpen: isOpen }),
    }),
    {
      name: 'ui-storage', // localStorage에 저장될 키 이름
    }
  )
);
