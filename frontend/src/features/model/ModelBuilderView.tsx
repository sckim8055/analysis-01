import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, { 
  MiniMap, 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useUiStore } from '../../store/uiStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { CustomVariableNode } from './components/CustomVariableNode';
import { JunctionNode } from './components/JunctionNode';
import { CustomEdge } from './components/CustomEdge';
import { PlusCircle, Clipboard, ArrowRight, X, CheckSquare } from 'lucide-react';
import { generateHypotheses, type Hypothesis } from './utils/hypothesisGenerator';

const nodeTypes = {
  customVariable: CustomVariableNode,
  junction: JunctionNode
};

const edgeTypes = {
  custom: CustomEdge
};

export const ModelBuilderView: React.FC = () => {
  const { setCurrentStep } = useUiStore();
  const { mappedVars, savedModelNodes, savedModelEdges, saveModel } = useAnalysisStore();
  
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(savedModelNodes.length > 0 ? savedModelNodes : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(savedModelEdges.length > 0 ? savedModelEdges : []);
  const [junctionCounter, setJunctionCounter] = useState(1);
  const [showHypotheses, setShowHypotheses] = useState(false);
  const [generatedHypotheses, setGeneratedHypotheses] = useState<Hypothesis[]>([]);

  // 자동 저장 로직: 노드나 엣지가 변경될 때마다 전역 스토어에 저장
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      saveModel(nodes, edges);
    }
  }, [nodes, edges, saveModel]);

  // 동적 노드 생성 로직 (초기 진입 시 한 번만 실행)
  useEffect(() => {
    if (!mappedVars) return;
    if (savedModelNodes.length > 0) return; // 이미 저장된 모형이 있으면 자동 생성 안 함

    const newNodes: Node[] = [];
    
    const generateNodesForVarGroup = (vars: typeof mappedVars.iv, varType: 'iv' | 'dv' | 'med' | 'mod', baseX: number, startY: number) => {
      let currentY = startY;
      
      vars.forEach(v => {
        newNodes.push({
          id: v.id,
          type: 'customVariable',
          position: { x: baseX, y: currentY },
          data: { 
            label: v.name, 
            varType: varType,
            subFactors: v.subFactors ? v.subFactors.map(sf => ({ name: sf.name })) : []
          },
          deletable: false,
        });
        currentY += 200;
      });
    };

    // IV (독립변수): 좌측
    generateNodesForVarGroup(mappedVars.iv, 'iv', 100, 150);
    // DV (종속변수): 우측
    generateNodesForVarGroup(mappedVars.dv, 'dv', 800, 150);
    // MED (매개변수): 상단 중앙
    generateNodesForVarGroup(mappedVars.med, 'med', 450, 50);
    // MOD (조절변수): 하단 중앙
    generateNodesForVarGroup(mappedVars.mod, 'mod', 450, 450);

    setNodes(newNodes);
  }, [mappedVars, setNodes]);

  const onConnect = useCallback((params: Edge | Connection) => {
    // Check if target is a junction node
    const isTargetJunction = nodes.find(n => n.id === params.target)?.type === 'junction';
    
    const newEdge: Edge = {
      ...params as Edge,
      id: `e-${params.source}-${params.target}-${Date.now()}`,
      type: 'custom',
      animated: false,
      style: { 
        stroke: isTargetJunction ? 'var(--danger)' : 'var(--text-secondary)', 
        strokeWidth: isTargetJunction ? 3 : 2 
      },
      markerEnd: { 
        type: MarkerType.ArrowClosed, 
        color: isTargetJunction ? 'var(--danger)' : 'var(--text-secondary)' 
      },
      labelBgStyle: { fill: 'var(--bg-panel)', color: 'var(--text-primary)', fillOpacity: 0.8 },
      labelStyle: { fill: 'var(--text-primary)', fontWeight: 600, fontSize: 14 }
    };
    setEdges((eds) => addEdge(newEdge, eds));
  }, [setEdges, nodes]);

  // 가설 라벨 수정 (더블 클릭)
  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    const currentLabel = typeof edge.label === 'string' ? edge.label : '';
    const newLabel = window.prompt('가설 라벨을 입력하세요 (예: H1, HA1(매개)):', currentLabel);
    
    if (newLabel !== null) {
      setEdges((eds) => eds.map(e => {
        if (e.id === edge.id) {
          return { ...e, label: newLabel };
        }
        return e;
      }));
    }
  }, [setEdges]);

  const addJunctionNode = () => {
    const newJunction: Node = {
      id: `junction-${junctionCounter}`,
      type: 'junction',
      position: { x: 450, y: 250 }, // 중앙 위치에 생성
      data: { label: '조절점' },
    };
    setNodes(nds => [...nds, newJunction]);
    setJunctionCounter(prev => prev + 1);
  };

  const getNodeColor = (node: Node) => {
    const varType = node.data?.varType;
    if (varType === 'iv') return 'var(--var-iv)';
    if (varType === 'dv') return 'var(--var-dv)';
    if (varType === 'med') return 'var(--var-med)';
    if (varType === 'mod') return 'var(--var-mod)';
    if (node.type === 'junction') return 'var(--accent-primary)';
    return 'var(--text-muted)';
  };

  const handleFinalizeModel = () => {
    const hypos = generateHypotheses(nodes, edges);
    setGeneratedHypotheses(hypos);
    setShowHypotheses(true);
  };

  const handleCopyToClipboard = () => {
    const text = generatedHypotheses.map((h, i) => `가설 ${i+1}. ${h.text}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert('클립보드에 복사되었습니다.');
    });
  };

  const handleProceed = () => {
    setShowHypotheses(false);
    setCurrentStep('frequency');
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '24px' }}>
      
      {/* 상단 공통 액션 바 (Spotfire 스타일) */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="text-h3" style={{ margin: 0 }}>연구 모형 빌더</h2>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <button className="btn-outline" onClick={addJunctionNode} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} />
            조절점(Junction) 추가
          </button>
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            * 점(원)을 끌어 선을 잇고, <b>선의 [+] 버튼</b>을 눌러 조절점을 만드세요. 선 더블클릭 시 <b>라벨 입력</b>.<br/>
            * <b>노드를 클릭</b>하면 나타나는 테두리를 드래그하여 <b>박스 크기를 조절</b>할 수 있습니다.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={handleFinalizeModel} style={{ backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={18} /> 모형 확정 (가설 생성) ▶
          </button>
        </div>
      </div>

      {/* 캔버스 영역 */}
      <div style={{ flex: 1, backgroundColor: 'var(--bg-base)', position: 'relative', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeDoubleClick={onEdgeDoubleClick}
          fitView
          attributionPosition="bottom-left"
          deleteKeyCode={['Backspace', 'Delete']} // 선 및 조절점 삭제 키
        >
          <Background color="var(--border-color)" gap={24} size={2} />
          <Controls style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)' }} />
          <MiniMap 
            nodeColor={getNodeColor}
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}
          />
        </ReactFlow>
      </div>

      {/* 가설 생성 모달 */}
      {showHypotheses && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-panel)', width: '600px', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
            maxHeight: '80vh'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-h2" style={{ margin: 0 }}>자동 생성된 연구 가설</h2>
              <button onClick={() => setShowHypotheses(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              {generatedHypotheses.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0' }}>
                  생성된 가설이 없습니다. 캔버스에 선을 그어 모형을 구성해주세요.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {generatedHypotheses.map((h, i) => (
                    <li key={i} style={{ padding: '12px', background: 'var(--bg-base)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', background: 'var(--accent-primary)', color: 'white', fontSize: '11px', fontWeight: 'bold', marginBottom: '8px' }}>
                        {h.type}
                      </span>
                      <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                        <strong>가설 {i+1}.</strong> {h.text}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-outline" onClick={handleCopyToClipboard} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clipboard size={18} />
                클립보드 복사
              </button>
              <button className="btn-primary" onClick={handleProceed} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--success)' }}>
                이 가설로 분석 시작하기
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};
