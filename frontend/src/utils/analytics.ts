// Google Analytics 4 - Custom Event Tracking Utility
// 사용자 행동 퍼널을 추적하기 위한 커스텀 이벤트 함수

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

const gtag = (...args: any[]) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
};

// ── Funnel Events ──────────────────────────────────────

/** 1단계: 엑셀 파일 업로드 완료 */
export const trackFileUploaded = (fileName: string, rowCount: number, colCount: number) => {
  gtag('event', 'file_uploaded', {
    file_name: fileName,
    row_count: rowCount,
    col_count: colCount,
  });
};

/** 2단계: 데이터 클린징 완료 */
export const trackCleansingCompleted = (recodeCount: number) => {
  gtag('event', 'cleansing_completed', {
    recode_count: recodeCount,
  });
};

/** 3단계: 변수 매핑 완료 */
export const trackMappingCompleted = (variableCount: number) => {
  gtag('event', 'mapping_completed', {
    variable_count: variableCount,
  });
};

/** 4단계: 연구모형 빌더 완료 */
export const trackModelBuilt = (hypothesisCount: number) => {
  gtag('event', 'model_built', {
    hypothesis_count: hypothesisCount,
  });
};

/** 5단계: 요인분석 실행 */
export const trackFactorAnalysisRun = (method: string, rotation: string, factorCount: number) => {
  gtag('event', 'factor_analysis_run', {
    method,
    rotation,
    factor_count: factorCount,
  });
};

/** 6단계: 신뢰도 분석 확인 */
export const trackReliabilityChecked = (avgAlpha: number) => {
  gtag('event', 'reliability_checked', {
    avg_alpha: avgAlpha,
  });
};

/** 7단계: 회귀분석 실행 */
export const trackRegressionRun = (type: string) => {
  gtag('event', 'regression_run', {
    analysis_type: type,
  });
};

/** 8단계: 매개/조절효과 분석 실행 */
export const trackMediationRun = (type: string, useBootstrap: boolean) => {
  gtag('event', 'mediation_run', {
    analysis_type: type,
    use_bootstrap: useBootstrap,
  });
};

/** 9단계: 보고서 다운로드 */
export const trackReportDownloaded = (format: string) => {
  gtag('event', 'report_downloaded', {
    format,
  });
};

// ── General Events ─────────────────────────────────────

/** 메뉴 이동 추적 */
export const trackPageView = (stepName: string) => {
  gtag('event', 'page_view', {
    page_title: stepName,
    page_location: window.location.href,
  });
};

/** Excel 내보내기 추적 */
export const trackExcelExport = (tableName: string) => {
  gtag('event', 'excel_export', {
    table_name: tableName,
  });
};
