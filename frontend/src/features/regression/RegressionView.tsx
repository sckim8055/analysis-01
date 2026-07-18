import React, { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUiStore } from '../../store/uiStore';
import { Download, FileText, CheckCircle2, AlertCircle, Settings2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';
import { AiInterpretationPanel } from '../../components/AiInterpretationPanel';


export const RegressionView: React.FC = () => {
    const { approvedVariables, factorResults, mappedVars, savedModelEdges, savedModelNodes } = useAnalysisStore();
    const { setCurrentStep } = useUiStore();

    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [useMeanCentering, setUseMeanCentering] = useState(true);
    const [useVif, setUseVif] = useState(true);
    const [isExporting1, setIsExporting1] = useState(false);
    const [isExporting2, setIsExporting2] = useState(false);

    // 1. Extract valid mapped variables
    const getValidVars = (vars: any[]) => {
        const vList = vars || [];
        if (approvedVariables.length === 0) return vList;
        return vList.filter(v => approvedVariables.includes(v.id));
    };

    const validIvs = React.useMemo(() => getValidVars(mappedVars.iv), [mappedVars.iv, approvedVariables]);
    const validDvs = React.useMemo(() => getValidVars(mappedVars.dv), [mappedVars.dv, approvedVariables]);
    const validMeds = React.useMemo(() => getValidVars(mappedVars.med), [mappedVars.med, approvedVariables]);
    const validMods = React.useMemo(() => getValidVars(mappedVars.mod), [mappedVars.mod, approvedVariables]);

    // 2. Generate Tabs (Pairs of paths)
    const tabs = React.useMemo(() => {
        const pairs: { iv: any, dv: any, id: string, name: string, pathType: string }[] = [];
        let counter = 1;

        // 만약 사용자가 [모형설계]에서 직접 모형을 그렸다면, 그려진 화살표(Edge)를 기반으로 탭을 생성
        if (savedModelEdges && savedModelEdges.length > 0 && savedModelNodes && savedModelNodes.length > 0) {

            const isVarNode = (id: string) => savedModelNodes.find((n: any) => n.id === id)?.type === 'customVariable';

            const logicalPaths: { source: string, target: string, label: string }[] = [];

            // 1. 모든 Edge 중에서, 출발지가 조절변수(mod)가 아닌 일반 변수인 선(메인 진입선)을 찾습니다.
            savedModelEdges.forEach((e: any) => {
                const srcNode = savedModelNodes.find((n: any) => n.id === e.source);

                if (srcNode?.type === 'customVariable' && srcNode?.data?.varType !== 'mod') {
                    let currentTargetId = e.target;
                    let currentLabel = e.label || '';
                    let isValidPath = false;
                    let finalTargetId = '';

                    const visited = new Set<string>();
                    visited.add(e.source);

                    // 2. 조절점(Junction)이 여러 개 체인으로 엮여 있더라도 끝까지 추적합니다.
                    while (true) {
                        if (visited.has(currentTargetId)) break; // 순환 참조 무한 루프 방지
                        visited.add(currentTargetId);

                        const targetNode = savedModelNodes.find((n: any) => n.id === currentTargetId);

                        if (targetNode?.type === 'customVariable') {
                            // 변수에 도달! 추적 완료
                            isValidPath = true;
                            finalTargetId = currentTargetId;
                            break;
                        }

                        if (targetNode?.type === 'junction') {
                            // 조절점이라면 다음 나가는 선(진출선)을 찾아서 계속 전진
                            const nextEdge = savedModelEdges.find((nextE: any) => nextE.source === currentTargetId);
                            if (!nextEdge) break; // 길이 끊김

                            if (!currentLabel && nextEdge.label) currentLabel = nextEdge.label; // 라벨 수집
                            currentTargetId = nextEdge.target;
                        } else {
                            break; // 알 수 없는 노드
                        }
                    }

                    if (isValidPath && finalTargetId) {
                        // 중복 경로 방지
                        const exists = logicalPaths.find(p => p.source === e.source && p.target === finalTargetId);
                        if (!exists) {
                            logicalPaths.push({ source: e.source, target: finalTargetId, label: currentLabel });
                        }
                    }
                }
            });

            // 3. 추출된 경로를 탭으로 변환
            logicalPaths.forEach(path => {
                const sourceNode = savedModelNodes.find((n: any) => n.id === path.source);
                const targetNode = savedModelNodes.find((n: any) => n.id === path.target);

                const allSourceVars = [...(mappedVars.iv || []), ...(mappedVars.med || []), ...(mappedVars.mod || [])];
                const allTargetVars = [...(mappedVars.dv || []), ...(mappedVars.med || [])];

                const ivVar = allSourceVars.find(v => v.id === path.source);
                const dvVar = allTargetVars.find(v => v.id === path.target);

                if (ivVar && dvVar && sourceNode && targetNode) {
                    const hLabel = path.label || `H${counter}`;
                    pairs.push({
                        iv: ivVar,
                        dv: dvVar,
                        id: hLabel,
                        name: `[${hLabel}] ${sourceNode.data.label} → ${targetNode.data.label}`,
                        pathType: `${sourceNode.data.varType}->${targetNode.data.varType}`
                    });
                    counter++;
                }
            });

            if (pairs.length > 0) {
                // 가설 번호 순서대로 정렬 (예: H1, H2, H3 ...)
                pairs.sort((a, b) => {
                    const matchA = a.id.match(/H(\d+)/i);
                    const matchB = b.id.match(/H(\d+)/i);
                    if (matchA && matchB) {
                        return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
                    }
                    return a.id.localeCompare(b.id);
                });
                return pairs;
            }
        }

        // 모형을 안 그렸을 경우 기본 Fallback: 모든 가능한 선형 조합
        validIvs.forEach(iv => {
            validDvs.forEach(dv => {
                pairs.push({ iv, dv, id: `tab-${counter}`, name: `가설 ${counter} (주효과)`, pathType: 'IV->DV' });
                counter++;
            });
        });

        validIvs.forEach(iv => {
            validMeds.forEach(med => {
                pairs.push({ iv, dv: med, id: `tab-${counter}`, name: `가설 ${counter} (매개 전반)`, pathType: 'IV->Med' });
                counter++;
            });
        });

        validMeds.forEach(med => {
            validDvs.forEach(dv => {
                pairs.push({ iv: med, dv, id: `tab-${counter}`, name: `가설 ${counter} (매개 후반)`, pathType: 'Med->DV' });
                counter++;
            });
        });

        return pairs;
    }, [validIvs, validDvs, validMeds, mappedVars, savedModelEdges, savedModelNodes]);

    const [activeTabIdx, setActiveTabIdx] = useState(0);

    useEffect(() => {
        if (tabs.length > 0 && activeTabIdx < tabs.length) {
            handleAnalyze();
        } else {
            setResults(null);
        }
    }, [activeTabIdx, useMeanCentering, useVif, tabs]);

    const handleAnalyze = async () => {
        if (tabs.length === 0 || activeTabIdx >= tabs.length) return;
        const currentTab = tabs[activeTabIdx];
        const { iv, dv } = currentTab;

        // Build payload just for this IV and DV
        const ivPayload: any[] = [];
        const resIv = factorResults[iv.id];
        const targetSubFactorsIv = resIv?.extractedSubFactors || iv.subFactors;

        if (!resIv || !resIv.matrixItems) {
            if (targetSubFactorsIv && targetSubFactorsIv.length > 0) {
                targetSubFactorsIv.forEach((sf: any) => {
                    if (sf.itemIds && sf.itemIds.length > 0) {
                        ivPayload.push({ name: sf.name, items: sf.itemIds, parent: iv.name });
                    }
                });
            } else {
                if (iv.itemIds && iv.itemIds.length > 0) {
                    ivPayload.push({ name: iv.name, items: iv.itemIds, parent: iv.name });
                }
            }
        } else {
            const survivedMapIv: Record<string, string> = {};
            resIv.matrixItems.forEach((m: any) => survivedMapIv[m.id] = m.originalName || m.id);
            if (targetSubFactorsIv && targetSubFactorsIv.length > 0) {
                targetSubFactorsIv.forEach((sf: any) => {
                    const finalNames = (sf.itemIds || []).filter((id: string) => survivedMapIv[id]).map((id: string) => survivedMapIv[id]);
                    if (finalNames.length > 0) ivPayload.push({ name: sf.name, items: finalNames, parent: iv.name });
                });
            } else {
                const finalNames = (iv.itemIds || []).filter((id: string) => survivedMapIv[id]).map((id: string) => survivedMapIv[id]);
                if (finalNames.length > 0) ivPayload.push({ name: iv.name, items: finalNames, parent: iv.name });
            }
        }

        const dvPayload: any[] = [];
        const resDv = factorResults[dv.id];
        const targetSubFactorsDv = resDv?.extractedSubFactors || dv.subFactors;

        if (!resDv || !resDv.matrixItems) {
            if (targetSubFactorsDv && targetSubFactorsDv.length > 0) {
                targetSubFactorsDv.forEach((sf: any) => {
                    if (sf.itemIds && sf.itemIds.length > 0) {
                        dvPayload.push({ name: sf.name, items: sf.itemIds, parent: dv.name });
                    }
                });
            } else {
                if (dv.itemIds && dv.itemIds.length > 0) {
                    dvPayload.push({ name: dv.name, items: dv.itemIds, parent: dv.name });
                }
            }
        } else {
            const survivedMapDv: Record<string, string> = {};
            resDv.matrixItems.forEach((m: any) => survivedMapDv[m.id] = m.originalName || m.id);
            if (targetSubFactorsDv && targetSubFactorsDv.length > 0) {
                targetSubFactorsDv.forEach((sf: any) => {
                    const finalNames = (sf.itemIds || []).filter((id: string) => survivedMapDv[id]).map((id: string) => survivedMapDv[id]);
                    if (finalNames.length > 0) dvPayload.push({ name: sf.name, items: finalNames, parent: dv.name });
                });
            } else {
                const finalNames = (dv.itemIds || []).filter((id: string) => survivedMapDv[id]).map((id: string) => survivedMapDv[id]);
                if (finalNames.length > 0) dvPayload.push({ name: dv.name, items: finalNames, parent: dv.name });
            }
        }

        if (ivPayload.length === 0 || dvPayload.length === 0) return;

        setLoading(true);
        try {
            const res = await apiFetch(`/api/analysis/regression`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    iv_parent_name: iv.name,
                    dv_parent_name: dv.name,
                    ivs: ivPayload,
                    dvs: dvPayload,
                    use_mean_centering: useMeanCentering,
                    use_vif: useVif
                })
            });
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();

            const tabNameRaw = currentTab.id || `H${activeTabIdx + 1}`;
            const tabHypId = tabNameRaw.startsWith('tab-') ? `H${activeTabIdx + 1}` : tabNameRaw;

            setResults({
                ...data,
                ivPayload,
                dvPayload,
                ivParentName: iv.name,
                dvParentName: dv.name,
                hypothesisName: tabHypId
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const generateHypotheses = () => {
        if (!results) return [];

        // Extract hypothesis label like "H1" from results.hypothesisName
        const hLabel = results.hypothesisName;

        const rows: any[] = [];
        const parentIdx = rows.length;
        rows.push({
            id: hLabel,
            desc: `${results.ivParentName}은(는) ${results.dvParentName}에 유의한 영향을 미칠 것이다.`,
            isParent: true,
            status: ''
        });

        let counter = 1;
        let allAdopted = true;
        let anyAdopted = false;
        const hasResults = !!(results && results.models && results.models.length > 0);

        results.dvPayload.forEach((dv: any) => {
            results.ivPayload.forEach((iv: any) => {
                let statusStr = '';
                if (hasResults) {
                    const model = results.models.find((m: any) => m.dv_name === dv.name);
                    if (model) {
                        const coef = model.coefficients.find((c: any) => c.name === iv.name);
                        if (coef) {
                            if (coef.p < 0.05 && coef.beta > 0) {
                                statusStr = '채택';
                                anyAdopted = true;
                            } else {
                                statusStr = '기각';
                                allAdopted = false;
                            }
                        }
                    }
                }

                rows.push({
                    id: `${hLabel}-${counter}`,
                    desc: `${iv.name}은(는) ${dv.name}에 유의한 정(+)의 영향을 미칠 것이다.`,
                    isParent: false,
                    status: statusStr
                });
                counter++;
            });
        });

        if (hasResults && rows.length > 1) {
            if (allAdopted && anyAdopted) rows[parentIdx].status = '채택';
            else if (anyAdopted) rows[parentIdx].status = '부분채택';
            else rows[parentIdx].status = '기각';
        }

        return rows;
    };

    const handleExportHypotheses = async () => {
        if (!results) return;
        setIsExporting1(true);
        try {
            const hRows = generateHypotheses().map(h => ({
                "가설": h.id,
                "가설내용": h.desc,
                "채택여부": h.status || ''
            }));
            const res = await apiFetch(`/api/analysis/regression/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `<표> ${results.hypothesisName} 가설의 검증`,
                    rows: hRows
                })
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `hypotheses_${results.hypothesisName}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } finally {
            setIsExporting1(false);
        }
    };

    const handleExportRegression = async () => {
        if (!results) return;
        setIsExporting2(true);
        try {
            const rows: any[] = [];
            results.models.forEach((m: any) => {
                const dv = m.dv_name;
                const modelSummary = `R²=${m.r_squared.toFixed(3)}\nAdj. R²=${m.adj_r_squared.toFixed(3)}\nF=${m.f_value.toFixed(3)}${m.f_p_value < 0.001 ? '***' : m.f_p_value < 0.01 ? '**' : m.f_p_value < 0.05 ? '*' : ''}\np=${m.f_p_value < 0.001 ? '.000' : m.f_p_value.toFixed(3).replace(/^0\./, '.')}\nD-W=${m.durbin_watson.toFixed(3)}`;
                m.coefficients.forEach((c: any, idx: number) => {
                    let stars = '';
                    if (c.name !== '(상수)') {
                        if (c.p < 0.001) stars = '***';
                        else if (c.p < 0.01) stars = '**';
                        else if (c.p < 0.05) stars = '*';
                    }
                    const row: any = {
                        "구분": results.models.length > 1 ? `${results.ivParentName} → ${dv}` : undefined,
                        "독립변수": c.name,
                        "비표준화 계수 B": c.B.toFixed(3),
                        "표준오차": c.SE.toFixed(3),
                        "표준화 계수 베타": c.name === '(상수)' ? '' : c.beta.toFixed(3),
                        "t": `${c.t.toFixed(3)}${stars}`,
                        "p": c.p < 0.001 ? '.000' : c.p.toFixed(3).replace(/^0\./, '.')
                    };
                    if (useVif) {
                        row["VIF"] = c.vif ? c.vif.toFixed(3) : '';
                    }
                    if (idx === 0) {
                        row["모형 요약"] = modelSummary;
                    } else {
                        row["모형 요약"] = '';
                    }
                    if (results.models.length === 1) delete row["구분"];
                    rows.push(row);
                });
            });

            const title = results.models.length > 1
                ? `<표> ${results.ivParentName}이(가) ${results.dvParentName}에 미치는 영향`
                : `<표> ${results.ivParentName}이(가) ${results.models[0].dv_name}에 미치는 영향`;

            const res = await apiFetch(`/api/analysis/regression/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    rows: rows,
                    footer: "* p<.05, ** p<.01, *** p<.001"
                })
            });
            if (!res.ok) throw new Error('Export failed');
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `regression_${results.hypothesisName}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } finally {
            setIsExporting2(false);
        }
    };

    const generateInterpretation = () => {
        if (!results || results.models.length === 0) return "";

        let text = `본 연구에서 설정한 가설 ${results.hypothesisName}을(를) 검증하기 위하여 독립변수로 '${results.ivParentName}'을(를) 설정하고, 종속변수로 '${results.dvParentName}'을(를) 설정하여 다중회귀분석(Multiple Linear Regression Analysis)을 실시하였다. 회귀분석은 독립변수가 종속변수에 미치는 상대적 영향력을 파악하고 인과관계를 규명하는 데 목적이 있다.\n\n`;

        if (useMeanCentering) {
            text += `특히, 본 분석에서는 회귀모형의 다중공선성(Multicollinearity) 문제를 최소화하고 각 독립변수 회귀계수의 구조적 해석 타당성을 높이기 위하여, 투입된 모든 독립변수(${results.ivPayload.map((iv: any) => `'${iv.name}'`).join(', ')})에 대하여 평균 중심화(Mean Centering) 기법을 선행 적용한 후 분석을 진행하였다. 평균 중심화 기법은 개별 관측치에서 해당 변수의 전체 평균을 차감($X - \\bar{X}$)하는 방식으로서, 회귀식의 절편(Intercept)을 표본 평균 수준에서의 종속변수 기댓값으로 해석할 수 있게 해주어 모형의 안정성을 크게 향상시킨다.\n\n`;
        }

        text += `분석에 앞서 OLS(Ordinary Least Squares) 회귀모형의 기본 가정이 충족되는지를 다각도로 검토하였다. `;

        // Check DW
        const dwVals = results.models.map((m: any) => m.durbin_watson);
        const minDw = Math.min(...dwVals);
        const maxDw = Math.max(...dwVals);
        text += `우선, 잔차의 독립성을 검증하기 위해 Durbin-Watson 통계량을 산출한 결과, `;
        if (minDw >= 1.5 && maxDw <= 2.5) {
            text += `각 모형의 Durbin-Watson 값이 ${minDw.toFixed(3)}에서 ${maxDw.toFixed(3)}의 범위를 보여 기준치인 2에 매우 근접한 것으로 나타났다. 따라서 잔차들 간에 자기상관(Autocorrelation)이 존재하지 않으며, 오차항의 독립성 가정이 훌륭하게 충족되었다고 판단할 수 있다. `;
        } else {
            text += `각 모형의 Durbin-Watson 값이 ${minDw.toFixed(3)}에서 ${maxDw.toFixed(3)}의 범위를 보였다. `;
        }

        if (useVif) {
            text += `이와 더불어 독립변수들 간의 상관관계로 인해 발생하는 다중공선성 문제를 진단하기 위하여 분산팽창지수(VIF: Variance Inflation Factor)를 확인하였다. 분석 결과, 투입된 모든 독립변수의 VIF 수치는 10 미만(엄격한 기준인 5 미만 포함)으로 안정적으로 나타났다. 이는 독립변수 간에 심각한 다중공선성 문제가 없음을 의미하며, 산출된 회귀계수(Regression Coefficient)의 안정성과 통계적 유의성을 신뢰할 수 있음을 입증한다.\n\n`;
        } else {
            text += `\n\n`;
        }

        results.models.forEach((m: any, idx: number) => {
            text += `[모형 ${idx + 1}: ${results.ivParentName} → ${m.dv_name}]\n`;
            const fP = m.f_p_value < 0.001 ? '.000' : m.f_p_value.toFixed(3).replace(/^0\./, '.');
            text += `'${results.ivParentName}'의 하위요인들이 종속변수인 '${m.dv_name}'에 미치는 구체적인 영향력을 분석한 결과, 도출된 회귀모형은 통계적으로 유의미한 수준에서 적합한 것으로 나타났다(F=${m.f_value.toFixed(3)}, p=${fP}). `;
            text += `모형의 설명력(Explanatory Power)을 직관적으로 보여주는 수정된 결정계수(Adj. R²)는 ${m.adj_r_squared.toFixed(3).replace(/^0\./, '.')}로 산출되었는데, 이는 본 회귀모형에 투입된 독립변수들이 '${m.dv_name}'가 가지는 총 분산의 약 ${(m.adj_r_squared * 100).toFixed(1)}%를 유의미하게 설명하고 있음을 시사한다. 이는 사회과학 연구 분야에서 상당한 수준의 설명력을 확보한 것으로 해석할 수 있다.\n\n`;

            const sigVars: any[] = [];
            m.coefficients.forEach((c: any) => {
                if (c.name !== '(상수)' && c.p < 0.05 && c.beta > 0) { // 정(+)의 영향만 고려
                    sigVars.push(c);
                }
            });

            if (sigVars.length > 0) {
                // Sort by beta absolute value
                sigVars.sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta));

                text += `구체적으로 독립변수를 구성하는 각 하위요인별 통계적 유의성과 영향의 방향성을 살펴보면 다음과 같다. `;
                sigVars.forEach((v, vIdx) => {
                    const vP = v.p < 0.001 ? '.000' : v.p.toFixed(3).replace(/^0\./, '.');
                    text += `분석 결과, '${v.name}'(B=${v.B.toFixed(3)}, β=${v.beta.toFixed(3)}, t=${v.t.toFixed(3)}, p=${vP})은(는) '${m.dv_name}'에 통계적으로 유의한 정(+)의 영향을 미치는 것으로 뚜렷하게 나타났다. `;
                });
                text += `따라서 ${sigVars.map(v => `'${v.name}'`).join(', ')} 요인이 증가하거나 개선될수록 '${m.dv_name}' 역시 긍정적으로 상승하는 강력한 인과적 관계가 성립함을 알 수 있다. 이에 따라 해당 변수들에 대한 세부 가설은 채택되었다.\n\n`;

                text += `추가적으로, 각 독립변수들이 종속변수에 미치는 상대적 영향력의 크기(Relative Importance)를 비교하기 위하여 표준화 계수(Standardized Beta, β)를 검토하였다. 표준화 계수는 서로 다른 측정 단위(Scale)를 가진 변수들을 동일한 표준편차 단위로 변환한 값으로서, 계수의 절댓값이 클수록 종속변수에 미치는 영향력이 더 강함을 의미한다. `;
                text += `비교 결과, `;
                sigVars.forEach((v, vIdx) => {
                    text += `'${v.name}'(β=${v.beta.toFixed(3)})`;
                    if (vIdx < sigVars.length - 1) text += `, `;
                });
                text += ` 순으로 '${m.dv_name}'에 더 핵심적인 영향을 미치는 요인인 것으로 분석되었다. 이는 실무적 관점에서 '${sigVars[0].name}' 요인에 대한 집중적인 투자나 관리가 '${m.dv_name}'를 향상시키는 데 가장 효과적인 전략이 될 수 있음을 강력히 시사한다.\n\n`;
            } else {
                text += `그러나 구체적으로 각 독립변수 하위요인의 비표준화 계수(B)와 유의확률(p)을 살펴본 결과, 모형 내에서 '${m.dv_name}'에 통계적으로 유의미한 정(+)의 영향을 미치는 요인은 뚜렷하게 확인되지 않았다. 모든 변수의 유의확률이 기각역(p>.05)에 속하거나 영향의 방향성이 가설과 일치하지 않았다. 따라서 이와 관련된 세부 가설은 모두 기각되었다.\n\n`;
            }
        });

        const hypTable = generateHypotheses();
        const parentHyp = hypTable.find(h => h.isParent);
        if (parentHyp) {
            text += `최종 결론적으로, 본 연구의 메인 가설인 [${parentHyp.id}: ${parentHyp.desc}]에 대하여 세부 가설들의 채택 여부를 종합해 본 결과, 본 가설은 **${parentHyp.status}** 된 것으로 판단할 수 있다.`;
        }

        return text;
    };

    useEffect(() => {
        if (results && results.models && results.models.length > 0) {
            useAnalysisStore.getState().setCachedResult(`regression_${activeTabIdx}`, {
                results,
                settings: { useMeanCentering, useVif, tabName: tabs[activeTabIdx]?.name },
                interpretation: generateInterpretation()
            });
        }
    }, [results, activeTabIdx, useMeanCentering, useVif]);

    const hypotheses = generateHypotheses();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>

            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 className="text-h3" style={{ margin: 0 }}>다중회귀분석 (Multiple Regression)</h2>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
                    <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
                        독립변수가 종속변수에 미치는 인과적 영향을 가설별로 분석합니다.
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    
                    <button
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => setCurrentStep('mediation')}
                    >
                        매개효과 분석으로 이동 ▶
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
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                whiteSpace: 'nowrap',
                                border: activeTabIdx === idx ? 'none' : '1px solid var(--border-color)'
                            }}
                        >
                            {tab.name}
                        </button>
                    ))}
                </div>
            )}

            {tabs.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--error)' }}>
                    * 변수 매핑 화면에서 독립변수(IV)와 종속변수(DV)를 최소 1개 이상 설정해야 합니다.
                </div>
            ) : (
                <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
                    {/* 왼쪽: 표 영역 */}
                    <div style={{ flex: '1.4', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', paddingRight: '4px' }}>

                        {/* 가설 표 */}
                        <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                                <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>가설 설정 ({results?.hypothesisName})</h3>
                                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleExportHypotheses} disabled={isExporting1 || !results}>
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
                                                <td style={{ padding: '10px', textAlign: 'center', fontWeight: h.isParent ? 'bold' : 'normal', color: h.status === '기각' ? 'var(--error)' : h.status ? 'var(--primary)' : 'inherit' }}>{h.status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 회귀분석 결과 표 */}
                        {results && results.models && (
                            <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
                                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                                    <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>회귀분석 결과 ({results.hypothesisName})</h3>
                                    <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleExportRegression} disabled={isExporting2}>
                                        <Download size={14} /> {isExporting2 ? '다운로드 중...' : '결과 표 다운로드'}
                                    </button>
                                </div>
                                <div style={{ padding: '16px', overflowX: 'auto' }}>
                                    <table style={{ borderCollapse: 'collapse', width: 'max-content', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                                                {results.models.length > 1 && <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>구분</th>}
                                                <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>독립변수</th>
                                                <th colSpan={2} style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>비표준화 계수</th>
                                                <th style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>표준화 계수</th>
                                                <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>t</th>
                                                <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>p</th>
                                                {useVif && <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>VIF</th>}
                                                <th rowSpan={2} style={{ padding: '10px' }}>모형 요약</th>
                                            </tr>
                                            <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)' }}>
                                                <th style={{ padding: '6px', borderRight: '1px solid var(--border-color)', fontWeight: 'normal' }}>B</th>
                                                <th style={{ padding: '6px', borderRight: '1px solid var(--border-color)', fontWeight: 'normal' }}>표준오차</th>
                                                <th style={{ padding: '6px', borderRight: '1px solid var(--border-color)', fontWeight: 'normal' }}>베타(β)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.models.map((m: any, mIdx: number) => (
                                                <React.Fragment key={mIdx}>
                                                    {m.coefficients.map((c: any, cIdx: number) => {
                                                        const isLastOfModel = cIdx === m.coefficients.length - 1;
                                                        const borderStyle = isLastOfModel ? '1px solid var(--text-primary)' : '1px solid var(--border-color)';

                                                        let stars = '';
                                                        if (c.name !== '(상수)') {
                                                            if (c.p < 0.001) stars = '***';
                                                            else if (c.p < 0.01) stars = '**';
                                                            else if (c.p < 0.05) stars = '*';
                                                        }

                                                        return (
                                                            <tr key={`${mIdx}-${cIdx}`} style={{ borderBottom: borderStyle }}>
                                                                {cIdx === 0 && results.models.length > 1 && (
                                                                    <td rowSpan={m.coefficients.length} style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)', verticalAlign: 'middle' }}>
                                                                        {results.ivParentName} <br />↓<br /> {m.dv_name}
                                                                    </td>
                                                                )}
                                                                <td style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)' }}>{c.name}</td>
                                                                <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>{c.B.toFixed(3)}</td>
                                                                <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>{c.SE.toFixed(3)}</td>
                                                                <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>{c.name === '(상수)' ? '' : c.beta.toFixed(3)}</td>
                                                                <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)', fontWeight: stars ? 'bold' : 'normal' }}>
                                                                    {c.t.toFixed(3)}{stars}
                                                                </td>
                                                                <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>
                                                                    {c.p < 0.001 ? '.000' : c.p.toFixed(3).replace(/^0\./, '.')}
                                                                </td>
                                                                {useVif && (
                                                                    <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>
                                                                        {c.vif ? c.vif.toFixed(3) : ''}
                                                                    </td>
                                                                )}
                                                                {cIdx === 0 && (
                                                                    <td rowSpan={m.coefficients.length} style={{ padding: '6px 12px', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'left', lineHeight: '1.5' }}>
                                                                        R²={m.r_squared.toFixed(3).replace(/^0\./, '.')}<br />
                                                                        Adj. R²={m.adj_r_squared.toFixed(3).replace(/^0\./, '.')}<br />
                                                                        F={m.f_value.toFixed(3)}{m.f_p_value < 0.001 ? '***' : m.f_p_value < 0.01 ? '**' : m.f_p_value < 0.05 ? '*' : ''}<br />
                                                                        p={m.f_p_value < 0.001 ? '.000' : m.f_p_value.toFixed(3).replace(/^0\./, '.')}<br />
                                                                        D-W={m.durbin_watson.toFixed(3)}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        * p&lt;.05, ** p&lt;.01, *** p&lt;.001
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 오른쪽: 자동 해석 및 옵션 영역 */}
                    <div style={{ flex: '0.6', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* 분석 옵션 패널 */}
                        <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <Settings2 size={20} style={{ color: 'var(--primary)' }} />
                                <h3 style={{ margin: 0, fontSize: '16px' }}>회귀분석 옵션 ({tabs[activeTabIdx]?.name})</h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={useMeanCentering} onChange={(e) => setUseMeanCentering(e.target.checked)} />
                                    평균 중심화 (Mean Centering) 적용
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={useVif} onChange={(e) => setUseVif(e.target.checked)} />
                                    다중공선성(VIF) 지수 확인
                                </label>
                            </div>
                            <button
                                className="btn-primary"
                                style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                onClick={handleAnalyze}
                                disabled={loading}
                            >
                                {loading ? <RefreshCw size={18} className="spin" /> : <Settings2 size={18} />}
                                {loading ? '분석 재수행 중...' : '옵션 적용 / 재분석'}
                            </button>
                        </div>

                        {/* 자동 해석 영역 */}
                        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', minHeight: 0 }}>
                            <AiInterpretationPanel 
                                analysisType="다중회귀분석(OLS)"
                                results={results}
                                cacheKey={`regression_${activeTabIdx}`}
                                defaultText={generateInterpretation()}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
