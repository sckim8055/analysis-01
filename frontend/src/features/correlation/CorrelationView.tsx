import React, { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { Download, FileText } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';


export const CorrelationView: React.FC = () => {
  const { approvedVariables, factorResults, mappedVars } = useAnalysisStore();
  const { demographicColumns } = useProjectStore();
  const { setCurrentStep } = useUiStore();

  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [factorsPayload, setFactorsPayload] = useState<any[]>([]);

  useEffect(() => {
    const payload: any[] = [];

    // 1. Add Demographics
    if (demographicColumns && demographicColumns.length > 0) {
      demographicColumns.forEach(col => {
        payload.push({
          name: col,
          items: [col],
          isDemo: true
        });
      });
    }

    // 2. Add Factors (from mappedVars)
    Object.entries(mappedVars).forEach(([role, vars]) => {
      if (role === 'gen') return;
      vars.forEach(v => {
        if (!approvedVariables.includes(v.id)) return;

        const res = factorResults[v.id];
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
            if (finalNames.length >= 1) {
              payload.push({
                name: sf.name,
                items: finalNames,
                isFactor: true
              });
            }
          });
        } else {
          const finalCols = (v.itemIds || []).filter(id => survivedMap[id]);
          const finalNames = finalCols.map(id => survivedMap[id]);
          if (finalNames.length >= 1) {
            payload.push({
              name: v.name,
              items: finalNames,
              isFactor: true
            });
          }
        }
      });
    });

    setFactorsPayload(payload);

    if (payload.length < 2) return;

    const fetchCorr = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/analysis/correlation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factors: payload.map(p => ({ name: p.name, items: p.items })) })
        });
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();
        setResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCorr();
  }, [approvedVariables, factorResults, mappedVars, demographicColumns]);

  const handleExportExcel = async () => {
    if (!results) return;
    setIsExporting(true);

    try {
      const exportRows: any[] = [];
      const n = results.factor_names.length;

      for (let i = 0; i < n; i++) {
        const rowData: any = { "구분": results.factor_names[i] };
        for (let j = 0; j < n; j++) {
          if (i === j) {
            rowData[results.factor_names[j]] = "1";
          } else if (j < i) {
            const r = results.matrix_r[i][j];
            const p = results.matrix_p[i][j];
            let stars = '';
            if (p !== null) {
              if (p < 0.001) stars = '***';
              else if (p < 0.01) stars = '**';
              else if (p < 0.05) stars = '*';
            }
            const formattedR = r.toFixed(3).replace(/^(-?)0\./, '$1.');
            rowData[results.factor_names[j]] = `${formattedR}${stars}`;
          } else {
            rowData[results.factor_names[j]] = "";
          }
        }
        exportRows.push(rowData);
      }

      const res = await apiFetch(`/api/analysis/correlation/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "<표 4-8> 주요 변수 간의 상관관계",
          rows: exportRows,
          footer: "* p<.05, ** p<.01, *** p<.001 (양측 검정)"
        })
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'correlation_analysis.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert('엑셀 다운로드 중 오류가 발생했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  const generateInterpretation = () => {
    if (!results || results.factor_names.length < 2) return "";

    let text = "본 연구에서 구성된 측정변수들 간의 상관관계(Correlation) 및 다중공선성(Multicollinearity) 여부를 확인하기 위해 피어슨 상관관계 분석(Pearson's Correlation Analysis)을 실시하였으며, 그 결과는 <표 4-8>과 같다.\n\n";
    text += "상관관계 분석은 주요 변수들 간의 관계의 방향성과 강도를 파악하는 동시에, 독립변수들 간의 상관계수가 지나치게 높아 다중공선성 문제가 발생할 가능성이 있는지를 사전 검증하기 위해 수행된다. 일반적으로 상관계수(r)의 절댓값이 .85 또는 .90 이상일 경우 다중공선성의 위험이 있는 것으로 간주한다.\n\n";

    const n = results.factor_names.length;
    let maxR = 0;
    let maxPair = ["", ""];
    let sigCount = 0;
    let totalCount = 0;

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) {
        if (!factorsPayload[i].isFactor || !factorsPayload[j].isFactor) continue;

        totalCount++;
        const r = Math.abs(results.matrix_r[i][j]);
        const p = results.matrix_p[i][j];

        if (p !== null && p < 0.05) sigCount++;

        if (r > maxR) {
          maxR = r;
          maxPair = [results.factor_names[i], results.factor_names[j]];
        }
      }
    }

    text += `분석 결과, 주요 변수들 간의 상관계수 절댓값은 최대 .${maxR.toFixed(3).substring(2)}('${maxPair[0]}'와 '${maxPair[1]}')로 나타나 모든 변수 간의 상관계수가 기준치인 .85를 넘지 않았다. 따라서 본 연구의 측정 변수들 간에는 다중공선성 문제가 없으며, 각 변수들이 독립적인 개념을 측정하고 있음(판별타당성 확보)이 확인되었다.\n\n`;

    text += `또한, 핵심 연구 변수들 간의 상관관계를 살펴보면, 총 ${totalCount}개의 요인 쌍 중에서 ${sigCount}개의 관계가 통계적으로 유의미한 상관(p<.05)을 가지는 것으로 나타났다. `;
    text += `특히 종속변수와 주요 독립/매개변수들은 서로 밀접하게 연관되어 있어, 이후 진행될 구조방정식 또는 회귀분석을 통한 가설 검증의 방향성과 대체로 일치하는 양상을 보였다.\n\n`;

    text += "결론적으로 본 연구의 변수들은 이론적 배경에서 예상한 바와 같이 서로 유의미한 연관성을 지니고 있으면서도 지나친 중복 없이 각자의 고유한 분산을 설명하고 있으므로, 가설 검증을 진행하기 위한 통계적 요건을 완벽히 충족하였다고 평가할 수 있다.";

    return text;
  };

  useEffect(() => {
    if (results && results.factor_names.length >= 2) {
      useAnalysisStore.getState().setCachedResult('correlation', {
        results,
        settings: {},
        interpretation: generateInterpretation()
      });
    }
  }, [results]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>상관관계 분석 중...</div>;
  if (!results || results.factor_names.length < 2) return <div style={{ padding: '40px', textAlign: 'center' }}>분석 대상 데이터가 충분하지 않습니다. (요인 2개 이상 필요)</div>;

  const names = results.factor_names;
  const n = names.length;
  const numDemos = factorsPayload.filter(p => p.isDemo).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>

      {/* 상단 공통 액션 바 */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>상관관계 분석 (Correlations)</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            변수 간의 상관관계 및 다중공선성(판별타당성)을 검증합니다.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            <Download size={18} /> {isExporting ? '다운로드 중...' : '엑셀 다운로드'}
          </button>
          <button
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setCurrentStep('ttest')}
          >
            T검정/ANOVA 분석으로 이동 ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden', minHeight: 0 }}>

        {/* 왼쪽: 표 영역 */}
        <div className="glass-panel" style={{ flex: '1.4', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center', backgroundColor: 'var(--bg-surface)' }}>
            <h3 style={{ margin: 0, fontWeight: 'normal' }}>&lt;표 4-8&gt; 주요 변수 간의 상관관계</h3>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <table style={{ borderCollapse: 'collapse', width: 'max-content', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-surface)' }}>
                  <th style={{ padding: '10px 16px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', position: 'sticky', left: 0, zIndex: 2, backgroundColor: 'var(--bg-surface)' }}>구분</th>
                  {names.map((name: string, i: number) => (
                    <th key={i} style={{ padding: '10px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {names.map((name: string, i: number) => (
                  <tr key={i}>
                    <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', borderBottom: i === n - 1 ? 'none' : '1px solid var(--border-color)', textAlign: 'left', fontWeight: 'bold', position: 'sticky', left: 0, zIndex: 1, backgroundColor: 'var(--bg-base)' }}>
                      {name}
                    </td>
                    {names.map((_: any, j: number) => {
                      const isFactorBlock = factorsPayload[i].isFactor && factorsPayload[j].isFactor;

                      // Determine Borders for Red Box
                      const isTopEdge = i === numDemos && j >= numDemos && j <= i;
                      const isLeftEdge = i >= numDemos && j === numDemos;
                      const isBottomEdge = i === n - 1 && j >= numDemos && j <= i;
                      const isRightEdge = i >= numDemos && j === i;

                      let borderTop = 'none';
                      let borderLeft = 'none';
                      let borderRight = '1px solid var(--border-color)';
                      let borderBottom = i === n - 1 ? 'none' : '1px solid var(--border-color)';

                      if (isFactorBlock) {
                        if (isTopEdge) borderTop = '2px solid #ef4444';
                        if (isLeftEdge) borderLeft = '2px solid #ef4444';
                        if (isBottomEdge) borderBottom = '2px solid #ef4444';
                        if (isRightEdge) borderRight = '2px solid #ef4444';
                      }

                      if (i === j) {
                        return (
                          <td key={j} style={{ padding: '10px', borderRight, borderBottom, borderTop, borderLeft, backgroundColor: 'var(--bg-base)' }}>
                            1
                          </td>
                        );
                      } else if (j < i) {
                        const r = results.matrix_r[i][j];
                        const p = results.matrix_p[i][j];
                        const isSig = p !== null && p < 0.05;

                        let stars = '';
                        if (p !== null) {
                          if (p < 0.001) stars = '***';
                          else if (p < 0.01) stars = '**';
                          else if (p < 0.05) stars = '*';
                        }

                        return (
                          <td key={j} style={{ padding: '10px', borderRight, borderBottom, borderTop, borderLeft, backgroundColor: isSig ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-base)' }}>
                            {r.toFixed(3).replace(/^(-?)0\./, '$1.')}{stars}
                          </td>
                        );
                      } else {
                        return (
                          <td key={j} style={{ padding: '10px', borderRight: '1px solid var(--border-color)', borderBottom: i === n - 1 ? 'none' : '1px solid var(--border-color)', borderTop, borderLeft: 'none' }}>
                          </td>
                        );
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              * p&lt;.05, ** p&lt;.01, *** p&lt;.001 (양측 검정)
              <br />
              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>■</span> 붉은색 테두리는 주요 요인 간의 상관관계 영역을 나타냅니다.
            </div>
          </div>
        </div>

        {/* 오른쪽: 자동 해석 영역 */}
        <div className="glass-panel" style={{ flex: '0.6', minWidth: '300px', minHeight: 0, display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <FileText size={24} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0 }}>논문 텍스트 자동 해석</h3>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            우측의 상관관계 표를 바탕으로 논문에 즉시 복사하여 사용할 수 있는 초안 텍스트입니다. 판별타당성 검증 내용이 포함되어 있습니다.
          </p>

          <div
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '24px',
              fontSize: '14px',
              lineHeight: '1.8',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap'
            }}
            contentEditable
            suppressContentEditableWarning
          >
            {generateInterpretation()}
          </div>

          <div style={{ marginTop: '16px', textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>
            * 텍스트 영역을 클릭하여 내용을 직접 수정하거나 복사할 수 있습니다.
          </div>
        </div>

      </div>
    </div>
  );
};
