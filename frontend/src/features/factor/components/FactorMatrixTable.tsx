import React from 'react';
import { Layers } from 'lucide-react';
import type { MockMatrixItem } from '../utils/factorMockLogic';
import { formatStatNumber } from '../../../utils/formatters';

interface FactorMatrixTableProps {
  factorNames: string[];
  matrixItems: MockMatrixItem[];
  getOriginalName: (id: string) => string;
  hideSmallCoefficients: boolean;
  smallCoefficientThreshold: number;
  loadingThreshold: number;
}

export const FactorMatrixTable: React.FC<FactorMatrixTableProps> = ({
  factorNames, matrixItems, getOriginalName, 
  hideSmallCoefficients, smallCoefficientThreshold, loadingThreshold
}) => {
  return (
    <div style={{ marginBottom: '20px' }}>
      <h4 className="text-body" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid var(--accent-light)' }}>
        <Layers size={16} color="var(--accent-primary)" />
        회전된 성분행렬 (Rotated Component Matrix)
      </h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'center' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '8px', textAlign: 'left', fontWeight: 'normal' }}>문항</th>
              {factorNames.map(name => (
                <th key={name} style={{ padding: '8px', fontWeight: 'normal' }}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrixItems.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                <td style={{ padding: '8px', textAlign: 'left', color: 'var(--text-primary)' }}>{getOriginalName(item.id)}</td>
                {item.loadings.map((val, idx) => {
                  const isHidden = hideSmallCoefficients && Math.abs(val) < smallCoefficientThreshold;
                  const isMain = Math.abs(val) >= loadingThreshold;
                  return (
                    <td key={idx} style={{ 
                      padding: '8px', 
                      color: isMain ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      fontWeight: isMain ? 600 : 400
                    }}>
                      {isHidden ? '' : formatStatNumber(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
