export interface FactorSettings {
  extractionCriterion?: string;
  fixedFactorCount?: number;
  loading: number;
  sortBySize?: boolean;
}

export interface MockMatrixItem {
  id: string;
  loadings: number[];
}

export interface MockAnalysisResult {
  factorNames: string[];
  matrixItems: MockMatrixItem[];
  droppedItems: string[];
}

export const runMockFactorAnalysis = (
  itemsArray: string[], 
  factorSettings: FactorSettings,
  seed?: number
): MockAnalysisResult => {
  if (!itemsArray || itemsArray.length === 0) {
    return { factorNames: [], matrixItems: [], droppedItems: [] };
  }

  // 예측 가능성을 위한 간단한 모의 난수 발생기 (테스트 용이성 확보)
  let currentSeed = seed ?? Math.random();
  const random = () => {
    const x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };

  const numFactors = factorSettings.extractionCriterion === 'fixedNumber'
    ? (factorSettings.fixedFactorCount || 1)
    : Math.max(1, Math.floor(itemsArray.length / 3));
    
  const fNames = Array.from({ length: numFactors }).map((_, i) => `요인 ${i + 1}`);
  const newMatrix: MockMatrixItem[] = [];
  const newDropped: string[] = [];

  itemsArray.forEach(id => {
    const targetFactor = Math.floor(random() * numFactors);
    const mainLoading = 0.4 + (random() * 0.5); // 0.4 ~ 0.9 사이의 주 적재값
    
    if (mainLoading < factorSettings.loading) {
      newDropped.push(id);
    } else {
      const loadings = Array.from({ length: numFactors }).map((_, i) => {
        if (i === targetFactor) return mainLoading;
        return (random() * 0.3) * (random() > 0.5 ? 1 : -1);
      });
      newMatrix.push({ id, loadings });
    }
  });

  if (factorSettings.sortBySize) {
    newMatrix.sort((a, b) => {
      // 1. 가장 큰 적재값을 가지는 요인(기둥) 번호 찾기
      const maxIdxA = a.loadings.indexOf(Math.max(...a.loadings));
      const maxIdxB = b.loadings.indexOf(Math.max(...b.loadings));
      
      // 2. 다른 요인 기둥에 속하면 기둥 번호로 정렬
      if (maxIdxA !== maxIdxB) return maxIdxA - maxIdxB;
      
      // 3. 같은 기둥 내에서는 적재값 크기순(내림차순)으로 정렬
      return b.loadings[maxIdxA] - a.loadings[maxIdxA];
    });
  }

  return {
    factorNames: fNames,
    matrixItems: newMatrix,
    droppedItems: newDropped
  };
};
