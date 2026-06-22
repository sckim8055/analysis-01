import { describe, it, expect } from 'vitest';
import { runMockFactorAnalysis } from './factorMockLogic';

describe('runMockFactorAnalysis', () => {
  it('항목이 없으면 빈 결과를 반환해야 한다', () => {
    const result = runMockFactorAnalysis([], { loading: 0.4 });
    expect(result.factorNames).toEqual([]);
    expect(result.matrixItems).toEqual([]);
    expect(result.droppedItems).toEqual([]);
  });

  it('fixedNumber 기준일 때 고정된 요인 수만큼 반환해야 한다', () => {
    const items = ['col_1', 'col_2', 'col_3'];
    const result = runMockFactorAnalysis(items, { 
      extractionCriterion: 'fixedNumber', 
      fixedFactorCount: 2, 
      loading: 0.0 // 아무것도 드롭되지 않게 함
    });
    
    expect(result.factorNames.length).toBe(2);
    expect(result.matrixItems.length).toBe(3);
    expect(result.matrixItems[0].loadings.length).toBe(2);
  });

  it('적재값이 설정된 loading 기준치보다 낮으면 droppedItems로 분류해야 한다', () => {
    const items = ['col_1', 'col_2'];
    const result = runMockFactorAnalysis(items, { 
      loading: 0.99 // 0.99보다 큰 난수가 발생할 확률은 매우 낮으므로 대부분 드롭됨
    });
    
    // 이 로직은 원래 난수 기반이지만, 0.99 기준이면 0.4~0.9 난수 발생 로직 상 무조건 드롭됨
    expect(result.matrixItems.length).toBe(0);
    expect(result.droppedItems.length).toBe(2);
  });

  it('크기순 정렬(sortBySize) 옵션이 활성화되면 정렬 시 크래시가 발생하지 않아야 한다', () => {
    const items = ['col_1', 'col_2', 'col_3'];
    const result = runMockFactorAnalysis(items, { 
      loading: 0.1,
      sortBySize: true 
    });
    
    expect(result.matrixItems.length).toBe(3);
    expect(result.droppedItems.length).toBe(0);
  });
});
