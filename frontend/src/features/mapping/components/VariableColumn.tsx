import React from 'react';
import { Plus } from 'lucide-react';
import type { VarType, Variable, Item } from '../../../types';
import { VariableCard } from './VariableCard';

interface VariableColumnProps {
  type: VarType;
  title: string;
  variables: Variable[];
  itemsDict: Record<string, Item>;
  selectedItems: string[];
  onToggleSelect: (id: string) => void;
  onItemDragStart: (e: React.DragEvent, id: string) => void;
  onVariableDragStart: (e: React.DragEvent, type: VarType, varId: string) => void;
  onSubFactorDragStart: (e: React.DragEvent, type: VarType, varId: string, sfId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetPath: string) => void;
  onAddVariable: (type: VarType) => void;
  onUpdateName: (type: VarType, varId: string, newName: string, sfId?: string) => void;
  onDeleteVariable: (type: VarType, varId: string) => void;
  onAddSubFactor: (type: VarType, varId: string) => void;
  onDeleteSubFactor: (type: VarType, varId: string, sfId: string) => void;
}

export const VariableColumn: React.FC<VariableColumnProps> = ({
  type, title, variables, itemsDict, selectedItems,
  onToggleSelect, onItemDragStart, onVariableDragStart, onSubFactorDragStart,
  onDragOver, onDrop, onAddVariable, onUpdateName, onDeleteVariable,
  onAddSubFactor, onDeleteSubFactor
}) => {
  const color = `var(--var-${type})`;

  return (
    <div 
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, type)}
      style={{ minHeight: 0, borderTop: `4px solid ${color}`, backgroundColor: 'var(--bg-base)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
        <h3 className="text-h3" style={{ color }}>{title}</h3>
        <button onClick={() => onAddVariable(type)} className="btn-icon" style={{ width: 'auto', padding: '4px 8px', height: '32px', backgroundColor: color, color: '#fff' }}>
          <Plus size={14} style={{ marginRight: '4px' }} /> <span className="text-small" style={{ color: '#fff' }}>변수</span>
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        {variables.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
            상단 버튼을 눌러 변수 생성
          </div>
        ) : (
          variables.map(v => (
            <VariableCard
              key={v.id} type={type} v={v} itemsDict={itemsDict}
              selectedItems={selectedItems} onToggleSelect={onToggleSelect}
              onItemDragStart={onItemDragStart} onVariableDragStart={onVariableDragStart}
              onSubFactorDragStart={onSubFactorDragStart} onDragOver={onDragOver}
              onDrop={onDrop} onUpdateName={onUpdateName} onDeleteVariable={onDeleteVariable}
              onAddSubFactor={onAddSubFactor} onDeleteSubFactor={onDeleteSubFactor}
            />
          ))
        )}
      </div>
    </div>
  );
};
