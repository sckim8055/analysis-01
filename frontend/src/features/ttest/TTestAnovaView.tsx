import React, { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { Download, FileText, Settings2, RefreshCw } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';
import { AiInterpretationPanel } from '../../components/AiInterpretationPanel';


export const TTestAnovaView: React.FC = () => {
    const { approvedVariables, factorResults, mappedVars } = useAnalysisStore();
    const { demographicColumns } = useProjectStore();
    const { setCurrentStep } = useUiStore();

    const [results, setResults] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isExporting1, setIsExporting1] = useState(false);
    const [isExporting2, setIsExporting2] = useState(false);

    const [useScheffe, setUseScheffe] = useState(false);
    const [useBootstrap, setUseBootstrap] = useState(false);
    const [bootstrapN, setBootstrapN] = useState(5000);

    const finalDemos = React.useMemo(() => {
        const genItems = (mappedVars.gen || []).flatMap(v => v.itemIds || []);
        return genItems.length > 0 ? genItems : demographicColumns;
    }, [mappedVars.gen, demographicColumns]);

    const factorsPayloadMemo = React.useMemo(() => {
        const payload: any[] = [];
        Object.entries(mappedVars).forEach(([role, vars]) => {
            if (role === 'gen') return;
            vars.forEach(v => {
                // If factor analysis was run, we only include approved variables.
                // But if they skipped factor analysis entirely (approvedVariables is empty), we should still let them run it with original vars.
                // To be safe, if factorResults[v.id] exists, it must be approved. If it doesn't, we just allow it.
                const res = factorResults[v.id];
                if (res && !approvedVariables.includes(v.id)) return;


                const survivedMap: Record<string, string> = {};
                if (res && res.matrixItems) {
                    res.matrixItems.forEach((m: any) => {
                        survivedMap[m.id] = m.originalName || m.id;
                    });
                }

                const targetSubFactors = res?.extractedSubFactors || v.subFactors;

                if (targetSubFactors && targetSubFactors.length > 0) {
                    targetSubFactors.forEach((sf: any) => {
                        const finalCols = (sf.itemIds || []).filter((id: string) => survivedMap[id]);
                        const finalNames = finalCols.map((id: string) => survivedMap[id]);
                        if (finalNames.length > 0) {
                            payload.push({ name: sf.name, parent: v.name, items: finalNames });
                        }
                    });
                } else {
                    const finalCols = (v.itemIds || []).filter(id => survivedMap[id]);
                    const finalNames = finalCols.map(id => survivedMap[id]);
                    if (finalNames.length > 0) {
                        payload.push({ name: v.name, parent: v.name, items: finalNames });
                    }
                }
            });
        });
        return payload;
    }, [approvedVariables, factorResults, mappedVars]);

    // Initial fetch on mount
    useEffect(() => {
        const cached = useAnalysisStore.getState().cachedResults['ttest'];
        if (cached && cached.results) {
            setResults(cached.results);
            setUseScheffe(cached.settings?.useScheffe || false);
            setUseBootstrap(cached.settings?.useBootstrap || false);
            setBootstrapN(cached.settings?.bootstrapN || 5000);
        } else if (factorsPayloadMemo.length > 0 && finalDemos && finalDemos.length > 0) {
            handleAnalyze();
        }
    }, []); // Only run once on mount

    const handleAnalyze = async () => {
        if (factorsPayloadMemo.length === 0 || !finalDemos || finalDemos.length === 0) return;

        setLoading(true);
        try {
            const res = await apiFetch(`/api/analysis/difference`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    demographics: finalDemos,
                    factors: factorsPayloadMemo,
                    use_scheffe: useScheffe,
                    bootstrap_n: useBootstrap ? bootstrapN : 0
                })
            });
            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            setResults({ ...data, factorsPayload: factorsPayloadMemo });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };


    const handleExportDesc = async () => {
        if (!results) return;
        setIsExporting1(true);

        try {
            const exportRows = results.desc_stats.map((s: any) => ({
                "상위변수": s.parent,
                "변수(하위요인)": s.name,
                "평균(M)": s.mean.toFixed(3),
                "표준편차(SD)": s.sd.toFixed(3)
            }));

            const res = await apiFetch(`/api/analysis/difference/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: "<표 4-10> 주요 변수의 평균과 표준편차",
                    rows: exportRows
                })
            });
            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'descriptive_stats.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } finally {
            setIsExporting1(false);
        }
    };

    const handleExportDiff = async () => {
        if (!results) return;
        setIsExporting2(true);

        try {
            const exportRows: any[] = [];
            const factors = results.factorsPayload.map((f: any) => f.name);

            // Header Rows manually via dict keys
            results.diff_results.forEach((dr: any) => {
                const demo = dr.demographic;
                const factorKeys = Object.keys(dr.factors);
                if (factorKeys.length === 0) return;

                const firstFactor = dr.factors[factorKeys[0]];
                firstFactor.groups.forEach((g: any) => {
                    const row: any = { "구분": demo, "집단": g.group_name };
                    factors.forEach((fname: string) => {
                        if (dr.factors[fname]) {
                            const gStat = dr.factors[fname].groups.find((x: any) => x.group_name === g.group_name);
                            row[`${fname}_평균`] = gStat ? gStat.mean.toFixed(3) : '';
                            row[`${fname}_표준편차`] = gStat ? gStat.sd.toFixed(3) : '';
                        } else {
                            row[`${fname}_평균`] = '';
                            row[`${fname}_표준편차`] = '';
                        }
                    });
                    exportRows.push(row);
                });

                // T/F value row
                const tfRow: any = { "구분": demo, "집단": firstFactor.test_type === 't' ? 't-value(p)' : 'F-value(p)' };
                factors.forEach((fname: string) => {
                    if (dr.factors[fname]) {
                        const stat = dr.factors[fname].statistic.toFixed(3);
                        const p = dr.factors[fname].p_value;
                        let stars = '';
                        if (p < 0.001) stars = '***';
                        else if (p < 0.01) stars = '**';
                        else if (p < 0.05) stars = '*';
                        const welchMark = dr.factors[fname].variance_equal === false ? '†' : '';
                        const content = `${stat}${stars}${welchMark}(${p < 0.001 ? '.000' : p.toFixed(3).replace(/^0\./, '.')})`;
                        tfRow[`${fname}_평균`] = content;
                        tfRow[`${fname}_표준편차`] = dr.factors[fname].posthoc ? `사후검정: ${dr.factors[fname].posthoc}` : '';
                    } else {
                        tfRow[`${fname}_평균`] = '';
                        tfRow[`${fname}_표준편차`] = '';
                    }
                });
                exportRows.push(tfRow);
            });

            const res = await apiFetch(`/api/analysis/difference/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: "<표 4-11> 설문자에 따른 주요 변수 차이분석",
                    rows: exportRows,
                    footer: "* p<.05, ** p<.01, *** p<.001"
                })
            });
            if (!res.ok) throw new Error('Export failed');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'difference_analysis.xlsx';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } finally {
            setIsExporting2(false);
        }
    };

    const generateInterpretation = () => {
        if (!results) return "";

        let text = "본 연구에서 구성된 주요 측정변수들의 전반적인 수준을 파악하고, 조사대상자의 인구통계학적 특성에 따라 각 변수들에 통계적으로 유의미한 차이가 존재하는지를 실증적으로 검증하기 위하여 기술통계(Descriptive Statistics) 분석과 차이분석(t-test 및 One-way ANOVA)을 실시하였다. 분석 결과는 <표 4-10> 및 <표 4-11>과 같다.\n\n";

        text += "1. 주요 변수의 기술통계 분석 결과\n";
        text += "본 연구의 가설 검증에 앞서 주요 변수들이 조사대상자들에게 어느 정도의 수준으로 인식되고 있는지를 확인하기 위해 기술통계 분석을 수행하였다. 각 변수별 측정항목들의 평균과 표준편차를 산출한 결과, 전반적인 인식 수준은 다음과 같이 나타났다.\n";

        results.desc_stats.forEach((s: any) => {
            text += `우선, '${s.parent}'의 하위요인인 '${s.name}'의 경우 전체 평균이 ${s.mean.toFixed(3)}(SD=${s.sd.toFixed(3)}) 수준으로 나타났다. `;
        });

        text += "\n이러한 결과는 본 연구의 응답자들이 제시된 주요 변수들에 대해 대체로 보통 수준 이상의 긍정적인 인식을 형성하고 있음을 시사하며, 이는 향후 진행될 가설 검증 결과의 타당성을 뒷받침하는 기초 자료로서 의미를 지닌다.\n\n";

        text += "2. 인구통계학적 특성에 따른 주요 변수 차이분석 결과\n";
        text += "조사대상자의 성별, 연령, 학력 등 일반적 특성(인구통계학적 요인)에 따라 핵심 연구 변수들에 대한 인식에 집단 간 차이가 있는지를 파악하기 위하여 평균 차이 검증을 실시하였다. 집단이 2개인 범주(예: 성별)에 대해서는 독립표본 t검정(Independent samples t-test)을, 집단이 3개 이상인 범주(예: 연령, 학력, 직급 등)에 대해서는 일원배치 분산분석(One-way ANOVA)을 적용하였으며, 그 결과는 다음과 같다.\n\n";

        let sigFound = false;
        let detailTexts = "";

        results.diff_results.forEach((dr: any) => {
            const demo = dr.demographic;
            let demoSigText = "";
            let demoDetail = "";

            Object.keys(dr.factors).forEach(fname => {
                const fres = dr.factors[fname];
                if (fres.p_value < 0.05) {
                    sigFound = true;
                    const testName = fres.test_type === 't' ? 't' : 'F';

                    let pStr = fres.p_value < 0.001 ? '.000' : fres.p_value.toFixed(3).replace(/^0\./, '.');
                    demoSigText += `'${fname}'(${testName}=${fres.statistic.toFixed(3)}, p=${pStr}), `;

                    // Find highest and lowest groups
                    let sortedGroups = [...fres.groups].sort((a, b) => b.mean - a.mean);
                    if (sortedGroups.length >= 2) {
                        demoDetail += `특히 '${fname}' 요인에 있어서는 '${sortedGroups[0].group_name}' 집단의 평균이 ${sortedGroups[0].mean.toFixed(3)}로 가장 높게 나타난 반면, '${sortedGroups[sortedGroups.length - 1].group_name}' 집단은 ${sortedGroups[sortedGroups.length - 1].mean.toFixed(3)}로 가장 낮게 나타났다. `;
                    }
                }
            });

            if (demoSigText) {
                demoSigText = demoSigText.slice(0, -2);
                detailTexts += `[${demo}에 따른 차이]\n`;
                detailTexts += `분석 결과, 응답자의 '${demo}'에 따라 ${demoSigText}에서 통계적으로 유의미한 평균 차이가 확인되었다. ${demoDetail}`;

                const hasAnova = Object.values(dr.factors).some((f: any) => f.p_value < 0.05 && f.test_type === 'F');
                if (hasAnova) {
                    if (useScheffe) {
                        detailTexts += `이에 따라 Scheffe 사후검정을 실시한 결과 표에 명시된 바와 같은 세부적인 집단 간 평균 차이가 확인되었다. `;
                    } else {
                        detailTexts += `이러한 세 집단 이상의 평균 차이가 어느 집단 간에 구체적으로 발생하는지 확인하기 위해서는 후속적으로 사후검정(Post-hoc test, Scheffe 또는 Duncan 등) 결과표를 추가로 확인하여 면밀히 해석할 필요가 있다. `;
                    }
                }
                detailTexts += "\n\n";
            }
        });

        if (useBootstrap) {
            text += `\n* 본 분석은 결과의 통계적 강건성을 확보하기 위해 Bootstrap(N=${bootstrapN}) 리샘플링 기법을 적용하여 경험적 p-value를 도출하였다.\n\n`;
        }

        if (sigFound) {
            text += detailTexts;
            text += "요약하자면, 본 연구의 표본은 특정 인구통계학적 특성 집단에 따라 주요 변수들에 대해 상이한 인식 패턴을 보이고 있음을 알 수 있다. 이러한 결과는 향후 연구 모형을 해석함에 있어 인구통계적 변인이 미치는 통제적 혹은 조절적 영향을 고려해야 함을 시사한다.\n";
        } else {
            text += "분석 결과, 조사대상자의 인구통계학적 특성(성별, 연령, 직급 등)에 따라 주요 연구 변수들에 통계적으로 유의미한 차이는 발견되지 않았다(모든 항목에서 p>.05). 이는 본 연구의 표본 집단이 인구통계적 배경과 무관하게 본 연구에서 설정한 주요 변수들에 대해 매우 동질적이고 일관된 인식을 가지고 있음을 의미한다. 따라서 향후 구조방정식 또는 다중회귀분석 과정에서 특정 인구통계적 변인으로 인한 편향(Bias) 우려 없이 통합적인 데이터 분석이 가능할 것으로 판단된다.\n";
        }

        return text;
    };

    useEffect(() => {
        if (results) {
            useAnalysisStore.getState().setCachedResult('ttest', {
                results,
                settings: { useScheffe, useBootstrap, bootstrapN },
                interpretation: generateInterpretation()
            });
        }
    }, [results, useScheffe, useBootstrap, bootstrapN]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>차이분석(T검정/ANOVA) 중...</div>;
    if (!results || !results.factorsPayload) return <div style={{ padding: '40px', textAlign: 'center' }}>분석 대상 데이터가 충분하지 않습니다.</div>;

    const factors = results.factorsPayload.map((f: any) => f.name);

    const parentCounts: Record<string, number> = {};
    results.desc_stats.forEach((s: any) => {
        parentCounts[s.parent] = (parentCounts[s.parent] || 0) + 1;
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>

            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <h2 className="text-h3" style={{ margin: 0 }}>T검정 및 ANOVA 분석</h2>
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
                    <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
                        집단 간 평균 차이(t-value, F-value)를 분석합니다.
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>

                    <button
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        onClick={() => setCurrentStep('regression')}
                    >
                        회귀분석으로 이동 ▶
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>

                {/* 왼쪽: 표 영역 */}
                <div style={{ flex: '1.4', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>

                    {/* 표 1 */}
                    <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                            <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>&lt;표 4-10&gt; 주요 변수의 평균과 표준편차</h3>
                            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleExportDesc} disabled={isExporting1}>
                                <Download size={14} /> {isExporting1 ? '다운로드 중...' : '표 1 다운로드'}
                            </button>
                        </div>
                        <div style={{ padding: '16px', overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', width: '100%', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)' }}>
                                        <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>변수</th>
                                        <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>하위요인</th>
                                        <th style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>평균 (M)</th>
                                        <th style={{ padding: '10px' }}>표준편차 (SD)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.desc_stats.map((s: any, idx: number) => {
                                        const isFirstOfParent = idx === 0 || results.desc_stats[idx - 1].parent !== s.parent;
                                        return (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                {isFirstOfParent && (
                                                    <td rowSpan={parentCounts[s.parent]} style={{ padding: '10px', borderRight: '1px solid var(--border-color)', verticalAlign: 'middle', fontWeight: 'bold' }}>
                                                        {s.parent}
                                                    </td>
                                                )}
                                                <td style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>{s.name}</td>
                                                <td style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>{s.mean.toFixed(3)}</td>
                                                <td style={{ padding: '10px' }}>{s.sd.toFixed(3)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 표 2 */}
                    <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-surface)' }}>
                            <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>&lt;표 4-11&gt; 설문자에 따른 변수 차이분석</h3>
                            <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleExportDiff} disabled={isExporting2}>
                                <Download size={14} /> {isExporting2 ? '다운로드 중...' : '표 2 다운로드'}
                            </button>
                        </div>
                        <div style={{ padding: '16px', overflowX: 'auto' }}>
                            <table style={{ borderCollapse: 'collapse', width: 'max-content', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                                        <th rowSpan={2} colSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>구분</th>
                                        {factors.map((f: string) => (
                                            <th key={f} colSpan={useScheffe ? 3 : 2} style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>{f}</th>
                                        ))}
                                    </tr>
                                    <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)' }}>
                                        {factors.map((f: string) => (
                                            <React.Fragment key={`${f}-sub`}>
                                                <th style={{ padding: '6px', borderRight: '1px solid var(--border-color)', fontWeight: 'normal' }}>평균(M)</th>
                                                <th style={{ padding: '6px', borderRight: '1px solid var(--border-color)', fontWeight: 'normal' }}>표준편차(SD)</th>
                                                {useScheffe && <th style={{ padding: '6px', borderRight: '1px solid var(--border-color)', fontWeight: 'normal', color: 'var(--primary)' }}>사후검정</th>}
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.diff_results.map((dr: any, dIdx: number) => {
                                        const demo = dr.demographic;
                                        const factorKeys = Object.keys(dr.factors);
                                        if (factorKeys.length === 0) return null;
                                        const firstFactor = dr.factors[factorKeys[0]];
                                        const rowsCount = firstFactor.groups.length + 1; // groups + tf-value row

                                        return (
                                            <React.Fragment key={dIdx}>
                                                {firstFactor.groups.map((g: any, gIdx: number) => (
                                                    <tr key={`${dIdx}-${gIdx}`}>
                                                        {gIdx === 0 && (
                                                            <td rowSpan={rowsCount} style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--text-primary)', verticalAlign: 'middle', fontWeight: 'bold' }}>
                                                                {demo}
                                                            </td>
                                                        )}
                                                        <td style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)' }}>{g.group_name}</td>

                                                        {factors.map((f: string) => {
                                                            const stat = dr.factors[f]?.groups.find((x: any) => x.group_name === g.group_name);
                                                            return (
                                                                <React.Fragment key={`${dIdx}-${gIdx}-${f}`}>
                                                                    <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>{stat ? stat.mean.toFixed(3) : '-'}</td>
                                                                    <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>{stat ? stat.sd.toFixed(3) : '-'}</td>
                                                                    {useScheffe && <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}></td>}
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                                {/* T/F value row */}
                                                <tr style={{ borderBottom: '1px solid var(--text-primary)' }}>
                                                    <td style={{ padding: '6px 12px', borderRight: '1px solid var(--border-color)' }}>
                                                        {firstFactor.test_type === 't' ? 't-value(p)' : 'F-value(p)'}
                                                    </td>
                                                    {factors.map((f: string) => {
                                                        const fres = dr.factors[f];
                                                        if (!fres) {
                                                            return (
                                                                <React.Fragment key={`tf-${f}`}>
                                                                    <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>-</td>
                                                                    <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>-</td>
                                                                    {useScheffe && <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>-</td>}
                                                                </React.Fragment>
                                                            );
                                                        }
                                                        const p = fres.p_value;
                                                        const isSig = p < 0.05;
                                                        let stars = '';
                                                        if (p < 0.001) stars = '***';
                                                        else if (p < 0.01) stars = '**';
                                                        else if (p < 0.05) stars = '*';

                                                        const pStr = p < 0.001 ? '.000' : p.toFixed(3).replace(/^0\./, '.');
                                                        // Levene 등분산 위배 시 Welch 검정이 적용됨을 † 로 표시
                                                        const welchMark = fres.variance_equal === false ? '†' : '';
                                                        const content = `${fres.statistic.toFixed(3)}${stars}${welchMark}(${pStr})`;
                                                        const posthocText = fres.posthoc || '-';

                                                        return (
                                                            <React.Fragment key={`tf-${f}`}>
                                                                <td colSpan={2} style={{ padding: '6px', borderRight: '1px solid var(--border-color)', fontWeight: isSig ? 'bold' : 'normal', backgroundColor: isSig ? 'rgba(59, 130, 246, 0.15)' : 'transparent' }}>
                                                                    {content}
                                                                </td>
                                                                {useScheffe && (
                                                                    <td style={{ padding: '6px', borderRight: '1px solid var(--border-color)', color: 'var(--primary)', fontWeight: 'bold' }}>
                                                                        {posthocText}
                                                                    </td>
                                                                )}
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                * p&lt;.05, ** p&lt;.01, *** p&lt;.001
                                <br />
                                † Levene 등분산 검정 위배(p&lt;.05) → Welch 검정(t) / Welch ANOVA(F) 적용. 표시가 없으면 등분산 가정(Student-t / 일반 ANOVA).
                                <br />
                                푸른색 음영 및 진한 글씨는 통계적으로 유의미한 평균 차이를 나타냅니다.
                            </div>
                        </div>
                    </div>
                </div>

                {/* 오른쪽: 자동 해석 및 옵션 영역 */}
                <div style={{ flex: '0.6', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* 분석 옵션 패널 */}
                    <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                            <Settings2 size={20} style={{ color: 'var(--primary)' }} />
                            <h3 style={{ margin: 0, fontSize: '16px' }}>분석 옵션</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={useScheffe} onChange={(e) => setUseScheffe(e.target.checked)} />
                                Scheffe 사후검정 적용 (ANOVA)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                                <input type="checkbox" checked={useBootstrap} onChange={(e) => setUseBootstrap(e.target.checked)} />
                                Bootstrap 리샘플링 적용
                            </label>
                            {useBootstrap && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', marginLeft: '24px' }}>
                                    <span>반복횟수(N):</span>
                                    <input type="number" value={bootstrapN} onChange={(e) => setBootstrapN(Number(e.target.value))} style={{ width: '80px', padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: '4px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                                </div>
                            )}
                        </div>
                        <button
                            className="btn-primary"
                            style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            onClick={handleAnalyze}
                            disabled={loading}
                        >
                            {loading ? <RefreshCw size={18} className="spin" /> : <Settings2 size={18} />}
                            {loading ? '분석 중...' : '차이분석 실행'}
                        </button>
                    </div>

                    {/* 자동 해석 영역 */}
                    <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', minHeight: 0 }}>
                        <AiInterpretationPanel 
                            analysisType="독립표본 t-검정 및 일원배치 분산분석(ANOVA)"
                            results={results}
                            cacheKey="ttest"
                            defaultText={generateInterpretation()}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
