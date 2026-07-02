import React, { useState, useEffect, useCallback } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { CheckSquare } from 'lucide-react';
import { useAnalysisStore } from '../../store/analysisStore';
import type { Item, VarType } from '../../types';
import { useMappingDnD } from './hooks/useMappingDnD';
import { VariableColumn } from './components/VariableColumn';
import { DraggableItem } from './components/DraggableItem';

export const MappingView: React.FC = () => {
  const { setCurrentStep } = useUiStore();
  const { originalColumns, demographicColumns } = useProjectStore();
  const { mappedVars, setMappedVars } = useAnalysisStore();
  
  const [items, setItems] = useState<Record<string, Item>>({});
  const [unassigned, setUnassigned] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  
  const sortUnassigned = useCallback((ids: string[]) => {
    return [...ids].sort((a, b) => {
      const numA = parseInt(a.replace('col_', ''), 10);
      const numB = parseInt(b.replace('col_', ''), 10);
      return (isNaN(numA) ? 0 : numA) - (isNaN(numB) ? 0 : numB);
    });
  }, []);

  useEffect(() => {
    if (originalColumns && originalColumns.length > 0) {
      const newItems: Record<string, Item> = {};
      const validKeys: string[] = [];
      const hiddenCols = demographicColumns || [];
      
      originalColumns.forEach((col, idx) => {
        if (!hiddenCols.includes(col)) {
          const id = `col_${idx}`;
          newItems[id] = { id, name: col };
          validKeys.push(id);
        }
      });
      setItems(newItems);
      setUnassigned(validKeys);
    }
  }, [originalColumns, demographicColumns]);

  // Hook for DnD logic
  const { 
    handleDragOver, handleDrop, handleItemDragStart, 
    handleVariableDragStart, handleSubFactorDragStart 
  } = useMappingDnD(selectedItems, setSelectedItems, setUnassigned, sortUnassigned);

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // State Mutators
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const addVariable = (type: VarType) => {
    setMappedVars(prev => ({
      ...prev,
      [type]: [...(prev[type] || []), { id: `var_${generateId()}`, name: '새 변수', itemIds: [], subFactors: [] }]
    }));
  };

  const deleteVariable = (type: VarType, varId: string) => {
    setMappedVars(prev => {
      const v = (prev[type] || []).find(v => v.id === varId);
      if (v) {
        const itemsToReturn = [...(v.itemIds || []), ...v.subFactors.flatMap(sf => sf.itemIds)];
        if (itemsToReturn.length > 0) {
          setUnassigned(u => sortUnassigned([...u, ...itemsToReturn]));
        }
      }
      return { ...prev, [type]: (prev[type] || []).filter(v => v.id !== varId) };
    });
  };

  const addSubFactor = (type: VarType, varId: string) => {
    setMappedVars(prev => {
      const vars = (prev[type] || []).map(v => {
        if (v.id === varId) {
          return { ...v, subFactors: [...v.subFactors, { id: `sf_${generateId()}`, name: '새 하위요인', itemIds: [] }] };
        }
        return v;
      });
      return { ...prev, [type]: vars };
    });
  };

  const deleteSubFactor = (type: VarType, varId: string, sfId: string) => {
    setMappedVars(prev => {
      const v = (prev[type] || []).find(v => v.id === varId);
      if (v) {
        const sf = v.subFactors.find(sf => sf.id === sfId);
        if (sf && sf.itemIds.length > 0) {
          setUnassigned(u => sortUnassigned([...u, ...sf.itemIds]));
        }
      }
      const newTypeArray = (prev[type] || []).map(v => {
        if (v.id === varId) {
          return { ...v, subFactors: v.subFactors.filter(sf => sf.id !== sfId) };
        }
        return v;
      });
      return { ...prev, [type]: newTypeArray };
    });
  };

  const updateName = (type: VarType, varId: string, newName: string, subFactorId?: string) => {
    setMappedVars(prev => {
      const vars = (prev[type] || []).map(v => {
        if (v.id === varId) {
          if (subFactorId) {
            return {
              ...v,
              subFactors: v.subFactors.map(sf => sf.id === subFactorId ? { ...sf, name: newName } : sf)
            };
          }
          return { ...v, name: newName };
        }
        return v;
      });
      return { ...prev, [type]: vars };
    });
  };

  const columnConfig = [
    { type: 'iv' as VarType, title: '독립변수 (IV)' },
    { type: 'dv' as VarType, title: '종속변수 (DV)' },
    { type: 'med' as VarType, title: '매개변수 (MED)' },
    { type: 'mod' as VarType, title: '조절변수 (MOD)' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minHeight: '700px', minWidth: '1000px', padding: '24px' }}>
      
      {/* 상단 공통 액션 바 (Spotfire 스타일) */}
      <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>변수 매핑</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            원본 문항을 드래그하여 변수와 하위 요인에 매핑하세요.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => {
              useAnalysisStore.getState().addAuditLog({
                step: '변수 매핑',
                action: '변수 매핑 완료',
                details: { mappedVars }
              });
              setCurrentStep('factor');
            }}
          >
            <CheckSquare size={18} /> 매핑 완료 (요인분석 이동) ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
        
        {/* 원본 문항 패널 (좌측) */}
        <div className="glass-panel" style={{ width: '280px', borderRadius: '12px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <h2 className="text-h3">원본 문항 목록</h2>
            <p className="text-small" style={{ marginTop: '4px' }}>여러 개를 클릭해 선택 후 드래그 가능</p>
          </div>
          <div 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'unassigned')}
            style={{ padding: '16px', flex: 1, overflowY: 'auto' }}
          >
            {unassigned.map(id => (
              <DraggableItem
                key={id} id={id} name={items[id]?.name || id}
                isSelected={selectedItems.includes(id)}
                onToggleSelect={toggleSelect} onDragStart={handleItemDragStart}
              />
            ))}
          </div>
        </div>

        {/* 매핑 캔버스 (우측) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', flex: 1, overflow: 'hidden' }}>
            {columnConfig.map(({ type, title }) => (
              <VariableColumn
                key={type} type={type} title={title}
                variables={mappedVars[type] || []} itemsDict={items}
                selectedItems={selectedItems} onToggleSelect={toggleSelect}
                onItemDragStart={handleItemDragStart} onVariableDragStart={handleVariableDragStart}
                onSubFactorDragStart={handleSubFactorDragStart} onDragOver={handleDragOver}
                onDrop={handleDrop} onAddVariable={addVariable} onUpdateName={updateName}
                onDeleteVariable={deleteVariable} onAddSubFactor={addSubFactor} onDeleteSubFactor={deleteSubFactor}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
