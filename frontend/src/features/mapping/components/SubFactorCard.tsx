import React from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import type { SubFactor, VarType, Item } from '../../../types';
import { DraggableItem } from './DraggableItem';

interface SubFactorCardProps {
  type: VarType;
  varId: string;
  sf: SubFactor;
  itemsDict: Record<string, Item>;
  selectedItems: string[];
  onToggleSelect: (id: string) => void;
  onItemDragStart: (e: React.DragEvent, id: string) => void;
  onSubFactorDragStart: (e: React.DragEvent, type: VarType, varId: string, sfId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetPath: string) => void;
  onUpdateName: (type: VarType, varId: string, newName: string, sfId?: string) => void;
  onDeleteSubFactor: (type: VarType, varId: string, sfId: string) => void;
}

export const SubFactorCard: React.FC<SubFactorCardProps> = ({
  type, varId, sf, itemsDict, selectedItems, onToggleSelect, onItemDragStart, 
  onSubFactorDragStart, onDragOver, onDrop, onUpdateName, onDeleteSubFactor
}) => {
  const targetPath = `${type}|${varId}|${sf.id}`;
  
  return (
    <div 
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, targetPath)}
      style={{
        border: '1px solid var(--border-light)', borderRadius: '8px',
        padding: '12px', marginBottom: '12px', backgroundColor: 'rgba(0,0,0,0.1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
        <div 
          draggable
          onDragStart={(e) => onSubFactorDragStart(e, type, varId, sf.id)}
          style={{ cursor: 'grab', padding: '4px' }}
          title="요인 끌어서 이동"
        >
          <GripVertical size={14} color="var(--text-muted)" />
        </div>
        <input 
          value={sf.name}
          onChange={(e) => onUpdateName(type, varId, e.target.value, sf.id)}
          style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-light)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem', fontWeight: 600 }}
        />
        <button onClick={() => onDeleteSubFactor(type, varId, sf.id)} className="btn-icon" style={{ padding: '2px', color: '#ff4d4f' }} title="요인 삭제">
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ minHeight: '60px', border: '1px dashed var(--border-color)', borderRadius: '6px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        {sf.itemIds.length === 0 ? (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>문항 드롭존</span>
        ) : (
          sf.itemIds.map(id => (
            <DraggableItem 
              key={id} id={id} name={itemsDict[id]?.name || id}
              isSelected={selectedItems.includes(id)}
              onToggleSelect={onToggleSelect} onDragStart={onItemDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
};
