import React, { useMemo } from 'react';
import { Layers } from 'lucide-react';
import type { MockMatrixItem } from '../utils/factorMockLogic';
import { formatStatNumber } from '../../../utils/formatters';
import { useAnalysisStore } from '../../../store/analysisStore';

interface FactorMatrixTableProps {
  factorNames: string[];
  matrixItems: MockMatrixItem[];
  getOriginalName: (id: string) => string;
  hideSmallCoefficients: boolean;
  smallCoefficientThreshold: number;
  loadingThreshold: number;
  communalities?: Record<string, number>;
  varianceData?: any[];
  bartlettData?: { chi: number; df: number; p: number } | null;
  kmoValue?: number | null;
}

export const FactorMatrixTable: React.FC<FactorMatrixTableProps> = ({
  factorNames, matrixItems, getOriginalName,
  hideSmallCoefficients, smallCoefficientThreshold, loadingThreshold,
  communalities, varianceData, bartlettData, kmoValue
}) => {
  const showCommunality = communalities && Object.keys(communalities).length > 0;
  const { factorSettings } = useAnalysisStore();

  // 그룹화: 요인별로 가장 적재값이 큰 문항들 묶기
  const groupedItems = useMemo(() => {
    const groups: Record<number, MockMatrixItem[]> = {};
    for (let i = 0; i < factorNames.length; i++) {
      groups[i] = [];
    }

    matrixItems.forEach(item => {
      const maxAbs = Math.max(...item.loadings.map(Math.abs));
      const domIdx = item.loadings.findIndex(v => Math.abs(v) === maxAbs);
      if (groups[domIdx]) {
        groups[domIdx].push(item);
      }
    });

    // 각 그룹 내에서 적재값 크기순 정렬 (선택사항)
    if (factorSettings.sortBySize) {
      Object.keys(groups).forEach(key => {
        const k = parseInt(key, 10);
        groups[k].sort((a, b) => Math.abs(b.loadings[k]) - Math.abs(a.loadings[k]));
      });
    }

    return groups;
  }, [matrixItems, factorNames.length, factorSettings.sortBySize]);

  const tdStyle = { padding: '8px 12px', border: '1px solid var(--border-color)', color: 'var(--text-primary)' };
  const thStyle = { ...tdStyle, backgroundColor: 'rgba(0,0,0,0.02)', fontWeight: 600, color: 'var(--text-secondary)' };

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
        <h4 className="text-body" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} color="var(--accent-primary)" />
          회전된 성분행렬 (Rotated Component Matrix)
        </h4>
        <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
          • 요인추출: 주성분분석 <br/>
          • 요인회전: {factorSettings.rotation === 'varimax' ? '배리맥스' : '오블리민'}<br/>
          • 요인적재값: {factorSettings.loading} 이상 <br/>
          • 공통성: {factorSettings.communality} 이상 <br/>
          • 분산설명력: {factorSettings.variance}% 이상 <br/>
          • KMO: {factorSettings.kmo} 이상
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderTop: '2px solid var(--accent-light)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'center', backgroundColor: 'var(--bg-surface)' }}>
          <thead>
            <tr>
              <th style={thStyle}>구성<br/>요인</th>
              <th style={{ ...thStyle, minWidth: '300px' }}>설문문항</th>
              {factorNames.map((name, i) => (
                <th key={name} style={thStyle}>요인<br/>{i + 1}</th>
              ))}
              {showCommunality && <th style={thStyle}>공통성</th>}
            </tr>
          </thead>
          <tbody>
            {factorNames.map((factorName, factorIdx) => {
              const items = groupedItems[factorIdx] || [];
              if (items.length === 0) return null; // 빈 요인인 경우

              return items.map((item, itemIdx) => {
                const origName = getOriginalName(item.id);
                const comm = communalities?.[origName];

                return (
                  <tr key={item.id} style={{ backgroundColor: 'var(--bg-base)' }}>
                    {itemIdx === 0 && (
                      <td rowSpan={items.length} style={{ ...tdStyle, backgroundColor: 'rgba(0,0,0,0.01)', verticalAlign: 'middle', whiteSpace: 'pre-wrap' }}>
                        {`요인${factorIdx + 1}\n${factorName}`}
                      </td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'left' }}>
                      {origName}
                    </td>
                    {item.loadings.map((val, colIdx) => {
                      const isHidden = hideSmallCoefficients && Math.abs(val) < smallCoefficientThreshold;
                      const isMain = Math.abs(val) >= loadingThreshold;
                      // 강조 셀 스타일 (해당 요인의 주 적재값)
                      const isHighlighted = colIdx === factorIdx;

                      return (
                        <td key={colIdx} style={{ 
                          ...tdStyle, 
                          backgroundColor: isHighlighted ? 'rgba(0,0,0,0.04)' : 'transparent',
                          color: isMain ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}>
                          {isHidden ? '' : formatStatNumber(val)}
                        </td>
                      );
                    })}
                    {showCommunality && (
                      <td style={{ ...tdStyle, color: 'var(--text-primary)' }}>
                        {comm !== undefined ? formatStatNumber(comm) : ''}
                      </td>
                    )}
                  </tr>
                );
              });
            })}

            {/* 하단 요약 (고유값, 분산설명, 누적설명) */}
            {varianceData && varianceData.length > 0 && (
              <>
                <tr>
                  <td colSpan={2} style={{ ...tdStyle, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.01)' }}>고유값</td>
                  {varianceData.map((vd, i) => (
                    <td key={i} style={tdStyle}>{vd.ss_loadings.toFixed(3)}</td>
                  ))}
                  {showCommunality && <td style={tdStyle}></td>}
                </tr>
                <tr>
                  <td colSpan={2} style={{ ...tdStyle, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.01)' }}>분산설명(%)</td>
                  {varianceData.map((vd, i) => (
                    <td key={i} style={tdStyle}>{vd.variance_pct.toFixed(3)}</td>
                  ))}
                  {showCommunality && <td style={tdStyle}></td>}
                </tr>
                <tr>
                  <td colSpan={2} style={{ ...tdStyle, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.01)' }}>누적설명(%)</td>
                  {varianceData.map((vd, i) => (
                    <td key={i} style={tdStyle}>{vd.cumulative_pct.toFixed(3)}</td>
                  ))}
                  {showCommunality && <td style={tdStyle}></td>}
                </tr>
              </>
            )}
          </tbody>
        </table>
        
        {/* Footer (KMO & Bartlett) */}
        {(kmoValue !== null || bartlettData) && (
          <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {kmoValue !== null && `KMO=${kmoValue.toFixed(3)}`}
            {kmoValue !== null && bartlettData && ", "}
            {bartlettData && `Bartlett's test결과 χ²=${bartlettData.chi.toFixed(3)} (df=${bartlettData.df}, p=${bartlettData.p.toFixed(3)})`}
          </div>
        )}
      </div>
    </div>
  );
};
