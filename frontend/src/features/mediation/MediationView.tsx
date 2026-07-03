import { exportHtmlTableToExcel } from '../../utils/excelExport';
import React, { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUiStore } from '../../store/uiStore';
import { Download, FileText, Settings2, RefreshCw } from 'lucide-react';

export const MediationView: React.FC = () => {
  const { factorResults, mappedVars, savedModelEdges, savedModelNodes } = useAnalysisStore();
  const { setCurrentStep } = useUiStore();
  
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [useBootstrapping, setUseBootstrapping] = useState(false);
  const [bootCount, setBootCount] = useState(5000);
  const [useSobel, setUseSobel] = useState(false);
  const [useScheffe, setUseScheffe] = useState(false);
  const [isExporting1, setIsExporting1] = useState(false);
  const [isExporting2, setIsExporting2] = useState(false);

  const tabs = React.useMemo(() => {
    const pairs: { iv: any, med: any, dv: any, id: string, name: string }[] = [];
    
    if (savedModelEdges && savedModelEdges.length > 0 && savedModelNodes && savedModelNodes.length > 0) {
        const logicalPaths: {source: string, target: string, label: string}[] = [];
        savedModelEdges.forEach((e: any) => {
            const srcNode = savedModelNodes.find((n: any) => n.id === e.source);
            if (srcNode?.type === 'customVariable' && srcNode?.data?.varType !== 'mod') {
                let currentTargetId = e.target;
                let currentLabel = e.label || '';
                let isValidPath = false;
                let finalTargetId = '';
                const visited = new Set<string>();
                visited.add(e.source);
                
                while (true) {
                    if (visited.has(currentTargetId)) break;
                    visited.add(currentTargetId);
                    const targetNode = savedModelNodes.find((n: any) => n.id === currentTargetId);
                    if (targetNode?.type === 'customVariable') {
                        isValidPath = true;
                        finalTargetId = currentTargetId;
                        break;
                    }
                    if (targetNode?.type === 'junction') {
                        const nextEdge = savedModelEdges.find((nextE: any) => nextE.source === currentTargetId);
                        if (!nextEdge) break;
                        if (!currentLabel && nextEdge.label) currentLabel = nextEdge.label;
                        currentTargetId = nextEdge.target;
                    } else {
                        break;
                    }
                }
                if (isValidPath && finalTargetId) {
                    const exists = logicalPaths.find(p => p.source === e.source && p.target === finalTargetId);
                    if (!exists) logicalPaths.push({ source: e.source, target: finalTargetId, label: currentLabel });
                }
            }
        });

        const meds = savedModelNodes.filter((n: any) => n.data?.varType === 'med');
        const allIvs = [...(mappedVars.iv || []), ...(mappedVars.med || []), ...(mappedVars.mod || [])];
        const allDvs = [...(mappedVars.dv || []), ...(mappedVars.med || [])];
        const allMeds = mappedVars.med || [];

        let counter = 1;
        meds.forEach((medNode: any) => {
            const medVar = allMeds.find(v => v.id === medNode.id);
            if (!medVar) return;

            const incomingPaths = logicalPaths.filter(p => p.target === medNode.id);
            const outgoingPaths = logicalPaths.filter(p => p.source === medNode.id);

            incomingPaths.forEach(inPath => {
                outgoingPaths.forEach(outPath => {
                    const ivVar = allIvs.find(v => v.id === inPath.source);
                    const dvVar = allDvs.find(v => v.id === outPath.target);
                    
                    if (ivVar && dvVar) {
                        let hLabel = inPath.label || outPath.label;
                        if (!hLabel) {
                            hLabel = `H${counter++}`;
                        } else {
                            counter++;
                        }
                        
                        pairs.push({
                            iv: ivVar,
                            med: medVar,
                            dv: dvVar,
                            id: hLabel,
                            name: `[${hLabel} 매개효과] ${ivVar.name} → ${medVar.name} → ${dvVar.name}`
                        });
                    }
                });
            });
        });
        return pairs;
    }

    let counter = 1;
    (mappedVars.iv || []).forEach(iv => {
        (mappedVars.med || []).forEach(med => {
            (mappedVars.dv || []).forEach(dv => {
                pairs.push({
                    iv, med, dv,
                    id: `H${counter++}`,
                    name: `[H${counter-1} 매개효과] ${iv.name} → ${med.name} → ${dv.name}`
                });
            });
        });
    });

    return pairs;
  }, [mappedVars, savedModelEdges, savedModelNodes]);

  const [activeTabIdx, setActiveTabIdx] = useState(0);

  useEffect(() => {
    if (tabs.length > 0 && activeTabIdx < tabs.length) {
        handleAnalyze();
    } else {
        setResults(null);
    }
  }, [activeTabIdx, tabs]);

  const getPayload = (v: any) => {
    const payload: any[] = [];
    const res = factorResults[v.id];
    
    // If no factor analysis result, just use the original structure
    if (!res || !res.matrixItems) {
        if (v.subFactors && v.subFactors.length > 0) {
            v.subFactors.forEach((sf: any) => {
                if (sf.itemIds && sf.itemIds.length > 0) {
                    payload.push({ name: sf.name, items: sf.itemIds, parent: v.name });
                }
            });
        } else {
            if (v.itemIds && v.itemIds.length > 0) {
                payload.push({ name: v.name, items: v.itemIds, parent: v.name });
            }
        }
        return payload;
    }

    const survivedMap: Record<string, string> = {};
    res.matrixItems.forEach((m: any) => survivedMap[m.id] = m.originalName || m.id);
    
    if (v.subFactors && v.subFactors.length > 0) {
        v.subFactors.forEach((sf: any) => {
            const finalNames = (sf.itemIds || []).filter((id: string) => survivedMap[id]).map((id: string) => survivedMap[id]);
            if (finalNames.length > 0) payload.push({ name: sf.name, items: finalNames, parent: v.name });
        });
    } else {
        const finalNames = (v.itemIds || []).filter((id: string) => survivedMap[id]).map((id: string) => survivedMap[id]);
        if (finalNames.length > 0) payload.push({ name: v.name, items: finalNames, parent: v.name });
    }
    return payload;
  };

  const handleAnalyze = async () => {
    if (tabs.length === 0 || activeTabIdx >= tabs.length) return;
    const currentTab = tabs[activeTabIdx];
    const { iv, med, dv } = currentTab;

    const ivPayload = getPayload(iv);
    const medPayload = getPayload(med);
    const dvPayload = getPayload(dv);

    if (ivPayload.length === 0 || medPayload.length === 0 || dvPayload.length === 0) return;

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analysis/mediation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            iv_parent_name: iv.name,
            med_parent_name: med.name,
            dv_parent_name: dv.name,
            ivs: ivPayload, 
            meds: medPayload,
            dvs: dvPayload,
            n_boot: useBootstrapping ? bootCount : 0
        })
      });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      
      setResults({ 
          ...data, 
          ivPayload, 
          medPayload,
          dvPayload,
          ivParentName: iv.name, 
          medParentName: med.name, 
          dvParentName: dv.name, 
          hypothesisName: currentTab.id
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportHypothesis = async () => {
      if (!results) return;
      setIsExporting1(true);
      try {
          const hypothesesRows: any[] = [];
          let subHIdx = 1;
          results.results.forEach((dvRes: any) => {
              dvRes.models.forEach((m: any) => {
                  m.adoptions.forEach((ad: any) => {
                      hypothesesRows.push({
                          '가설': `${results.hypothesisName}-${subHIdx++}`,
                          '가설 내용': `'${m.med_name}'은(는) '${ad.iv}'와(과) '${dvRes.dv_name}' 간의 관계를 매개할 것이다.`,
                          '채택여부': ad.status
                      });
                  });
              });
          });

          const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/analysis/mediation/export`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  title: `매개효과 가설 검증 결과`,
                  rows: hypothesesRows
              })
          });
          if (!res.ok) throw new Error('Export failed');
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'mediation_hypothesis.xlsx';
          document.body.appendChild(a);
          a.click();
          a.remove();
      } catch (err) {
          console.error(err);
          alert('엑셀 다운로드 중 오류가 발생했습니다.');
      } finally {
          setIsExporting1(false);
      }
  };

  const handleExportMediation = async (dvRes: any, dvIdx: number) => {
      setIsExporting2(true);
      try {
          const title = `<표> ${results.ivParentName}과(와) ${dvRes.dv_name} 간의 관계에서 ${results.medParentName}의 매개효과`;
          const filename = `mediation_table_${dvRes.dv_name}.xlsx`;
          const tableIds = [`mediation-table-${dvIdx}`];
          if (useBootstrapping) {
              tableIds.push(`boot-table-${dvIdx}`);
          }
          exportHtmlTableToExcel(title, filename, tableIds);
      } catch (err) {
          console.error(err);
          alert('엑셀 다운로드 중 오류가 발생했습니다.');
      } finally {
          setIsExporting2(false);
      }
  };

  const generateInterpretation = () => {
      if (!results) return "";
      let text = `본 연구에서 설정한 가설 ${results.hypothesisName}을(를) 검증하기 위하여, 독립변수인 [${results.ivParentName}]이(가) 종속변수인 [${results.dvParentName}]에 미치는 영향에서 매개변수인 [${results.medParentName}]의 매개효과를 분석하였다. 이를 위해 Baron과 Kenny(1986)가 제시한 3단계 위계적 다중회귀분석(Hierarchical Multiple Regression Analysis)을 실시하였다. 

매개효과가 성립하기 위해서는 다음의 3가지 조건을 충족해야 한다. 첫째(1단계), 독립변수가 매개변수에 유의한 영향을 미쳐야 한다. 둘째(2단계), 독립변수가 종속변수에 유의한 영향을 미쳐야 한다. 셋째(3단계), 독립변수와 매개변수를 동시에 투입했을 때 매개변수가 종속변수에 유의한 영향을 미쳐야 하며, 이때 종속변수에 대한 독립변수의 영향력(β)이 2단계보다 감소하면 부분매개(Partial Mediation), 유의하지 않게 변하면 완전매개(Full Mediation)로 판정한다.\n\n`;

      results.results.forEach((dvRes: any) => {
          text += `### 📌 종속변수: [${dvRes.dv_name}]에 대한 분석 결과\n\n`;
          dvRes.models.forEach((m: any) => {
              text += `**■ 매개변수 하위요인: [${m.med_name}]의 매개효과 검증**\n\n`;
              
              // 1단계 설명
              const sigStep1 = m.step1.coefficients.filter((c: any) => c.p < 0.05);
              const nonSigStep1 = m.step1.coefficients.filter((c: any) => c.p >= 0.05);
              
              text += `**1단계 (독립변수 $\\rightarrow$ 매개변수):**\n`;
              text += `독립변수들이 매개변수인 [${m.med_name}]에 미치는 영향을 분석한 결과, 회귀모형은 통계적으로 유의하였다(F=${m.step1.f_value.toFixed(3)}, p=${m.step1.f_p_value < 0.001 ? '< .001' : m.step1.f_p_value.toFixed(3)}). `;
              
              if (sigStep1.length > 0) {
                  text += `구체적으로 ${sigStep1.map((c:any) => `'${c.name}'(β=${c.beta.toFixed(3)}, p=${c.p < 0.001 ? '<.001' : c.p.toFixed(3)})`).join(', ')}은(는) 매개변수에 통계적으로 유의한 영향을 미쳐 1단계 조건을 충족하였다. `;
              }
              if (nonSigStep1.length > 0) {
                  text += `반면, ${nonSigStep1.map((c:any) => `'${c.name}'(p=${c.p.toFixed(3)})`).join(', ')}은(는) 유의한 영향을 미치지 않아 매개효과의 첫 번째 조건을 충족하지 못하였다. `;
              }
              text += `\n\n`;

              // 2단계 설명
              const sigStep2 = m.step2.coefficients.filter((c: any) => c.p < 0.05);
              text += `**2단계 (독립변수 $\\rightarrow$ 종속변수):**\n`;
              text += `독립변수들이 종속변수인 [${dvRes.dv_name}]에 미치는 영향을 분석한 결과, 회귀모형은 통계적으로 유의하였다(F=${m.step2.f_value.toFixed(3)}, p=${m.step2.f_p_value < 0.001 ? '< .001' : m.step2.f_p_value.toFixed(3)}). `;
              if (sigStep2.length > 0) {
                  text += `독립변수 중 ${sigStep2.map((c:any) => `'${c.name}'(β=${c.beta.toFixed(3)}, p=${c.p < 0.001 ? '<.001' : c.p.toFixed(3)})`).join(', ')}은(는) 종속변수에 유의한 영향을 미쳐 2단계 조건을 충족하였다.\n\n`;
              } else {
                  text += `유의한 영향을 미치는 독립변수가 없어 2단계 조건을 충족하지 못하였다.\n\n`;
              }

              // 3단계 설명
              const mCoef = m.step3.med_coefficient;
              text += `**3단계 (독립변수 + 매개변수 $\\rightarrow$ 종속변수):**\n`;
              text += `독립변수들과 매개변수 [${m.med_name}]을(를) 동시에 투입하여 종속변수 [${dvRes.dv_name}]에 미치는 영향을 분석한 결과, 전체 설명력(R²)은 ${(m.step3.r_squared * 100).toFixed(1)}%로 나타났으며, 모형은 유의하였다(F=${m.step3.f_value.toFixed(3)}, p=${m.step3.f_p_value < 0.001 ? '< .001' : m.step3.f_p_value.toFixed(3)}). `;
              
              if (mCoef.p < 0.05) {
                  text += `매개변수인 [${m.med_name}]은(는) 종속변수에 통계적으로 유의한 영향(β=${mCoef.beta.toFixed(3)}, p=${mCoef.p < 0.001 ? '<.001' : mCoef.p.toFixed(3)})을 미치는 것으로 확인되어 3단계 조건을 충족하였다.\n\n`;
              } else {
                  text += `그러나 매개변수인 [${m.med_name}]이(가) 종속변수에 미치는 영향이 통계적으로 유의하지 않게 나타나(β=${mCoef.beta.toFixed(3)}, p=${mCoef.p.toFixed(3)}), 매개효과의 3단계 조건을 충족하지 못하였다. 따라서 매개효과가 성립하지 않는다.\n\n`;
                  return; // 3단계 실패시 중단
              }

              // 최종 판정
              text += `**✨ 최종 매개효과 판정:**\n`;
              const adopts = m.adoptions.filter((a: any) => a.status.includes('매개'));
              const rejects = m.adoptions.filter((a: any) => a.status === '기각');
              
              if (adopts.length === 0) {
                  text += `위의 3단계 위계적 검증 과정을 종합해 볼 때, 모든 독립변수의 하위요인에서 매개효과 성립 조건(1~3단계)이 완전히 충족되지 않아 [${m.med_name}]의 매개효과는 모두 기각되었다.\n\n`;
              } else {
                  const partials = adopts.filter((a: any) => a.status.includes('부분'));
                  const fulls = adopts.filter((a: any) => a.status.includes('완전'));
                  
                  if (fulls.length > 0) {
                      text += `1~3단계를 모두 충족한 요인 중, **${fulls.map((f: any) => `'${f.iv}'`).join(', ')}**의 경우 3단계에서 매개변수가 투입되자 종속변수에 대한 독립변수의 영향력이 통계적으로 유의하지 않게 변하였다. 이는 [${m.med_name}]이(가) 해당 독립변수와 종속변수 사이의 관계를 100% 흡수하여 전달하는 **'완전 매개(Full Mediation)'** 역할을 수행함을 의미한다. `;
                  }
                  if (partials.length > 0) {
                      text += `반면, **${partials.map((p: any) => `'${p.iv}'`).join(', ')}**의 경우 3단계에서 매개변수가 투입되었음에도 종속변수에 대한 독립변수의 영향력이 여전히 유의하지만, 그 크기(β)가 2단계에 비해 감소하였다. 이는 [${m.med_name}]이(가) 관계를 일부만 대신 전달하는 **'부분 매개(Partial Mediation)'** 역할을 수행함을 의미한다. `;
                  }
                  if (rejects.length > 0) {
                      text += `그 외에 **${rejects.map((r: any) => `'${r.iv}'`).join(', ')}** 요인은 매개효과의 전제 조건을 충족하지 못하여 기각되었다. `;
                  }
                  text += `\n\n`;
              }
              
              // 부트스트래핑 결과
              if (useBootstrapping) {
                  text += `**[Process Macro 부트스트래핑(Bootstrapping) 추가 검증]**\n`;
                  const sigEffects = m.indirect_effects.filter((e: any) => e.is_significant);
                  if (sigEffects.length > 0) {
                      text += `매개효과의 통계적 유의성을 보다 엄격하게 검증하기 위해 Process Macro를 이용한 부트스트래핑(추출 표본 수 n=${bootCount})을 추가로 실시하였다. 검증 결과, `;
                      sigEffects.forEach((e: any) => {
                          text += `**'${e.iv} $\\rightarrow$ ${m.med_name} $\\rightarrow$ ${dvRes.dv_name}'** 경로의 간접효과 크기는 ${e.effect.toFixed(3)}이며, 95% 신뢰구간 하한값(LLCI)은 ${e.boot_llci.toFixed(3)}, 상한값(ULCI)은 ${e.boot_ulci.toFixed(3)}로 산출되었다. 해당 신뢰구간 사이에 '0'이 포함되어 있지 않으므로, 이 간접경로의 매개효과는 통계적으로 유의함이 재확인되었다.\n`;
                      });
                  } else {
                      text += `부트스트래핑 검증 결과, 산출된 모든 간접효과의 95% 신뢰구간(LLCI~ULCI) 사이에 '0'이 포함되어 있어 간접효과의 통계적 유의성이 최종적으로 확보되지 않았다.\n`;
                  }
                  text += `\n\n`;
              }
              text += `---\n\n`;
          });
      });

      return text;
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>
      
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>매개효과 분석 (Mediation Analysis)</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            독립변수가 매개변수를 거쳐 종속변수에 미치는 간접효과를 분석합니다.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
            
            <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setCurrentStep('moderation')}>
              조절효과 분석으로 이동 ▶
            </button>
        </div>
      </div>

      {tabs.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
              {tabs.map((tab, idx) => (
                  <button
                      key={tab.id}
                      onClick={() => setActiveTabIdx(idx)}
                      className={activeTabIdx === idx ? 'btn-primary' : 'btn-secondary'}
                      style={{ padding: '10px 20px', borderRadius: '8px', whiteSpace: 'nowrap', border: activeTabIdx === idx ? 'none' : '1px solid var(--border-color)' }}
                  >
                      {tab.name}
                  </button>
              ))}
          </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw className="animate-spin" size={24} style={{ margin: '0 auto 12px' }} />
            데이터 분석 중... (Bootstrap 횟수에 따라 수십 초 이상 소요될 수 있습니다)
        </div>
      ) : results ? (() => {
            const hypotheses: any[] = [];
            const hLabel = results.hypothesisName;
            
            let adoptedCount = 0;
            let totalHypotheses = 0;
            
            let subHIdx = 1;
            results.results.forEach((dvRes: any) => {
                dvRes.models.forEach((m: any) => {
                    m.adoptions.forEach((ad: any) => {
                        totalHypotheses++;
                        hypotheses.push({
                            id: `${hLabel}-${subHIdx++}`,
                            desc: `'${m.med_name}'은(는) '${ad.iv}'와(과) '${dvRes.dv_name}' 간의 관계를 매개할 것이다.`,
                            isParent: false,
                            status: ad.status
                        });
                        if (ad.status.includes('매개')) {
                            adoptedCount++;
                        }
                    });
                });
            });

            let mainStatus = '기각';
            if (totalHypotheses > 0) {
                if (adoptedCount === 0) mainStatus = '기각';
                else if (adoptedCount === totalHypotheses) mainStatus = '채택';
                else mainStatus = '부분 채택';
            }

            hypotheses.unshift({
                id: hLabel,
                desc: `${results.medParentName}은(는) ${results.ivParentName}과(와) ${results.dvParentName} 사이의 관계를 매개할 것이다.`,
                isParent: true,
                status: mainStatus
            });

            return (
                <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
                    <div style={{ flex: '1.4', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '4px' }}>
                        
                        <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                                <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>가설 설정 ({results?.hypothesisName})</h3>
                                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} disabled={isExporting1} onClick={handleExportHypothesis}>
                                    <Download size={14} /> {isExporting1 ? '다운로드 중...' : '가설 표 다운로드'}
                                </button>
                            </div>
                            <div style={{ padding: '16px', overflowX: 'auto' }}>
                                <table style={{ borderCollapse: 'collapse', width: '100%', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'left', color: 'var(--text-primary)', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)', textAlign: 'center' }}>
                                            <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)', width: '80px' }}>가설</th>
                                            <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>가설 내용</th>
                                            <th style={{ padding: '10px', width: '80px' }}>채택여부</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hypotheses.map((h, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: h.isParent ? 'var(--bg-surface)' : 'transparent' }}>
                                                <td style={{ padding: '10px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontWeight: h.isParent ? 'bold' : 'normal' }}>{h.id}</td>
                                                <td style={{ padding: '10px', borderRight: '1px solid var(--border-color)', fontWeight: h.isParent ? 'bold' : 'normal' }}>{h.desc}</td>
                                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: h.isParent ? 'bold' : 'normal', color: h.status.includes('기각') ? 'var(--error)' : h.status ? 'var(--primary)' : 'inherit' }}>{h.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {results.results.map((dvRes: any, dvIdx: number) => {
                            const models = dvRes.models;
                            return (
                            <div key={dvIdx} className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
                                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                                    <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>
                                        {`<표> ${results.ivParentName}과(와) ${dvRes.dv_name} 간의 관계에서 ${results.medParentName}의 매개효과`}
                                    </h3>
                                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} disabled={isExporting2} onClick={() => handleExportMediation(dvRes, dvIdx)}>
                                        <Download size={14} /> {isExporting2 ? '다운로드 중...' : '분석 표 다운로드'}
                                    </button>
                                </div>
                                <div style={{ padding: '16px', overflowX: 'auto' }}>
                                    <table id={`mediation-table-${dvIdx}`} style={{ borderCollapse: 'collapse', width: 'max-content', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                                                <th rowSpan={2} colSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>구분<br/>(독립/매개/종속)</th>
                                                <th colSpan={models.length * 3} style={{ padding: '10px' }}>매개변수 ({results.medParentName}) 하위요인별 매개효과</th>
                                            </tr>
                                            <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)' }}>
                                                {models.map((m: any) => (
                                                    <React.Fragment key={m.med_name}>
                                                        <th colSpan={3} style={{ padding: '6px', borderLeft: '1px solid var(--border-color)' }}>{m.med_name}</th>
                                                    </React.Fragment>
                                                ))}
                                            </tr>
                                            <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)' }}>
                                                <th colSpan={2} style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>매개효과 검증</th>
                                                {models.map((m: any) => (
                                                    <React.Fragment key={m.med_name + 'cols'}>
                                                        <th style={{ padding: '6px', borderLeft: '1px solid var(--border-color)', fontWeight: 'normal' }}>β</th>
                                                        <th style={{ padding: '6px', fontWeight: 'normal' }}>t</th>
                                                        <th style={{ padding: '6px', fontWeight: 'normal' }}>p</th>
                                                    </React.Fragment>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.ivPayload.map((iv: any, idx: number) => (
                                                <tr key={"s1"+idx} style={{ borderBottom: idx === results.ivPayload.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                                    {idx === 0 && <td rowSpan={results.ivPayload.length} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>1단계</td>}
                                                    <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{iv.name}</td>
                                                    {models.map((m: any) => {
                                                        const c = m.step1.coefficients.find((c: any) => c.name === iv.name) || { beta:0, t:0, p:1 };
                                                        return (
                                                            <React.Fragment key={m.med_name}>
                                                                <td style={{ padding: '8px', borderLeft: '1px solid var(--border-color)' }}>{c.beta.toFixed(3)}</td>
                                                                <td style={{ padding: '8px', fontWeight: c.p < 0.05 ? 'bold' : 'normal', color: c.p < 0.05 ? 'var(--primary)' : 'inherit' }}>{c.t.toFixed(3)}{c.p < 0.001 ? '***' : c.p < 0.01 ? '**' : c.p < 0.05 ? '*' : ''}</td>
                                                                <td style={{ padding: '8px' }}>{c.p < 0.001 ? '.000' : c.p.toFixed(3).replace(/^0\./, '.')}</td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                            {results.ivPayload.map((iv: any, idx: number) => (
                                                <tr key={"s2"+idx} style={{ borderBottom: idx === results.ivPayload.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                                    {idx === 0 && <td rowSpan={results.ivPayload.length} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>2단계</td>}
                                                    <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{iv.name}</td>
                                                    {models.map((m: any) => {
                                                        const c = m.step2.coefficients.find((c: any) => c.name === iv.name) || { beta:0, t:0, p:1 };
                                                        return (
                                                            <React.Fragment key={m.med_name}>
                                                                <td style={{ padding: '8px', borderLeft: '1px solid var(--border-color)' }}>{c.beta.toFixed(3)}</td>
                                                                <td style={{ padding: '8px', fontWeight: c.p < 0.05 ? 'bold' : 'normal', color: c.p < 0.05 ? 'var(--primary)' : 'inherit' }}>{c.t.toFixed(3)}{c.p < 0.001 ? '***' : c.p < 0.01 ? '**' : c.p < 0.05 ? '*' : ''}</td>
                                                                <td style={{ padding: '8px' }}>{c.p < 0.001 ? '.000' : c.p.toFixed(3).replace(/^0\./, '.')}</td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                            {results.ivPayload.map((iv: any, idx: number) => (
                                                <tr key={"s3"+idx}>
                                                    {idx === 0 && <td rowSpan={results.ivPayload.length + 1} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>3단계</td>}
                                                    <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{iv.name}</td>
                                                    {models.map((m: any) => {
                                                        const c = m.step3.coefficients.find((c: any) => c.name === iv.name) || { beta:0, t:0, p:1 };
                                                        return (
                                                            <React.Fragment key={m.med_name}>
                                                                <td style={{ padding: '8px', borderLeft: '1px solid var(--border-color)' }}>{c.beta.toFixed(3)}</td>
                                                                <td style={{ padding: '8px', fontWeight: c.p < 0.05 ? 'bold' : 'normal', color: c.p < 0.05 ? 'var(--primary)' : 'inherit' }}>{c.t.toFixed(3)}{c.p < 0.001 ? '***' : c.p < 0.01 ? '**' : c.p < 0.05 ? '*' : ''}</td>
                                                                <td style={{ padding: '8px' }}>{c.p < 0.001 ? '.000' : c.p.toFixed(3).replace(/^0\./, '.')}</td>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                            <tr style={{ borderBottom: '2px solid var(--text-primary)' }}>
                                                <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>3단계<br/>(매개)</td>
                                                {models.map((m: any) => {
                                                    const c = m.step3.med_coefficient;
                                                    return (
                                                        <React.Fragment key={m.med_name}>
                                                            <td style={{ padding: '8px', borderLeft: '1px solid var(--border-color)' }}>{c.beta.toFixed(3)}</td>
                                                            <td style={{ padding: '8px', fontWeight: c.p < 0.05 ? 'bold' : 'normal', color: c.p < 0.05 ? 'var(--primary)' : 'inherit' }}>{c.t.toFixed(3)}{c.p < 0.001 ? '***' : c.p < 0.01 ? '**' : c.p < 0.05 ? '*' : ''}</td>
                                                            <td style={{ padding: '8px' }}>{c.p < 0.001 ? '.000' : c.p.toFixed(3).replace(/^0\./, '.')}</td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>F-value (3단계)</td>
                                                {models.map((m: any) => <td colSpan={3} key={m.med_name} style={{ padding: '8px', borderLeft: '1px solid var(--border-color)' }}>{m.step3.f_value.toFixed(3)}</td>)}
                                            </tr>
                                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>R² (3단계)</td>
                                                {models.map((m: any) => <td colSpan={3} key={m.med_name} style={{ padding: '8px', borderLeft: '1px solid var(--border-color)' }}>{m.step3.r_squared.toFixed(3)}</td>)}
                                            </tr>
                                            <tr>
                                                <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>채택유무</td>
                                                {models.map((m: any) => (
                                                    <td colSpan={3} key={m.med_name} style={{ padding: '8px', borderLeft: '1px solid var(--border-color)', textAlign: 'left', fontSize: '12px', lineHeight: '1.5' }}>
                                                        {m.adoptions.map((a: any) => <div key={a.iv}>- {a.iv} ({a.status})</div>)}
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr style={{ borderTop: '1px solid var(--border-color)' }}>
                                                <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>Sobel Test<br/>(Z값, p-value)</td>
                                                {models.map((m: any) => (
                                                    <td colSpan={3} key={m.med_name} style={{ padding: '8px', borderLeft: '1px solid var(--border-color)', textAlign: 'left', fontSize: '12px', lineHeight: '1.5' }}>
                                                        {m.indirect_effects && m.indirect_effects.map((ie: any) => (
                                                            <div key={ie.iv}>- {ie.iv}: Z={ie.sobel_z.toFixed(3)}, p={ie.sobel_p < 0.001 ? '<.001' : ie.sobel_p.toFixed(3)}</div>
                                                        ))}
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            );
                        })}

                        {useBootstrapping && results.results.map((dvRes: any, dvIdx: number) => {
                            const models = dvRes.models;
                            return (
                                <div key={'boot'+dvIdx} className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
                                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                                        <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>
                                            {`<표> 부트스트래핑 간접효과 검증 (${dvRes.dv_name})`}
                                        </h3>
                                    </div>
                                    <div style={{ padding: '16px', overflowX: 'auto' }}>
                                        <table id={`boot-table-${dvIdx}`} style={{ borderCollapse: 'collapse', width: '100%', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '13px' }}>
                                            <thead>
                                                <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)' }}>
                                                    <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>경로</th>
                                                    <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>간접효과(a×b)</th>
                                                    <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>BootSE</th>
                                                    <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>BootLLCI</th>
                                                    <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>BootULCI</th>
                                                    <th style={{ padding: '10px' }}>판정</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {models.map((m: any) => 
                                                    m.indirect_effects.map((e: any, i: number) => (
                                                        <tr key={m.med_name + i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{e.iv} → {m.med_name} → {dvRes.dv_name}</td>
                                                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{e.effect.toFixed(4)}</td>
                                                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{e.boot_se.toFixed(4)}</td>
                                                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{e.boot_llci.toFixed(4)}</td>
                                                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{e.boot_ulci.toFixed(4)}</td>
                                                            <td style={{ padding: '8px', fontWeight: e.is_significant ? 'bold' : 'normal', color: e.is_significant ? 'var(--primary)' : 'inherit' }}>{e.is_significant ? '유의함 (0 불포함)' : '유의하지 않음'}</td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            * 부트스트랩 샘플 수: {bootCount} / LLCI: 95% 신뢰구간 하한 / ULCI: 95% 신뢰구간 상한
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                    </div>

                    <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '4px' }}>
                        
                        <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <Settings2 size={20} style={{ color: 'var(--primary)' }} />
                                <h3 style={{ margin: 0, fontSize: '16px' }}>분석 옵션 ({tabs[activeTabIdx]?.name})</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={useBootstrapping} onChange={(e) => setUseBootstrapping(e.target.checked)} />
                                    Bootstrap 간접효과 검증 (Process Macro Model 4)
                                </label>
                                {useBootstrapping && (
                                    <div style={{ paddingLeft: '24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                        리샘플링 횟수:
                                        <input 
                                            type="number" 
                                            value={bootCount} 
                                            onChange={(e) => setBootCount(Number(e.target.value))}
                                            style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
                                        />
                                    </div>
                                )}
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={useSobel} onChange={(e) => setUseSobel(e.target.checked)} />
                                    Sobel Test (Z-Score)
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'not-allowed', opacity: 0.5 }}>
                                    <input type="checkbox" checked={useScheffe} onChange={(e) => setUseScheffe(e.target.checked)} disabled />
                                    Scheffe 사후분석 (ANOVA 전용)
                                </label>
                            </div>
                            <button 
                                className="btn-primary" 
                                style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                onClick={handleAnalyze}
                                disabled={loading}
                            >
                                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Settings2 size={18} />}
                                {loading ? '분석 재수행 중...' : '옵션 적용 / 재분석'}
                            </button>
                        </div>

                        <div className="glass-panel" style={{ flex: 1, borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)' }}>
                                <FileText size={18} style={{ color: 'var(--primary)' }} />
                                <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>논문 텍스트 자동 해석</h3>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '16px 20px 0 20px' }}>
                                해당 탭의 매개효과 분석 결과를 바탕으로 작성된 상세한 논문 해석 초안입니다.
                            </p>
                            <div style={{ padding: '20px', fontSize: '14px', lineHeight: '1.8', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', flex: 1, overflowY: 'auto' }}>
                                {generateInterpretation()}
                            </div>
                        </div>
                    </div>
                </div>
            );
        })() : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--error)' }}>
              * 변수 매핑 화면에서 매개변수(Med)가 1개 이상 설정되어야 합니다.
          </div>
      )}
    </div>
  );
};
