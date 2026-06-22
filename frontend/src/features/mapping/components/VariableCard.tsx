import React from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import type { Variable, VarType, Item } from '../../../types';
import { DraggableItem } from './DraggableItem';
import { SubFactorCard } from './SubFactorCard';

interface VariableCardProps {
  type: VarType;
  v: Variable;
  itemsDict: Record<string, Item>;
  selectedItems: string[];
  onToggleSelect: (id: string) => void;
  onItemDragStart: (e: React.DragEvent, id: string) => void;
  onVariableDragStart: (e: React.DragEvent, type: VarType, varId: string) => void;
  onSubFactorDragStart: (e: React.DragEvent, type: VarType, varId: string, sfId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetPath: string) => void;
  onUpdateName: (type: VarType, varId: string, newName: string, sfId?: string) => void;
  onDeleteVariable: (type: VarType, varId: string) => void;
  onAddSubFactor: (type: VarType, varId: string) => void;
  onDeleteSubFactor: (type: VarType, varId: string, sfId: string) => void;
}

export const VariableCard: React.FC<VariableCardProps> = ({
  type, v, itemsDict, selectedItems, onToggleSelect, onItemDragStart,
  onVariableDragStart, onSubFactorDragStart, onDragOver, onDrop,
  onUpdateName, onDeleteVariable, onAddSubFactor, onDeleteSubFactor
}) => {
  return (
    <div 
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, `${type}|${v.id}`)}
      style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', marginBottom: '16px', backgroundColor: 'var(--bg-surface)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div 
            draggable
            onDragStart={(e) => onVariableDragStart(e, type, v.id)}
            style={{ cursor: 'grab', padding: '4px', marginRight: '4px' }}
            title="변수 끌어서 이동"
          >
            <GripVertical size={16} color="var(--text-muted)" />
          </div>
          <input 
            value={v.name}
            onChange={(e) => onUpdateName(type, v.id, e.target.value)}
            style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: '1px solid var(--accent-primary)', color: 'var(--text-primary)', outline: 'none', fontSize: '1.1rem', fontWeight: 600, width: 'calc(100% - 70px)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => onAddSubFactor(type, v.id)} className="btn-icon" style={{ width: 'auto', padding: '4px 8px', height: '28px', border: '1px solid var(--accent-light)', backgroundColor: 'rgba(74, 144, 226, 0.1)', color: 'var(--accent-primary)' }}>
            <Plus size={14} style={{ marginRight: '2px' }} /> <span className="text-small" style={{ fontWeight: 600 }}>요인</span>
          </button>
          <button onClick={() => onDeleteVariable(type, v.id)} className="btn-icon" style={{ padding: '4px', height: '28px', color: '#ff4d4f' }} title="변수 삭제">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div>
        <div style={{ minHeight: '40px', border: '1px dashed var(--border-color)', borderRadius: '6px', padding: '8px', marginBottom: '12px', backgroundColor: 'rgba(255,255,255,0.02)' }}>
          {(!v.itemIds || v.itemIds.length === 0) ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>(단일 요인일 경우) 여기에 문항 직접 드롭</span>
          ) : (
            v.itemIds.map(id => (
              <DraggableItem 
                key={id} id={id} name={itemsDict[id]?.name || id}
                isSelected={selectedItems.includes(id)}
                onToggleSelect={onToggleSelect} onDragStart={onItemDragStart}
              />
            ))
          )}
        </div>

        {v.subFactors.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>하위 요인을 추가하려면 상단의 [+ 요인] 클릭</div>
        ) : (
          v.subFactors.map(sf => (
            <SubFactorCard 
              key={sf.id} type={type} varId={v.id} sf={sf}
              itemsDict={itemsDict} selectedItems={selectedItems}
              onToggleSelect={onToggleSelect} onItemDragStart={onItemDragStart}
              onSubFactorDragStart={onSubFactorDragStart} onDragOver={onDragOver}
              onDrop={onDrop} onUpdateName={onUpdateName} onDeleteSubFactor={onDeleteSubFactor}
            />
          ))
        )}
      </div>
    </div>
  );
};
