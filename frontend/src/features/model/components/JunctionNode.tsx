import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

export const JunctionNode: React.FC<NodeProps> = ({ selected }) => {
  return (
    <div style={{
      width: '12px',
      height: '12px',
      background: selected ? 'var(--accent-primary)' : 'var(--text-muted)',
      borderRadius: '50%',
      border: '2px solid var(--bg-base)',
      boxShadow: selected ? '0 0 0 2px var(--accent-primary)' : 'none',
      position: 'relative',
      transform: 'translate(-50%, -50%)' // center it perfectly
    }}>
      {/* Accept incoming connections from all directions */}
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <Handle type="target" position={Position.Bottom} style={{ visibility: 'hidden' }} />
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="target" position={Position.Right} style={{ visibility: 'hidden' }} />

      {/* Allow outgoing connections if needed (mostly it receives a moderation edge, but maybe it splits a main edge) */}
      <Handle type="source" position={Position.Top} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  );
};
