import { useCallback } from 'react';
import type { VarType } from '../../../types';
import { useAnalysisStore } from '../../../store/analysisStore';

export const useMappingDnD = (
  selectedItems: string[],
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>,
  setUnassigned: React.Dispatch<React.SetStateAction<string[]>>,
  sortUnassigned: (ids: string[]) => string[]
) => {
  const { setMappedVars } = useAnalysisStore();

  const handleItemDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.stopPropagation();
    const dragIds = selectedItems.includes(id) ? selectedItems : [id];
    e.dataTransfer.setData('text/plain', JSON.stringify({ dragType: 'ITEM', itemIds: dragIds }));
  }, [selectedItems]);

  const handleVariableDragStart = useCallback((e: React.DragEvent, type: VarType, varId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ dragType: 'VARIABLE', sourceType: type, varId }));
  }, []);

  const handleSubFactorDragStart = useCallback((e: React.DragEvent, type: VarType, varId: string, sfId: string) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', JSON.stringify({ dragType: 'SUBFACTOR', sourcePath: `${type}|${varId}`, sfId }));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;

    try {
      const payload = JSON.parse(data);
      const dragType = payload.dragType || 'ITEM';

      // 1. 변수 (VARIABLE) 이동 로직
      if (dragType === 'VARIABLE') {
        const { sourceType, varId } = payload;
        const targetType = targetPath.split('|')[0] as VarType | 'unassigned';
        if (targetType === 'unassigned') return;

        setMappedVars(prev => {
          const sourceList = prev[sourceType as VarType] || [];
          const vToMove = sourceList.find(v => v.id === varId);
          if (!vToMove) return prev;

          const newVars = { ...prev };
          newVars[sourceType as VarType] = sourceList.filter(v => v.id !== varId);
          newVars[targetType] = [...(newVars[targetType] || []), vToMove];
          return newVars;
        });
        return;
      }

      // 2. 하위 요인 (SUBFACTOR) 이동 로직
      if (dragType === 'SUBFACTOR') {
        const { sourcePath, sfId } = payload;
        const [sType, sVarId] = sourcePath.split('|');
        const targetParts = targetPath.split('|');
        const targetType = targetParts[0] as VarType | 'unassigned';
        const targetVarId = targetParts[1];
        
        if (targetType === 'unassigned' || !targetVarId) return;

        setMappedVars(prev => {
          const sourceVar = (prev[sType as VarType] || []).find(v => v.id === sVarId);
          const sfToMove = sourceVar?.subFactors.find(sf => sf.id === sfId);
          if (!sfToMove) return prev;

          const newVars = { ...prev };
          newVars[sType as VarType] = (newVars[sType as VarType] || []).map(v => 
            v.id === sVarId ? { ...v, subFactors: v.subFactors.filter(sf => sf.id !== sfId) } : v
          );
          newVars[targetType] = (newVars[targetType] || []).map(v => 
            v.id === targetVarId ? { ...v, subFactors: [...v.subFactors, sfToMove] } : v
          );
          return newVars;
        });
        return;
      }

      // 3. 설문항 (ITEM) 이동 로직
      if (dragType === 'ITEM') {
        const { itemIds } = payload as { itemIds: string[] };
        if (!itemIds || itemIds.length === 0) return;

        if (targetPath !== 'unassigned') {
          const targetParts = targetPath.split('|');
          if (!targetParts[1]) return; // 변수 ID가 없으면 드롭 무시
        }

        setUnassigned(prev => prev.filter(id => !itemIds.includes(id)));
        
        setMappedVars(prev => {
          const newVars = { ...prev };
          (['iv', 'dv', 'med', 'mod', 'gen'] as VarType[]).forEach(type => {
            newVars[type] = (newVars[type] || []).map(v => ({
              ...v,
              itemIds: v.itemIds ? v.itemIds.filter(id => !itemIds.includes(id)) : [],
              subFactors: v.subFactors.map(sf => ({
                ...sf,
                itemIds: sf.itemIds.filter(id => !itemIds.includes(id))
              }))
            }));
          });
          
          if (targetPath !== 'unassigned') {
            const [tType, tVarId, tSfId] = targetPath.split('|');

            newVars[tType as VarType] = (newVars[tType as VarType] || []).map(v => {
              if (v.id === tVarId) {
                if (tSfId) {
                  return {
                    ...v,
                    subFactors: v.subFactors.map(sf => 
                      sf.id === tSfId ? { ...sf, itemIds: sortUnassigned([...sf.itemIds, ...itemIds]) } : sf
                    )
                  };
                } else {
                  return {
                    ...v,
                    itemIds: sortUnassigned([...(v.itemIds || []), ...itemIds])
                  };
                }
              }
              return v;
            });
          }
          
          return newVars;
        });

        if (targetPath === 'unassigned') {
          setUnassigned(prev => sortUnassigned([...prev, ...itemIds]));
        }

        setSelectedItems([]);
      }

    } catch (err) {
      console.error(err);
    }
  }, [selectedItems, setMappedVars, setUnassigned, setSelectedItems, sortUnassigned]);

  return {
    handleItemDragStart,
    handleVariableDragStart,
    handleSubFactorDragStart,
    handleDragOver,
    handleDrop
  };
};
