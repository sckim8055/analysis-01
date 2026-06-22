import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import '@reactflow/node-resizer/dist/style.css';

export interface CustomVariableNodeData {
  label: string;
  varType: 'iv' | 'dv' | 'med' | 'mod';
  subFactors?: { name: string }[];
  color?: string;
  parentName?: string;
}

export const CustomVariableNode: React.FC<NodeProps<CustomVariableNodeData>> = ({ data, selected }) => {
  const getVarColor = () => {
    if (data.color) return data.color;
    switch (data.varType) {
      case 'iv': return 'var(--var-iv)';
      case 'dv': return 'var(--var-dv)';
      case 'med': return 'var(--var-med)';
      case 'mod': return 'var(--var-mod)';
      default: return 'var(--text-primary)';
    }
  };

  const borderColor = getVarColor();

  const handleStyle = {
    width: '12px',
    height: '12px',
    backgroundColor: 'var(--accent-primary)',
    border: '2px solid var(--bg-panel)',
    boxShadow: '0 0 4px rgba(0,0,0,0.3)',
    zIndex: 10
  };

  return (
    <>
      <NodeResizer 
        color="var(--accent-primary)" 
        isVisible={selected} 
        minWidth={200} 
        minHeight={80} 
      />
      <div style={{
        background: 'var(--bg-panel)',
        border: `2px solid ${selected ? 'var(--accent-primary)' : borderColor}`,
        borderRadius: '8px',
        minWidth: '200px',
        width: '100%',
        height: '100%',
        boxShadow: selected ? '0 0 0 1px var(--accent-primary)' : '0 4px 6px rgba(0,0,0,0.1)',
        fontFamily: 'inherit',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}>
      {/* Target Handles (Receiving edges) - Left side */}
      <Handle type="target" position={Position.Left} id="left-target" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="target" position={Position.Top} id="top-target" style={{ ...handleStyle, left: '50%' }} />

      {/* Source Handles (Sending edges) - Right side */}
      <Handle type="source" position={Position.Right} id="right-source" style={{ ...handleStyle, top: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ ...handleStyle, left: '50%' }} />

      {/* Title Area */}
      <div style={{
        padding: '12px 16px',
        borderBottom: data.subFactors && data.subFactors.length > 0 ? `1px solid ${borderColor}` : 'none',
        textAlign: 'center',
        fontWeight: 'bold',
        color: 'var(--text-primary)',
        backgroundColor: `${borderColor}11` // slight tint
      }}>
        {data.parentName && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'normal' }}>{data.parentName}</div>}
        {data.label}
      </div>

      {/* Subfactors List (if any) */}
      {data.subFactors && data.subFactors.length > 0 && (
        <div style={{
          padding: '12px',
          color: 'var(--text-secondary)',
          fontSize: '12px',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <ul style={{ margin: 0, paddingLeft: '16px', overflowY: 'auto' }} className="nodrag">
            {data.subFactors.map((sf, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{sf.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
    </>
  );
};
