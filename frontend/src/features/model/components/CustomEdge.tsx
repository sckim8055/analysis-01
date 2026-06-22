import React from 'react';
import { 
  BaseEdge, 
  EdgeLabelRenderer, 
  getBezierPath, 
  useReactFlow,
  type EdgeProps,
  type Edge,
  type Node,
  MarkerType
} from 'reactflow';

export const CustomEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label
}: EdgeProps) => {
  const { setEdges, setNodes, getEdge } = useReactFlow();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onAddJunction = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // 이 엣지를 찾아서 삭제하고, 중간에 Junction Node를 삽입
    const currentEdge = getEdge(id);
    if (!currentEdge) return;

    // 새 Junction 노드 생성 (선택된 선 중앙에 위치)
    const junctionId = `junction-${Date.now()}`;
    const junctionNode: Node = {
      id: junctionId,
      type: 'junction',
      position: { x: labelX, y: labelY },
      data: { label: '조절점' }
    };

    setNodes((nds) => [...nds, junctionNode]);

    // 기존 선을 두 개로 분할
    const edge1: Edge = {
      id: `${currentEdge.id}-part1`,
      source: currentEdge.source,
      target: junctionId,
      sourceHandle: currentEdge.sourceHandle,
      type: 'custom',
      style: { stroke: 'var(--text-secondary)', strokeWidth: 2 },
    };

    const edge2: Edge = {
      id: `${currentEdge.id}-part2`,
      source: junctionId,
      target: currentEdge.target,
      targetHandle: currentEdge.targetHandle,
      type: 'custom',
      style: { stroke: 'var(--text-secondary)', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--text-secondary)' },
      label: currentEdge.label // 라벨은 뒷부분 선에 유지
    };

    setEdges((eds) => eds.filter(e => e.id !== id).concat(edge1, edge2));
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            zIndex: 20,
          }}
          className="nodrag nopan"
        >
          {label && (
            <div style={{
              background: 'var(--bg-panel)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}>
              {label}
            </div>
          )}
          
          <button 
            onClick={onAddJunction}
            title="이 선 중앙에 조절점(Junction) 삽입"
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--accent-primary)',
              color: 'white',
              border: '2px solid var(--bg-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              lineHeight: 1,
              padding: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          >
            +
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};
