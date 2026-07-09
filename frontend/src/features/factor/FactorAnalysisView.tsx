import React, { useState, useEffect, useMemo } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { Check, RefreshCw, Layers, MinusCircle, PlusCircle, Settings2 } from 'lucide-react';
import type { Variable, VarType } from '../../types';
export interface MockMatrixItem {
  id: string;
  originalName: string;
  loadings: number[];
}
import { FactorMatrixTable } from './components/FactorMatrixTable';
import { FactorAnalysisOptions } from './components/FactorAnalysisOptions';

export const FactorAnalysisView: React.FC = () => {
  const { 
    mappedVars, 
    factorSettings, 
    approveVariable, 
    setFactorResult, 
    triggerFactorAnalysis,
    excludedItems,
    toggleItemExclusion,
    factorResults
  } = useAnalysisStore();
  
  const { setCurrentStep } = useUiStore();
  const { originalColumns } = useProjectStore();

  const _approvedVars = useAnalysisStore(state => state.approvedVariables);
  const approvedVariables = _approvedVars || [];

  // Flatten variables for the sidebar list
  const allVariables = useMemo(() => {
    const list: { type: VarType; v: Variable }[] = [];
    if (mappedVars) {
      (['iv', 'dv', 'med', 'mod'] as VarType[]).forEach((type) => {
        if (mappedVars[type]) {
          mappedVars[type].forEach(v => list.push({ type, v }));
        }
      });
    }
    return list;
  }, [mappedVars]);

  const [activeVarId, setActiveVarId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const [factorNames, setFactorNames] = useState<string[]>([]);
  const [matrixItems, setMatrixItems] = useState<MockMatrixItem[]>([]);
  const [droppedItems, setDroppedItems] = useState<string[]>([]);
  const [kmoValue, setKmoValue] = useState<number | null>(null);
  const [varianceValue, setVarianceValue] = useState<number | null>(null);
  const [communalities, setCommunalities] = useState<Record<string, number>>({});
  const [varianceData, setVarianceData] = useState<any[]>([]);
  const [bartlettData, setBartlettData] = useState<{chi: number, df: number, p: number} | null>(null);

  useEffect(() => {
    if (!activeVarId && allVariables.length > 0) {
      setActiveVarId(allVariables[0].v.id);
    }
  }, [allVariables, activeVarId]);

  const activeVarContext = useMemo(() => allVariables.find(x => x.v.id === activeVarId), [allVariables, activeVarId]);

  // Execute Real Analysis via API
  const runMockAnalysis = async () => {
    if (!activeVarContext) return;
    setIsAnalyzing(true);
    setMatrixItems([]);
    setFactorNames([]);
    setDroppedItems([]);
    setKmoValue(null);
    setVarianceValue(null);
    setCommunalities({});
    setVarianceData([]);
    setBartlettData(null);

    try {
      const allItemIds = new Set<string>();
      if (activeVarContext.v.itemIds) activeVarContext.v.itemIds.forEach(id => allItemIds.add(id));
      if (activeVarContext.v.subFactors) {
        activeVarContext.v.subFactors.forEach(sf => {
          if (sf.itemIds) sf.itemIds.forEach(id => allItemIds.add(id));
        });
      }

      // 수동으로 제외된 문항 필터링
      const currentExcluded = excludedItems[activeVarContext.v.id] || [];
      const itemsArray = Array.from(allItemIds).filter(id => !currentExcluded.includes(id));
      
      if (itemsArray.length === 0) {
        setIsAnalyzing(false);
        return;
      }
      
      const payload = {
        columns: itemsArray.map(id => getOriginalName(id)),
        n_factors: factorSettings.extractionCriterion === 'fixedNumber' ? factorSettings.fixedFactorCount : null,
        rotation: factorSettings.rotation,
        extraction: factorSettings.extraction === 'efa' ? 'minres' : 'principal',
        eigenvalue_threshold: factorSettings.eigenvalueThreshold || 1.0
      };

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analysis/efa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }
      
      const result = await response.json();
      
      const fNames = Array.from({ length: result.n_factors }).map((_, i) => `Factor ${i+1}`);
      const mItems: MockMatrixItem[] = [];
      const dItems: string[] = [];
      
      for (const col of itemsArray) {
        const origName = getOriginalName(col);
        const colLoadings = result.loadings[origName] || {};
        const loadingArr = fNames.map(fn => colLoadings[fn] || 0);
        const maxAbs = Math.max(...loadingArr.map(Math.abs));
        
        if (maxAbs < factorSettings.loading) {
          dItems.push(col);
        } else {
          mItems.push({
            id: col,
            originalName: origName,
            loadings: loadingArr
          });
        }
      }
      
      // 하위 요인(subFactors)이 정의된 경우, 추출된 요인과 매칭하여 이름 자동 부여
      const finalFNames = [...fNames];
      if (activeVarContext?.v.subFactors && activeVarContext.v.subFactors.length > 0) {
        // 요인별로 할당된 문항(column)들 그룹화
        const factorToCols: Record<number, string[]> = {};
        mItems.forEach(m => {
          const maxAbs = Math.max(...m.loadings.map(Math.abs));
          const domIdx = m.loadings.findIndex(v => Math.abs(v) === maxAbs);
          if (!factorToCols[domIdx]) factorToCols[domIdx] = [];
          factorToCols[domIdx].push(m.id);
        });

        // 각 요인별로 가장 많이 겹치는 하위 요인 이름 찾기
        const usedNames = new Set<string>();
        for (let i = 0; i < result.n_factors; i++) {
          const cols = factorToCols[i] || [];
          let bestMatch = null;
          let bestCount = 0;
          
          activeVarContext.v.subFactors.forEach(sf => {
            if (usedNames.has(sf.name)) return; // 이미 매칭된 이름은 제외
            const overlap = cols.filter(c => sf.itemIds.includes(c)).length;
            if (overlap > bestCount) {
              bestCount = overlap;
              bestMatch = sf.name;
            }
          });
          
          if (bestMatch && bestCount > 0) {
            finalFNames[i] = bestMatch;
            usedNames.add(bestMatch);
          }
        }
      } else if (activeVarContext) {
        // 하위 요인이 없는 경우 변수명으로 대체
        if (result.n_factors === 1) {
          finalFNames[0] = activeVarContext.v.name;
        } else {
          for (let i = 0; i < result.n_factors; i++) {
            finalFNames[i] = `${activeVarContext.v.name} ${i + 1}`;
          }
        }
      }

      setFactorNames(finalFNames);
      setMatrixItems(mItems);
      setDroppedItems(dItems);
      setKmoValue(result.kmo);
      
      // 분산설명력 임시 계산 제거 및 백엔드 결과 사용
      setVarianceValue(result.total_variance);
      // 추가 결과값 세팅
      setCommunalities(result.communalities || {});
      setVarianceData(result.variance_explained || []);
      setBartlettData({
        chi: result.bartlett_chi_square || 0,
        df: result.bartlett_df || 0,
        p: result.bartlett_p_value || 0
      });

    } catch (err: any) {
      console.error(err);
      alert('요인 분석 실패: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    if (activeVarId) {
      if (!approvedVariables.includes(activeVarId)) {
        runMockAnalysis();
      } else {
        // 이미 승인된 변수면 저장된 결과를 불러옴
        const result = factorResults[activeVarId];
        if (result) {
          setFactorNames(result.factorNames || []);
          setMatrixItems(result.matrixItems || []);
          setDroppedItems(result.dropped || []);
          if (result.communalities) setCommunalities(result.communalities);
          if (result.varianceData) setVarianceData(result.varianceData);
          if (result.bartlettData) setBartlettData(result.bartlettData);
          if (result.kmoValue) setKmoValue(result.kmoValue);
          setIsAnalyzing(false);
        }
      }
    }
  }, [activeVarId]);

  // 설정이 변경되거나, 수동 문항 제어가 발생하면 재분석 트리거 수신
  useEffect(() => {
    if (triggerFactorAnalysis > 0) {
      runMockAnalysis();
    }
  }, [triggerFactorAnalysis]);

  const handleApprove = () => {
    if (!activeVarId) return;
    setFactorResult(activeVarId, { 
      factorNames, 
      matrixItems, 
      dropped: droppedItems,
      communalities,
      varianceData,
      bartlettData,
      kmoValue
    });
    approveVariable(activeVarId);
    
    const currentIndex = allVariables.findIndex(x => x.v.id === activeVarId);
    const nextUnapproved = allVariables.slice(currentIndex + 1).find(x => !approvedVariables.includes(x.v.id));
    if (nextUnapproved) setActiveVarId(nextUnapproved.v.id);
  };

  const allApproved = allVariables.length > 0 && allVariables.every(x => approvedVariables.includes(x.v.id));

  const getColor = (type: VarType) => {
    switch (type) {
      case 'iv': return 'var(--var-iv)';
      case 'dv': return 'var(--var-dv)';
      case 'med': return 'var(--var-med)';
      case 'mod': return 'var(--var-mod)';
      default: return 'var(--text-muted)';
    }
  };

  const getVarTypeName = (type: VarType) => {
    switch (type) {
      case 'iv': return '독립변수';
      case 'dv': return '종속변수';
      case 'med': return '매개변수';
      case 'mod': return '조절변수';
      default: return '변수';
    }
  };

  const getOriginalName = (colId: string) => {
    const idx = parseInt(colId.replace('col_', ''), 10);
    if (!isNaN(idx) && originalColumns[idx]) return originalColumns[idx];
    return colId;
  };

  // 현재 변수의 모든 문항 가져오기 (2단 표시용)
  const allCurrentVarItems = useMemo(() => {
    if (!activeVarContext) return [];
    const ids = new Set<string>();
    if (activeVarContext.v.itemIds) activeVarContext.v.itemIds.forEach(id => ids.add(id));
    if (activeVarContext.v.subFactors) {
      activeVarContext.v.subFactors.forEach(sf => {
        if (sf.itemIds) sf.itemIds.forEach(id => ids.add(id));
      });
    }
    return Array.from(ids);
  }, [activeVarContext]);

  // 동적 크기순 정렬 적용
  const sortedMatrixItems = useMemo(() => {
    if (!factorSettings.sortBySize) return matrixItems;
    const items = [...matrixItems];
    items.sort((a, b) => {
      const maxA = Math.max(...a.loadings.map(Math.abs));
      const domA = a.loadings.findIndex(v => Math.abs(v) === maxA);
      
      const maxB = Math.max(...b.loadings.map(Math.abs));
      const domB = b.loadings.findIndex(v => Math.abs(v) === maxB);
      
      if (domA !== domB) {
        return domA - domB; // 요인 순서대로 정렬
      }
      return maxB - maxA; // 같은 요인 내에서는 적재량 크기순 정렬
    });
    return items;
  }, [matrixItems, factorSettings.sortBySize]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>
      {/* 상단 공통 액션 바 (Spotfire 스타일) */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>탐색적 요인분석 (EFA)</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            변수별로 자동 요인분석을 실행하고 문항을 확정하세요.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: allApproved ? 'var(--success)' : 'var(--bg-surface)', opacity: allApproved ? 1 : 0.5 }}
            disabled={!allApproved} onClick={() => setCurrentStep('model')}
          >
            <Check size={18} /> 연구 모형 빌더로 이동 ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        {/* 1단: 좌측 사이드바 (변수 및 하위 트리) */}
        <div className="glass-panel" style={{ width: '280px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 0, border: 'none' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="text-h3">매핑 변수 트리</h2>
            <p className="text-small" style={{ marginTop: '4px' }}>승인 완료: {approvedVariables.length} / {allVariables.length}</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '12px' }}>
            {allVariables.map(({ type, v }) => {
              const isApproved = approvedVariables.includes(v.id);
              const isActive = activeVarId === v.id;
              const color = getColor(type);
              
              const res = factorResults[v.id];
              const survivedMap: Record<string, boolean> = {};
              if (res?.matrixItems) {
                res.matrixItems.forEach((m: any) => survivedMap[m.id || m.originalName] = true);
              }
              const getCountStr = (itemIds: string[] | undefined) => {
                if (!itemIds) return '(0문항)';
                if (!res?.matrixItems) return `(${itemIds.length}문항)`;
                const survivedCount = itemIds.filter(id => survivedMap[id]).length;
                return `(${itemIds.length}개 중 ${survivedCount}개 선택)`;
              };

              return (
                <div key={v.id} style={{ marginBottom: '8px' }}>
                  <div 
                    onClick={() => setActiveVarId(v.id)}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', borderRadius: '8px',
                      backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                      border: isActive ? `1px solid ${color}` : '1px solid transparent',
                      cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }} />
                      <span style={{ fontWeight: isActive ? 600 : 400, fontSize: '0.95rem' }}>{v.name}</span>
                      {(!v.subFactors || v.subFactors.length === 0) && (
                         <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                           {getCountStr(v.itemIds)}
                         </span>
                      )}
                    </div>
                    {isApproved && <Check size={14} color="var(--success)" />}
                  </div>
                  {/* 하위 요인 및 문항 트리 표시 */}
                  <div style={{ marginLeft: '18px', borderLeft: '1px solid var(--border-light)', paddingLeft: '8px', marginTop: '4px' }}>
                    {v.subFactors && v.subFactors.length > 0 ? (
                      v.subFactors.map(sf => (
                        <div key={sf.id} style={{ marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            <Layers size={12} />
                            <span>{sf.name}</span>
                            <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{getCountStr(sf.itemIds)}</span>
                          </div>
                          {/* 하위 요인에 속한 문항들 */}
                          {sf.itemIds && sf.itemIds.length > 0 && (
                            <div style={{ marginLeft: '16px', paddingLeft: '8px', borderLeft: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {sf.itemIds.map((itemId, idx) => (
                                <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  - {getOriginalName(itemId)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      // 하위 요인이 없을 경우 변수에 직속된 문항들 표시
                      v.itemIds && v.itemIds.length > 0 && (
                        <div style={{ marginLeft: '6px', paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {v.itemIds.map((itemId, idx) => (
                            <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              - {getOriginalName(itemId)}
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 메인 캔버스 래퍼 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-base)', minWidth: 0 }}>
          {activeVarContext ? (
            <>
              {/* 상단 헤더 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                <div>
                  <span className="text-small" style={{ color: getColor(activeVarContext.type) }}>{getVarTypeName(activeVarContext.type)}</span>
                  <h2 className="text-h2" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    {activeVarContext.v.name} 요인분석
                    {approvedVariables.includes(activeVarContext.v.id) && <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--success)', color: 'white' }}>승인됨</span>}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn-primary" style={{ backgroundColor: 'var(--success)' }} onClick={handleApprove}>
                    <Check size={16} style={{ marginRight: '6px' }} /> 분석 확정 및 승인
                  </button>
                </div>
              </div>

              {/* 내부 3단 분할 (수동 제어 / 자동 분석 결과 / 옵션 패널) */}
              <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                
                {/* 2단: 수동 문항 제어 풀 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', minWidth: 0 }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="text-h3">수동 문항 제어 풀</h3>
                    <span className="text-small">{allCurrentVarItems.length} 문항</span>
                  </div>
                  <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                    <p className="text-small" style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                      매핑된 문항 중 분석에 투입할 문항을 수동으로 선택/제외할 수 있습니다.
                    </p>
                    
                    {allCurrentVarItems.map(id => {
                      const isExcluded = excludedItems[activeVarContext.v.id]?.includes(id);
                      return (
                        <div 
                          key={id} 
                          style={{ 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 12px', backgroundColor: isExcluded ? 'rgba(255, 255, 255, 0.02)' : 'var(--bg-surface)', 
                            border: `1px solid ${isExcluded ? 'var(--border-color)' : 'var(--border-light)'}`, 
                            borderRadius: '6px', marginBottom: '8px', fontSize: '0.9rem',
                            opacity: isExcluded ? 0.5 : 1, transition: 'all 0.2s'
                          }}
                        >
                          <span style={{ textDecoration: isExcluded ? 'line-through' : 'none' }}>
                            {getOriginalName(id)}
                          </span>
                          <button 
                            onClick={() => {
                              toggleItemExclusion(activeVarContext.v.id, id);
                              setTimeout(() => {
                                useAnalysisStore.getState().runAnalysisTrigger();
                              }, 50); // 자동 재분석
                            }}
                            style={{ 
                              color: isExcluded ? 'var(--success)' : 'var(--danger)', 
                              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 500
                            }}
                          >
                            {isExcluded ? <><PlusCircle size={14} /> 복구</> : <><MinusCircle size={14} /> 제외</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3단: 자동 분석 결과 */}
                <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)', minWidth: 0, backgroundColor: 'var(--bg-panel)' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="text-h3">자동 분석 결과</h3>
                    {!isAnalyzing && kmoValue !== null && (
                      <span className="text-small" style={{ color: 'var(--accent-primary)' }}>
                        KMO: {kmoValue.toFixed(3)} | 누적 분산설명력: {varianceValue?.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, padding: '16px', overflowY: 'auto', position: 'relative' }}>
                    {isAnalyzing ? (
                      <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '16px', color: 'var(--text-muted)' }}>
                        <RefreshCw size={32} className="animate-spin" />
                        <p>기준값에 맞춰 요인 구조를 최적화 중입니다...</p>
                      </div>
                    ) : matrixItems.length === 0 ? (
                      <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>결과가 없습니다. 재분석을 실행해주세요.</div>
                    ) : (
                      <>
                        <FactorMatrixTable 
                          factorNames={factorNames} 
                          matrixItems={sortedMatrixItems} 
                          getOriginalName={getOriginalName}
                          hideSmallCoefficients={factorSettings.hideSmallCoefficients}
                          smallCoefficientThreshold={factorSettings.smallCoefficientThreshold}
                          loadingThreshold={factorSettings.loading}
                          communalities={communalities}
                          varianceData={varianceData}
                          bartlettData={bartlettData}
                          kmoValue={kmoValue}
                        />
                        
                        {droppedItems.length > 0 && (
                          <div style={{ marginTop: '24px', padding: '16px', border: '1px dashed #ff4d4f', borderRadius: '8px', backgroundColor: 'rgba(255, 77, 79, 0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <h4 className="text-small" style={{ color: '#ff4d4f' }}>
                                기준 미달로 자동 탈락된 항목 (적재값 &lt; {factorSettings.loading})
                              </h4>
                              <span className="text-small" style={{ color: 'var(--text-muted)' }}>
                                * 필요시 좌측 패널에서 수동으로 복구/제외 처리하세요.
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {droppedItems.map(id => (
                                <span key={id} style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: 'var(--bg-base)', border: '1px solid #ff4d4f', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                  <del>{getOriginalName(id)}</del>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* 4단: 우측 옵션 패널 통합 */}
                <div style={{ width: '280px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-surface)' }}>
                  <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Settings2 size={18} />
                    <h3 className="text-h3">분석 설정</h3>
                  </div>
                  <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
                    <FactorAnalysisOptions />
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}>매핑된 변수가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
};
