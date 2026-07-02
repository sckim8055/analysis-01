import React from 'react';
import { useUiStore } from '../../store/uiStore';
import { UploadView } from '../upload/UploadView';
import { CleansingView } from '../cleansing/CleansingView';
import { DemographicsView } from '../demographics/DemographicsView';
import { MappingView } from '../mapping/MappingView';
import { ModelBuilderView } from '../model/ModelBuilderView';
import { FactorAnalysisView } from '../factor/FactorAnalysisView';

import { FrequencyView } from '../frequency/FrequencyView';
import { ReliabilityView } from '../reliability/ReliabilityView';
import { CorrelationView } from '../correlation/CorrelationView';
import { TTestAnovaView } from '../ttest/TTestAnovaView';
import { RegressionView } from '../regression/RegressionView';
import { MediationView } from '../mediation/MediationView';
import { ModerationView } from '../mediation/ModerationView';
import { ModeratedMediationView } from '../mediation/ModeratedMediationView';
import { ReportView } from '../report/ReportView';

// 임시 뷰 컴포넌트들
const EmptyView = ({ name }: { name: string }) => <div className="p-8 text-center text-h2 text-muted">{name} 기능 준비 중...</div>;

export const Workspace: React.FC = () => {
  const { currentStep } = useUiStore();

  const renderContent = () => {
    switch (currentStep) {
      case 'upload': return <UploadView />;
      case 'cleansing': return <CleansingView />;
      case 'demographics': return <DemographicsView />;
      case 'mapping': return <MappingView />;
      case 'model': return <ModelBuilderView />;
      case 'factor': return <FactorAnalysisView />;
      case 'frequency': return <FrequencyView />;
      case 'reliability': return <ReliabilityView />;
      case 'correlation': return <CorrelationView />;
      case 'ttest': return <TTestAnovaView />;
      case 'anova': return <TTestAnovaView />;
      case 'regression': return <RegressionView />;
      case 'mediation': return <MediationView />;
      case 'moderation': return <ModerationView />;
      case 'moderated_mediation': return <ModeratedMediationView />;
      case 'report': return <ReportView />;
      default: return <EmptyView name="알 수 없는" />;
    }
  };

  return (
    <div style={{ padding: '24px', width: '100%', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 캔버스 상단 타이틀 */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="text-h1">{
          currentStep === 'upload' ? '데이터 업로드' :
          currentStep === 'cleansing' ? '데이터 클린징' :
          currentStep === 'demographics' ? '인구통계 사전 처리' :
          currentStep === 'mapping' ? '변수 매핑' :
          currentStep === 'model' ? '연구 모형 빌더' :
          currentStep === 'factor' ? '탐색적 요인분석' :
          currentStep
        }</h1>
      </div>
      
      {/* 캔버스 본문 (Glassmorphism 컨테이너) */}
      <div className="glass" style={{ width: '100%', flex: 1, borderRadius: '12px', display: 'flex', overflow: 'hidden' }}>
        {renderContent()}
      </div>
    </div>
  );
};
