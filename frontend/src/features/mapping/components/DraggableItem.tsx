import React from 'react';
import { GripVertical } from 'lucide-react';

interface DraggableItemProps {
  id: string;
  name: string;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}

export const DraggableItem: React.FC<DraggableItemProps> = ({ id, name, isSelected, onToggleSelect, onDragStart }) => {
  return (
    <div 
      draggable
      onClick={(e) => { e.stopPropagation(); onToggleSelect(id); }}
      onDragStart={(e) => onDragStart(e, id)}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 10px', 
        backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-panel)',
        border: isSelected ? '1px solid var(--accent-light)' : '1px solid var(--border-color)', 
        borderRadius: '6px',
        cursor: 'grab', 
        color: isSelected ? '#fff' : 'var(--text-primary)',
        boxShadow: isSelected ? '0 0 8px rgba(74, 144, 226, 0.5)' : 'var(--shadow-sm)', 
        marginBottom: '6px', fontSize: '0.85rem',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ cursor: 'grab' }}>
        <GripVertical size={14} color={isSelected ? "#fff" : "var(--text-muted)"} />
      </div>
      <span>{name}</span>
    </div>
  );
};
