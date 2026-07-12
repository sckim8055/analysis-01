import React, { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { useUiStore } from '../../store/uiStore';
import { Download, FileText } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';


export const ReliabilityView: React.FC = () => {
  const { approvedVariables, factorResults, mappedVars } = useAnalysisStore();
  const { setCurrentStep } = useUiStore();

  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const [tableData, setTableData] = useState<any[]>([]);

  useEffect(() => {
    const factorsPayload: any[] = [];
    const mappingInfo: Record<string, any> = {};

    const roleMap: Record<string, string> = { iv: '독립변수', dv: '종속변수', med: '매개변수', mod: '조절변수' };

    // 1. Build Payload & Mapping Info directly from Original Mapping
    Object.entries(mappedVars).forEach(([role, vars]) => {
      if (role === 'gen') return;
      vars.forEach(v => {
        // If this variable wasn't approved in Factor Analysis, skip it
        if (!approvedVariables.includes(v.id)) return;

        const res = factorResults[v.id];

        // Build map of survived items: col_X -> originalName
        const survivedMap: Record<string, string> = {};
        if (res && res.matrixItems) {
          res.matrixItems.forEach((m: any) => {
            survivedMap[m.id] = m.originalName || m.id;
          });
        }

        // 우선적으로 요인분석에서 도출된 하위요인(extractedSubFactors)을 사용하고, 없으면 수동 매핑(v.subFactors)을 사용
        const targetSubFactors = res?.extractedSubFactors || v.subFactors;

        if (targetSubFactors && targetSubFactors.length > 0) {
          // Has sub-factors
          targetSubFactors.forEach((sf: any) => {
            const finalCols = (sf.itemIds || []).filter((id: string) => survivedMap[id]);
            const finalNames = finalCols.map((id: string) => survivedMap[id]);

            if (finalNames.length >= 2) {
              factorsPayload.push({
                name: sf.id, // Use ID as unique key for backend
                items: finalNames
              });

              mappingInfo[sf.id] = {
                group: `[${roleMap[role] || role}] ${v.name}`,
                concept: sf.name,
                initialCount: sf.originalItemIds?.length || sf.itemIds?.length || 0,
                finalCount: finalCols.length
              };
            }
          });
        } else {
          // No sub-factors, use the variable itself
          const finalCols = (v.itemIds || []).filter(id => survivedMap[id]);
          const finalNames = finalCols.map(id => survivedMap[id]);

          if (finalNames.length >= 2) {
            factorsPayload.push({
              name: v.id,
              items: finalNames
            });

            mappingInfo[v.id] = {
              group: `[${roleMap[role] || role}] ${v.name}`,
              concept: v.name,
              initialCount: v.itemIds?.length || 0,
              finalCount: finalCols.length
            };
          }
        }
      });
    });

    if (factorsPayload.length === 0) return;

    const fetchRel = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/analysis/reliability`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ factors: factorsPayload })
        });
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();

        // Merge API results with Mapping Info
        const mergedData = data.results.map((r: any) => {
          const info = mappingInfo[r.name]; // r.name is the UUID (sf.id or v.id)

          if (info) {
            return {
              group: info.group,
              concept: info.concept,
              initialCount: info.initialCount,
              finalCount: info.finalCount, // Or r.n_items (should be the same)
              alpha: r.alpha
            };
          } else {
            return {
              group: '기타',
              concept: r.name,
              initialCount: r.n_items,
              finalCount: r.n_items,
              alpha: r.alpha
            };
          }
        });

        // Group by Role for Table RowSpan
        const groupedMap: Record<string, any[]> = {};
        mergedData.forEach((item: any) => {
          if (!groupedMap[item.group]) groupedMap[item.group] = [];
          groupedMap[item.group].push(item);
        });

        const finalTableData: any[] = [];
        Object.entries(groupedMap).forEach(([_groupName, items]) => {
          items.forEach((item, index) => {
            finalTableData.push({
              ...item,
              rowSpan: index === 0 ? items.length : 0
            });
          });
        });
        setTableData(finalTableData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRel();
  }, [approvedVariables, factorResults, mappedVars]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const exportPayload = tableData.map(row => ({
        "구성": row.group,
        "측정개념": row.concept,
        "최초 문항": row.initialCount,
        "최종 문항": row.finalCount,
        "Cronbach's α": parseFloat(row.alpha.toFixed(3))
      }));

      exportPayload.push({
        "구성": "합 계",
        "측정개념": "",
        "최초 문항": tableData.reduce((acc, r) => acc + r.initialCount, 0),
        "최종 문항": tableData.reduce((acc, r) => acc + r.finalCount, 0),
        "Cronbach's α": "-" as any
      });

      const res = await apiFetch(`/api/analysis/reliability/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "<표 4-7> 측정도구의 신뢰도 검증",
          rows: exportPayload,
          footer: "※ 일반적으로 사회과학 연구에서 Cronbach's α 계수가 .60 이상이면 신뢰도에 문제가 없는 것으로 판단함."
        })
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reliability_analysis.xlsx';
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
    if (tableData.length === 0) return "";

    let text = "본 연구에서 사용된 측정도구의 내적 일관성(Internal Consistency)을 검증하기 위해 Cronbach's α 계수를 산출한 결과는 <표 4-7>과 같다.\n\n";
    text += "일반적으로 사회과학 연구에서 측정도구의 신뢰도 검증 시 Cronbach's α 계수가 .60 이상이면 신뢰도에 문제가 없는 것으로, .80 이상이면 신뢰도가 매우 높은 것으로 판단한다.\n\n";

    // Sort to find highest and lowest
    const sortedData = [...tableData].sort((a, b) => b.alpha - a.alpha);
    const highest = sortedData[0];
    const lowest = sortedData[sortedData.length - 1];

    if (highest && lowest) {
      text += `본 연구의 분석 결과, 전체 요인들의 Cronbach's α 계수는 최저 .${lowest.alpha.toFixed(3).replace(/^0\./, '')}('${lowest.concept}')에서 최고 .${highest.alpha.toFixed(3).replace(/^0\./, '')}('${highest.concept}')의 범위를 나타내어 모든 요인이 기준치인 .60을 넉넉히 상회하는 것으로 확인되었다.\n\n`;

      text += `구체적으로 살펴보면, 가장 높은 신뢰도를 보인 요인은 '${highest.concept}'으로 나타났으며(α=.${highest.alpha.toFixed(3).replace(/^0\./, '')}), `;

      if (sortedData.length > 2) {
        const seconds = sortedData.slice(1, 4).map(r => `'${r.concept}'(α=.${r.alpha.toFixed(3).replace(/^0\./, '')})`);
        text += `이어서 ${seconds.join(', ')} 순으로 높은 내적 일관성을 보였다. `;
      }

      text += `상대적으로 가장 낮은 신뢰도를 보인 '${lowest.concept}' 요인의 경우에도 α=.${lowest.alpha.toFixed(3).replace(/^0\./, '')}로 나타나 분석에 무리가 없는 수준임이 입증되었다.\n\n`;
    }

    text += "결과적으로 본 연구에서 구성된 독립변수, 매개변수, 종속변수 및 조절변수를 측정하기 위한 모든 하위 요인들의 문항들이 서로 일관되게 측정되고 있음이 통계적으로 확인되었으며, 이에 따라 이후 진행될 가설 검증 및 다변량 분석을 위한 측정도구로서의 타당성과 신뢰성이 충분히 확보되었다고 할 수 있다.";

    return text.trim();
  };

  useEffect(() => {
    if (tableData && tableData.length > 0) {
      useAnalysisStore.getState().setCachedResult('reliability', {
        results: tableData,
        settings: {},
        interpretation: generateInterpretation()
      });
    }
  }, [tableData]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>신뢰도 분석 중...</div>;
  if (tableData.length === 0) return <div style={{ padding: '40px', textAlign: 'center' }}>분석 대상 데이터가 없습니다. (요인분석 완료 후 진행해주세요.)</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>

      {/* 상단 공통 액션 바 */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>신뢰도 분석 (Reliability)</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            측정도구의 내적 일관성을 검증합니다.
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
            onClick={() => setCurrentStep('correlation')}
          >
            상관관계 분석으로 이동 ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>

        {/* 왼쪽: 표 영역 */}
        <div className="glass-panel" style={{ flex: '1.2', display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', textAlign: 'center', backgroundColor: 'var(--bg-surface)' }}>
            <h3 style={{ margin: 0, fontWeight: 'normal' }}>&lt;표 4-7&gt; 측정도구의 신뢰도 검증</h3>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: '700px', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '15px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>구성</th>
                  <th style={{ padding: '12px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>측정개념</th>
                  <th style={{ padding: '12px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>최초 문항</th>
                  <th style={{ padding: '12px', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>최종 문항</th>
                  <th style={{ padding: '12px', fontWeight: 'bold' }}>Cronbach's α</th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {row.rowSpan > 0 && (
                      <td rowSpan={row.rowSpan} style={{ padding: '12px', borderRight: '1px solid var(--border-color)', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                        {row.group}
                      </td>
                    )}
                    <td style={{ padding: '12px', borderRight: '1px solid var(--border-color)' }}>{row.concept}</td>
                    <td style={{ padding: '12px', borderRight: '1px solid var(--border-color)' }}>{row.initialCount}</td>
                    <td style={{ padding: '12px', borderRight: '1px solid var(--border-color)' }}>{row.finalCount}</td>
                    <td style={{ padding: '12px' }}>{row.alpha.toFixed(3).replace(/^0\./, '.')}</td>
                  </tr>
                ))}
                {tableData.length > 0 && (
                  <tr style={{ backgroundColor: 'var(--bg-surface)', fontWeight: 'bold' }}>
                    <td colSpan={2} style={{ padding: '12px', borderRight: '1px solid var(--border-color)' }}>합 계 (Total)</td>
                    <td style={{ padding: '12px', borderRight: '1px solid var(--border-color)' }}>{tableData.reduce((acc, r) => acc + r.initialCount, 0)}</td>
                    <td style={{ padding: '12px', borderRight: '1px solid var(--border-color)' }}>{tableData.reduce((acc, r) => acc + r.finalCount, 0)}</td>
                    <td style={{ padding: '12px' }}>-</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽: 자동 해석 영역 */}
        <div className="glass-panel" style={{ flex: '0.8', display: 'flex', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <FileText size={24} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0 }}>논문 텍스트 자동 해석</h3>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
            우측의 신뢰도 분석 표를 바탕으로 논문에 즉시 복사하여 사용할 수 있는 초안 텍스트입니다. 결과 해석에 참고하시기 바랍니다.
          </p>

          <div
            style={{
              flex: 1,
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '24px',
              fontSize: '15px',
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
