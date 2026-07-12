import { exportHtmlTableToExcel } from '../../utils/excelExport';
import React, { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUiStore } from '../../store/uiStore';
import { Download, FileText, Settings2, RefreshCw } from 'lucide-react';
import { ModerationTable } from './ModerationTable';
import { ModeratedMediationTable } from './ModeratedMediationTable';
import { apiFetch } from '../../utils/apiClient';


export const ModeratedMediationView: React.FC = () => {
    const { factorResults, mappedVars, savedModelEdges, savedModelNodes } = useAnalysisStore();
    const { setCurrentStep } = useUiStore();

    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [useBootstrapping, setUseBootstrapping] = useState(false);
    const [bootCount, setBootCount] = useState(5000);
    const [useFixedSeed, setUseFixedSeed] = useState(true);
    const [seed, setSeed] = useState(1234);
    const [useSobel, setUseSobel] = useState(false);

    const [isExporting1, setIsExporting1] = useState(false);
    const [isExporting2, setIsExporting2] = useState(false);

    const tabs = React.useMemo(() => {
        const pairs: { iv: any, med: any, mod: any, dv: any, id: string, name: string, analysisType: string, modelType?: number }[] = [];

        if (savedModelEdges && savedModelEdges.length > 0 && savedModelNodes && savedModelNodes.length > 0) {
            // 1. Find standard paths (IV -> DV, IV -> Med, Med -> DV) ignoring moderators for a moment
            const logicalPaths: { source: string, target: string, label: string }[] = [];
            const modPaths: { source: string, target: string, modId: string, label: string }[] = [];
            
            savedModelEdges.forEach((e: any) => {
                const srcNode = savedModelNodes.find((n: any) => n.id === e.source);
                if (srcNode?.type === 'customVariable' && srcNode?.data?.varType !== 'mod') {
                    let currentTargetId = e.target;
                    let currentLabel = e.label || '';
                    let isValidPath = false;
                    let finalTargetId = '';
                    let foundModId = '';
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
                            // Check if there is a moderator pointing to this junction
                            const modEdge = savedModelEdges.find((me: any) => me.target === currentTargetId && me.source !== e.source);
                            if (modEdge) {
                                const possibleMod = savedModelNodes.find((n: any) => n.id === modEdge.source && n.data?.varType === 'mod');
                                if (possibleMod) foundModId = possibleMod.id;
                            }
                            
                            const nextEdge = savedModelEdges.find((nextE: any) => nextE.source === currentTargetId);
                            if (!nextEdge) break;
                            if (!currentLabel && nextEdge.label) currentLabel = nextEdge.label;
                            currentTargetId = nextEdge.target;
                        } else {
                            break;
                        }
                    }
                    if (isValidPath && finalTargetId) {
                        if (foundModId) {
                            modPaths.push({ source: e.source, target: finalTargetId, modId: foundModId, label: currentLabel });
                        } else {
                            logicalPaths.push({ source: e.source, target: finalTargetId, label: currentLabel });
                        }
                    }
                }
            });

            const allIvs = [...(mappedVars.iv || []), ...(mappedVars.med || []), ...(mappedVars.mod || [])];
            const allDvs = [...(mappedVars.dv || []), ...(mappedVars.med || [])];
            const allMeds = mappedVars.med || [];
            const allMods = mappedVars.mod || [];

            let counter = 1;
            
            // Reconstruct Mediation / Moderated Mediation
            allMeds.forEach((medVar: any) => {
                // Incoming paths to Med
                const inPaths = logicalPaths.filter(p => p.target === medVar.id);
                const inModPaths = modPaths.filter(p => p.target === medVar.id);
                
                // Outgoing paths from Med
                const outPaths = logicalPaths.filter(p => p.source === medVar.id);
                const outModPaths = modPaths.filter(p => p.source === medVar.id);
                
                const combinedIn = [...inPaths, ...inModPaths.map(p => ({...p, isMod: true}))];
                const combinedOut = [...outPaths, ...outModPaths.map(p => ({...p, isMod: true}))];
                
                combinedIn.forEach((inP: any) => {
                    combinedOut.forEach((outP: any) => {
                        const ivVar = allIvs.find(v => v.id === inP.source);
                        const dvVar = allDvs.find(v => v.id === outP.target);
                        
                        if (ivVar && dvVar) {
                            let hLabel = inP.label || outP.label || `H${counter}`;
                            counter++;
                            
                            if (inP.isMod || outP.isMod) {
                                const modVar = allMods.find(v => v.id === (inP.modId || outP.modId));
                                if (modVar) {
                                    const mType = inP.isMod ? 7 : 14;
                                    pairs.push({
                                        iv: ivVar, med: medVar, mod: modVar, dv: dvVar,
                                        id: hLabel,
                                        name: `[${hLabel} 조절된 매개 (Model ${mType})] ${ivVar.name} → ${medVar.name} → ${dvVar.name} (조절: ${modVar.name})`,
                                        analysisType: 'moderated_mediation',
                                        modelType: mType
                                    });
                                }
                            } else {
                                pairs.push({
                                    iv: ivVar, med: medVar, mod: null, dv: dvVar,
                                    id: hLabel,
                                    name: `[${hLabel} 매개효과] ${ivVar.name} → ${medVar.name} → ${dvVar.name}`,
                                    analysisType: 'mediation'
                                });
                            }
                        }
                    });
                });
            });
            
            // Reconstruct Pure Moderation
            modPaths.forEach(mp => {
                const ivVar = allIvs.find(v => v.id === mp.source);
                const dvVar = allDvs.find(v => v.id === mp.target);
                const modVar = allMods.find(v => v.id === mp.modId);
                
                // Avoid duplicating paths already caught in moderated mediation
                const isMedPath = allMeds.some(m => m.id === mp.source || m.id === mp.target);
                
                if (ivVar && dvVar && modVar && !isMedPath) {
                    let hLabel = mp.label || `H${counter}`;
                    counter++;
                    pairs.push({
                        iv: ivVar, med: null, mod: modVar, dv: dvVar,
                        id: hLabel,
                        name: `[${hLabel} 조절효과] ${ivVar.name} → ${dvVar.name} (조절: ${modVar.name})`,
                        analysisType: 'moderation'
                    });
                }
            });
            
            // If the graph didn't capture them well, but it's a valid graph, we return what we found.
            if (pairs.length > 0) return pairs.filter(p => p.analysisType === 'moderated_mediation');
        }

        // Fallback combinatorics if no graph or failed parsing
        let counter = 1;
        if (mappedVars.iv && mappedVars.dv) {
            if (mappedVars.med && mappedVars.med.length > 0 && (!mappedVars.mod || mappedVars.mod.length === 0)) {
                mappedVars.iv.forEach((iv: any) => { mappedVars.med.forEach((med: any) => { mappedVars.dv.forEach((dv: any) => { pairs.push({ iv, med, mod: null, dv, id: `H${counter}`, name: `[H${counter}] ${iv.name} → ${med.name} → ${dv.name}`, analysisType: 'mediation' }); counter++; }); }); });
            }
            if (mappedVars.mod && mappedVars.mod.length > 0 && (!mappedVars.med || mappedVars.med.length === 0)) {
                mappedVars.iv.forEach((iv: any) => { mappedVars.mod.forEach((mod: any) => { mappedVars.dv.forEach((dv: any) => { pairs.push({ iv, med: null, mod, dv, id: `H${counter}`, name: `[H${counter}] ${iv.name} → ${dv.name} (조절: ${mod.name})`, analysisType: 'moderation' }); counter++; }); }); });
            }
            if (mappedVars.med && mappedVars.med.length > 0 && mappedVars.mod && mappedVars.mod.length > 0) {
                mappedVars.iv.forEach((iv: any) => { mappedVars.med.forEach((med: any) => { mappedVars.mod.forEach((mod: any) => { mappedVars.dv.forEach((dv: any) => { pairs.push({ iv, med, mod, dv, id: `H${counter}`, name: `[H${counter}] ${iv.name} → ${med.name} → ${dv.name} (조절: ${mod.name})`, analysisType: 'moderated_mediation', modelType: 14 }); counter++; }); }); }); });
            }
        }
        return pairs.filter(p => p.analysisType === 'moderated_mediation');
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
        const targetSubFactors = res?.extractedSubFactors || v.subFactors;

        // If no factor analysis result, just use the original structure
        if (!res || !res.matrixItems) {
            if (targetSubFactors && targetSubFactors.length > 0) {
                targetSubFactors.forEach((sf: any) => {
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

        if (targetSubFactors && targetSubFactors.length > 0) {
            targetSubFactors.forEach((sf: any) => {
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
        const { iv, med, mod, dv, analysisType } = currentTab;

        const ivPayload = iv ? getPayload(iv) : [];
        const medPayload = med ? getPayload(med) : [];
        const modPayload = mod ? getPayload(mod) : [];
        const dvPayload = dv ? getPayload(dv) : [];

        if (ivPayload.length === 0 || dvPayload.length === 0 || modPayload.length === 0) return;

        setLoading(true);
        try {
            const res = await apiFetch(`/api/analysis/mediation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    iv_parent_name: iv.name,
                    med_parent_name: med?.name || '',
                    dv_parent_name: dv.name,
                    ivs: ivPayload,
                    meds: medPayload,
                    mods: modPayload,
                    dvs: dvPayload,
                    n_boot: useBootstrapping ? bootCount : 0,
                    seed: useBootstrapping && useFixedSeed ? seed : null,
                    analysis_type: analysisType,
                    model_type: currentTab.modelType || 14
                })
            });
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();

            setResults({
                ...data,
                ivPayload,
                medPayload,
                modPayload,
                dvPayload,
                ivParentName: iv.name,
                medParentName: med?.name,
                modParentName: mod?.name,
                dvParentName: dv.name,
                hypothesisName: currentTab.id,
                analysisType: analysisType
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
            const hLabel = results.hypothesisName || 'H';
            let subHIdx = 1;
            let adoptedCount = 0;
            let totalHypotheses = 0;

            results.results.forEach((dvRes: any) => {
                const idxObj = dvRes.index_of_moderated_mediation;
                let status = '기각';
                if (idxObj && (idxObj.llci > 0 || idxObj.ulci < 0)) {
                    status = '채택';
                    adoptedCount++;
                }
                totalHypotheses++;
                
                hypothesesRows.push({
                    '가설': `${hLabel}-${subHIdx++}`,
                    '가설 내용': `'${results.modParentName}'은(는) '${results.ivParentName}'와(과) '${dvRes.dv_name}' 간의 관계를 매개하는 '${results.medParentName}'의 간접효과를 조절할 것이다.`,
                    '채택여부': status
                });
            });

            let mainStatus = '기각';
            if (totalHypotheses > 0) {
                if (adoptedCount === 0) mainStatus = '기각';
                else if (adoptedCount === totalHypotheses) mainStatus = '채택';
                else mainStatus = '부분 채택';
            }

            hypothesesRows.unshift({
                '가설': hLabel,
                '가설 내용': `${results.modParentName}은(는) ${results.ivParentName}이(가) ${results.medParentName}을(를) 거쳐 ${results.dvParentName}에 미치는 매개효과를 조절할 것이다.`,
                '채택여부': mainStatus
            });

            const res = await apiFetch(`/api/analysis/mediation/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `조절된 매개효과 가설 검증 결과`,
                    rows: hypothesesRows
                })
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'hypothesis_table.xlsx';
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

    const handleExportMediation = async (dvRes: any, models?: any[]) => {
        setIsExporting2(true);
        try {
            const title = `<표> 독립변수와 ${dvRes.dv_name}의 관계에서 ${dvRes.mod_name}의 조절된 매개효과`;
            const filename = `moderated_mediation_table_${dvRes.dv_name}.xlsx`;
            exportHtmlTableToExcel(title, filename, ['mod-med-table']);
        } catch (err) {
            console.error(err);
            alert('엑셀 다운로드 중 오류가 발생했습니다.');
        } finally {
            setIsExporting2(false);
        }
    };

    const generateInterpretation = () => {
        if (!results) return "";
        let text = `본 연구에서 설정한 가설 ${results.hypothesisName}을(를) 검증하기 위하여, 조절된 매개효과(Moderated Mediation) 분석을 실시하였다. 구체적으로 독립변수 [${results.ivParentName}]이(가) 매개변수 [${results.medParentName}]을(를) 거쳐 종속변수 [${results.dvParentName}]에 미치는 간접효과가 조절변수 [${results.modParentName}]의 수준에 따라 달라지는지 확인하기 위해 PROCESS Macro Model 14를 적용하였다.

`;

        results.results.forEach((dvRes: any) => {
            text += `### 📌 종속변수: [${dvRes.dv_name}]에 대한 분석 결과

`;
            
            const mM = dvRes.m_model;
            const yM = dvRes.y_model;
            const idxObj = dvRes.index_of_moderated_mediation;
            
            text += `**1. 매개모형(M Model) 분석 결과:**
`;
            text += `독립변수가 매개변수 [${dvRes.med_name}]에 미치는 영향을 확인한 결과, 모형의 설명력은 ${(mM.r_squared * 100).toFixed(1)}%로 나타났고 통계적으로 유의하였다(F=${mM.f_value.toFixed(3)}, p=${mM.f_p_value < 0.001 ? '<.001' : mM.f_p_value.toFixed(3)}). `;
            const ivCoefM = mM.coefficients.find((c: any) => c.name !== '상수');
            if (ivCoefM && ivCoefM.p < 0.05) {
                text += `독립변수는 매개변수에 유의한 영향을 미쳤다(p=${ivCoefM.p < 0.001 ? '<.001' : ivCoefM.p.toFixed(3)}).

`;
            } else {
                text += `독립변수는 매개변수에 통계적으로 유의한 영향을 미치지 않았다.

`;
            }

            text += `**2. 종속모형(Y Model) 분석 결과:**
`;
            text += `독립변수, 매개변수, 조절변수 및 상호작용항을 투입하여 종속변수 [${dvRes.dv_name}]에 미치는 영향을 분석한 결과, 모형의 설명력은 ${(yM.r_squared * 100).toFixed(1)}%로 유의하였다(F=${yM.f_value.toFixed(3)}, p=${yM.f_p_value < 0.001 ? '<.001' : yM.f_p_value.toFixed(3)}). `;
            const intCoef = yM.coefficients.find((c: any) => c.name.includes('X') || c.name.includes('x'));
            if (intCoef && intCoef.p < 0.05) {
                text += `특히 매개변수와 조절변수의 상호작용항이 통계적으로 유의하게 나타나(p=${intCoef.p < 0.001 ? '<.001' : intCoef.p.toFixed(3)}), 조절된 매개효과가 존재할 가능성을 확인하였다.

`;
            } else {
                text += `다만 매개변수와 조절변수의 상호작용항은 통계적으로 유의하지 않았다.

`;
            }

            text += `**3. 조절된 매개효과 지수(Index of Moderated Mediation) 및 조건부 간접효과:**
`;
            if (idxObj && (idxObj.llci > 0 || idxObj.ulci < 0)) {
                text += `조절된 매개효과의 통계적 유의성을 검증하기 위해 부트스트래핑(Bootstrapping)을 실시하여 조절된 매개효과 지수(Index)를 확인하였다. 그 결과, 지수 값은 ${idxObj.index.toFixed(4)}이었으며, 95% 신뢰구간(LLCI=${idxObj.llci.toFixed(4)}, ULCI=${idxObj.ulci.toFixed(4)})에 0이 포함되지 않아 조절된 매개효과가 통계적으로 유의함이 입증되었다. `;
                text += `**따라서 가설은 최종적으로 채택되었다.**

`;
            } else {
                text += `조절된 매개효과 지수(Index)를 살펴본 결과, 값은 ${idxObj ? idxObj.index.toFixed(4) : 0}이었으나, 95% 부트스트랩 신뢰구간(LLCI=${idxObj ? idxObj.llci.toFixed(4) : 0}, ULCI=${idxObj ? idxObj.ulci.toFixed(4) : 0})에 0이 포함되어 통계적으로 유의하지 않았다. `;
                text += `**따라서 가설은 기각되었다.**

`;
            }
            
            if (dvRes.conditional_effects && dvRes.conditional_effects.length > 0) {
                text += `조절변수 수준별 조건부 간접효과를 살펴보면 다음과 같다:
`;
                dvRes.conditional_effects.forEach((ce: any) => {
                    const isSig = ce.llci > 0 || ce.ulci < 0;
                    text += `- 조절변수가 [${ce.w_label}] 수준일 때: 간접효과 ${ce.effect.toFixed(4)} (BootLLCI=${ce.llci.toFixed(4)}, BootULCI=${ce.ulci.toFixed(4)}) - ${isSig ? '유의함' : '유의하지 않음'}
`;
                });
                text += `
`;
            }
        });

        return text;
    };

    useEffect(() => {
        if (results && results.results && results.results.length > 0) {
            useAnalysisStore.getState().setCachedResult(`mod_med_${activeTabIdx}`, {
                results,
                settings: { useBootstrapping, bootCount, tabName: tabs[activeTabIdx]?.name },
                interpretation: generateInterpretation()
            });
        }
    }, [results, activeTabIdx, useBootstrapping, bootCount]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>

            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 className="text-h3" style={{ margin: 0 }}>조절된 매개효과 분석</h2>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
                    <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
                        조절된 매개효과 분석을 수행합니다.
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
                    {useBootstrapping ? "데이터 분석 중... (Bootstrap 횟수에 따라 수십 초 이상 소요될 수 있습니다)" : "데이터 분석 중..."}
                </div>
            ) : results ? (() => {
                const hypotheses: any[] = [];
                const hLabel = results.hypothesisName || 'H';
                let subHIdx = 1;
                let adoptedCount = 0;
                let totalHypotheses = 0;

                results.results.forEach((dvRes: any) => {
                    const idxObj = dvRes.index_of_moderated_mediation;
                    let status = '기각';
                    // If 0 is not in [llci, ulci], then it is significant
                    if (idxObj && (idxObj.llci > 0 || idxObj.ulci < 0)) {
                        status = '채택';
                        adoptedCount++;
                    }
                    totalHypotheses++;
                    
                    hypotheses.push({
                        id: `${hLabel}-${subHIdx++}`,
                        desc: `'${results.modParentName}'은(는) '${results.ivParentName}'와(과) '${dvRes.dv_name}' 간의 관계를 매개하는 '${results.medParentName}'의 간접효과를 조절할 것이다.`,
                        isParent: false,
                        status: status
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
                    desc: `${results.modParentName}은(는) ${results.ivParentName}이(가) ${results.medParentName}을(를) 거쳐 ${results.dvParentName}에 미치는 매개효과를 조절할 것이다.`,
                    isParent: true,
                    status: mainStatus
                });

                return (

                <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
                    
                    <div style={{flex: '1.4', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingRight: '4px'}}>
                        <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                                <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>가설 설정 ({results?.hypothesisName})</h3>
                                <button onClick={handleExportHypothesis} disabled={isExporting1} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px', height: 'auto' }}>
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

                        <ModeratedMediationTable results={results} onExport={() => handleExportMediation(results.results[0], results.results[0].models || [])} isExporting={isExporting2} />
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
                                        Bootstrap 검증 (Process Macro)
                                    </label>
                                    {useBootstrapping && (
                                        <div style={{ paddingLeft: '24px', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                리샘플링 횟수:
                                                <input
                                                    type="number"
                                                    value={bootCount}
                                                    onChange={(e) => setBootCount(Number(e.target.value))}
                                                    style={{ width: '80px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
                                                />
                                            </div>
                                        </div>
                                    )}
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
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                                    <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>논문 텍스트 자동 해석</h3>
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '16px 20px 0 20px' }}>
                                    해당 탭의 분석 결과를 바탕으로 작성된 상세한 논문 해석 초안입니다.
                                </p>
                                <div style={{ padding: '20px', fontSize: '14px', lineHeight: '1.8', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', flex: 1, overflowY: 'auto' }}>
                                    {generateInterpretation()}
                                </div>
                            </div>
                        </div>

                </div>
                );
            })() : (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <p style={{ marginBottom: '8px' }}>현재 설계된 연구 모형에는 <b>조절된 매개효과</b> (조절변수가 매개경로를 조절하는 형태)가 없습니다.</p>
                    <p style={{ fontSize: '14px', color: 'var(--primary)' }}>* 조절변수가 독립변수 → 종속변수를 직접 조절하도록 설계하신 경우, <b>[조절효과]</b> 메뉴를 확인해주세요.</p>
                </div>
            )}
        </div>
    );
};
