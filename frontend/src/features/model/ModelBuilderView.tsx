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
import { PlusCircle, Clipboard, ArrowRight, X, CheckSquare, Play, Check, LayoutTemplate, Layers } from 'lucide-react';
import { type Hypothesis } from './utils/hypothesisGenerator';

const nodeTypes = {
  customVariable: CustomVariableNode,
  junction: JunctionNode
};

const edgeTypes = {
  custom: CustomEdge
};

export const ModelBuilderView: React.FC = () => {
  const { setCurrentStep } = useUiStore();
  const { mappedVars, savedModelNodes, savedModelEdges, saveModel, factorResults } = useAnalysisStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(savedModelNodes.length > 0 ? savedModelNodes : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(savedModelEdges.length > 0 ? savedModelEdges : []);
  const [junctionCounter, setJunctionCounter] = useState(1);
  const [showHypotheses, setShowHypotheses] = useState(false);
  const [generatedHypotheses, setGeneratedHypotheses] = useState<Hypothesis[]>([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);

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
            isGroup: false
          },
          deletable: false,
        });
        currentY += 150;
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
  }, [mappedVars, setNodes, factorResults, savedModelNodes.length]);

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
  
  

  // 템플릿 썸네일 렌더링 헬퍼 함수
  const renderThumbnail = (id: string) => {
    const iv = 'var(--var-iv)';
    const dv = 'var(--var-dv)';
    const med = 'var(--var-med)';
    const mod = 'var(--var-mod)';
    const line = 'var(--border-dark)';
    const textStyle = { fill: 'white', fontSize: '9px', fontWeight: 'bold', textAnchor: 'middle' as any, alignmentBaseline: 'central' as any };

    const svgWrapper = (children: React.ReactNode) => (
      <svg width="100%" height="100%" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={line} />
          </marker>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2" />
          </filter>
        </defs>
        {children}
      </svg>
    );

    const drawNode = (x: number, y: number, color: string, label: string) => (
      <g>
        <rect x={x} y={y} width="20" height="16" rx="4" fill={color} filter="url(#shadow)" />
        <text x={x + 10} y={y + 8} {...textStyle} fontSize={label.length > 1 ? '7px' : '9px'} style={{ userSelect: 'none' }}>{label}</text>
      </g>
    );

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => (
      <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={line} strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />
    );

    switch (id) {
      case 'model1':
        return svgWrapper(
          <>
            {drawNode(10, 30, iv, 'X')}
            {drawNode(70, 30, dv, 'Y')}
            {drawNode(40, 5, mod, 'W')}
            {drawLine(32, 38, 68, 38)}
            {drawLine(50, 23, 50, 38)}
          </>
        );
      case 'model4':
        return svgWrapper(
          <>
            {drawNode(10, 40, iv, 'X')}
            {drawNode(70, 40, dv, 'Y')}
            {drawNode(40, 5, med, 'M')}
            {drawLine(32, 48, 68, 48)}
            {drawLine(25, 38, 43, 23)}
            {drawLine(57, 23, 75, 38)}
          </>
        );
      case 'model6':
        return svgWrapper(
          <>
            {drawNode(5, 40, iv, 'X')}
            {drawNode(75, 40, dv, 'Y')}
            {drawNode(25, 5, med, 'M1')}
            {drawNode(55, 5, med, 'M2')}
            {drawLine(27, 48, 73, 48)}
            {drawLine(20, 38, 30, 23)}
            {drawLine(47, 13, 53, 13)}
            {drawLine(70, 23, 80, 38)}
          </>
        );
      case 'model7':
        return svgWrapper(
          <>
            {drawNode(10, 40, iv, 'X')}
            {drawNode(70, 40, dv, 'Y')}
            {drawNode(40, 20, med, 'M')}
            {drawNode(10, 0, mod, 'W')}
            {drawLine(25, 38, 43, 30)}
            {drawLine(57, 30, 75, 38)}
            {drawLine(20, 18, 30, 35)}
          </>
        );
      case 'model8':
        return svgWrapper(
          <>
            {drawNode(10, 40, iv, 'X')}
            {drawNode(70, 40, dv, 'Y')}
            {drawNode(40, 20, med, 'M')}
            {drawNode(40, 0, mod, 'W')}
            {drawLine(32, 48, 68, 48)}
            {drawLine(25, 38, 43, 30)}
            {drawLine(57, 30, 75, 38)}
            {drawLine(34, 18, 25, 38)}
            {drawLine(50, 18, 50, 48)}
          </>
        );
      case 'model14':
        return svgWrapper(
          <>
            {drawNode(10, 40, iv, 'X')}
            {drawNode(70, 40, dv, 'Y')}
            {drawNode(40, 20, med, 'M')}
            {drawNode(70, 0, mod, 'W')}
            {drawLine(25, 38, 43, 30)}
            {drawLine(57, 30, 75, 38)}
            {drawLine(80, 18, 70, 35)}
          </>
        );
      case 'model58':
        return svgWrapper(
          <>
            {drawNode(10, 40, iv, 'X')}
            {drawNode(70, 40, dv, 'Y')}
            {drawNode(40, 20, med, 'M')}
            {drawNode(40, 0, mod, 'W')}
            {drawLine(25, 38, 43, 30)}
            {drawLine(57, 30, 75, 38)}
            {drawLine(34, 18, 25, 38)}
            {drawLine(66, 18, 75, 38)}
          </>
        );
      case 'empty':
      default:
        return <LayoutTemplate size={32} color="var(--text-muted)" />;
    }
  };

  const applyTemplate = (templateId: string) => {
    const iv = mappedVars.iv?.[0];
    const dv = mappedVars.dv?.[0];
    const med1 = mappedVars.med?.[0];
    const med2 = mappedVars.med?.[1];
    const mod1 = mappedVars.mod?.[0];
    const mod2 = mappedVars.mod?.[1];

    let newNodes: any[] = [];
    let newEdges: any[] = [];

    // Helper to create node
    const createNode = (v: any, x: number, y: number, type: string) => ({
      id: v.id, type: 'customVariable', position: { x, y }, data: { label: v.name, varType: type, isGroup: false }
    });
    // Helper to create edge
    const createEdge = (source: string, target: string, type: string = 'custom') => ({
      id: `e-${source}-${target}`, source, target, type
    });
    // Helper to create junction node and edges
    const createJunction = (modId: string, source: string, target: string, jx: number, jy: number, jId: string) => {
      newNodes.push({ id: jId, position: { x: jx, y: jy }, data: { label: '', isJunction: true }, type: 'junction' });
      newEdges.push(createEdge(source, jId, 'custom'));
      newEdges.push(createEdge(jId, target, 'custom'));
      newEdges.push(createEdge(modId, jId, 'moderator'));
    };

    if (templateId === 'empty') {
      // Just lay them out
      let yOffset = 100;
      ['iv', 'dv', 'med', 'mod'].forEach(type => {
        (mappedVars[type as keyof typeof mappedVars] || []).forEach((v, idx) => {
          newNodes.push(createNode(v, 100 + (idx * 150), yOffset, type));
        });
        yOffset += 100;
      });
    } else if (templateId === 'model1' && iv && dv && mod1) {
      newNodes.push(createNode(iv, 100, 250, 'iv'));
      newNodes.push(createNode(dv, 800, 250, 'dv'));
      newNodes.push(createNode(mod1, 450, 100, 'mod'));
      createJunction(mod1.id, iv.id, dv.id, 450, 250, 'j-iv-dv');
    } else if (templateId === 'model4' && iv && dv && med1) {
      newNodes.push(createNode(iv, 100, 250, 'iv'));
      newNodes.push(createNode(med1, 450, 100, 'med'));
      newNodes.push(createNode(dv, 800, 250, 'dv'));
      newEdges.push(createEdge(iv.id, med1.id));
      newEdges.push(createEdge(med1.id, dv.id));
      newEdges.push(createEdge(iv.id, dv.id));
    } else if (templateId === 'model6' && iv && dv && med1 && med2) {
      newNodes.push(createNode(iv, 100, 250, 'iv'));
      newNodes.push(createNode(med1, 350, 100, 'med'));
      newNodes.push(createNode(med2, 550, 100, 'med'));
      newNodes.push(createNode(dv, 800, 250, 'dv'));
      newEdges.push(createEdge(iv.id, med1.id));
      newEdges.push(createEdge(med1.id, med2.id));
      newEdges.push(createEdge(med2.id, dv.id));
      newEdges.push(createEdge(iv.id, dv.id));
    } else if (templateId === 'model7' && iv && dv && med1 && mod1) {
      newNodes.push(createNode(iv, 100, 250, 'iv'));
      newNodes.push(createNode(med1, 450, 250, 'med'));
      newNodes.push(createNode(dv, 800, 250, 'dv'));
      newNodes.push(createNode(mod1, 275, 100, 'mod'));
      createJunction(mod1.id, iv.id, med1.id, 275, 250, 'j-iv-med');
      newEdges.push(createEdge(med1.id, dv.id));
    } else if (templateId === 'model8' && iv && dv && med1 && mod1) {
      newNodes.push(createNode(iv, 100, 250, 'iv'));
      newNodes.push(createNode(med1, 450, 250, 'med'));
      newNodes.push(createNode(dv, 800, 250, 'dv'));
      newNodes.push(createNode(mod1, 450, 100, 'mod'));
      createJunction(mod1.id, iv.id, med1.id, 275, 250, 'j-iv-med1');
      createJunction(mod1.id, iv.id, dv.id, 450, 400, 'j-iv-dv1');
      newEdges.push(createEdge(med1.id, dv.id));
    } else if (templateId === 'model14' && iv && dv && med1 && mod1) {
      newNodes.push(createNode(iv, 100, 250, 'iv'));
      newNodes.push(createNode(med1, 450, 250, 'med'));
      newNodes.push(createNode(dv, 800, 250, 'dv'));
      newNodes.push(createNode(mod1, 625, 100, 'mod'));
      newEdges.push(createEdge(iv.id, med1.id));
      createJunction(mod1.id, med1.id, dv.id, 625, 250, 'j-med-dv');
    } else if (templateId === 'model58' && iv && dv && med1 && mod1) {
      newNodes.push(createNode(iv, 100, 250, 'iv'));
      newNodes.push(createNode(med1, 450, 250, 'med'));
      newNodes.push(createNode(dv, 800, 250, 'dv'));
      newNodes.push(createNode(mod1, 450, 100, 'mod'));
      createJunction(mod1.id, iv.id, med1.id, 275, 250, 'j-iv-med2');
      createJunction(mod1.id, med1.id, dv.id, 625, 250, 'j-med-dv2');
    } else {
      alert("해당 템플릿을 구성할 변수(IV, DV, MED, MOD)가 충분하지 않거나 누락되었습니다.");
      return;
    }

    setNodes(newNodes);
    setEdges(newEdges);
    setShowTemplateModal(false);
  };

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

  const handleFinalizeModel = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/hypotheses/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges })
      });
      if (!response.ok) {
        throw new Error('Failed to generate hypotheses');
      }
      const hypos = await response.json();
      setGeneratedHypotheses(hypos);
      setShowHypotheses(true);
    } catch (e) {
      console.error(e);
      alert('가설 추출 중 오류가 발생했습니다.');
    }
  };

  const handleCopyToClipboard = () => {
    const text = generatedHypotheses.map((h, i) => `가설 ${i + 1}. ${h.text}`).join('\n');
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
            * 점(원)을 끌어 선을 잇고, <b>선의 [+] 버튼</b>을 눌러 조절점을 만드세요. 선 더블클릭 시 <b>라벨 입력</b>.<br />
            * <b>노드를 클릭</b>하면 나타나는 테두리를 드래그하여 <b>박스 크기를 조절</b>할 수 있습니다.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-outline" onClick={() => setShowTemplateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}>
            <LayoutTemplate size={18} /> 모형 템플릿 선택
          </button>
          <button className="btn-primary" onClick={handleFinalizeModel} style={{ backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={18} /> 모형 확정 (가설 생성) ▶
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
        {/* 좌측 사이드바: 매핑 변수 트리 */}
        <div className="glass-panel" style={{ width: '240px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', minHeight: 0, borderRadius: 0, border: 'none' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 className="text-h3">선택된 변수 목록</h2>
            <p className="text-small" style={{ marginTop: '4px' }}>캔버스 구성에 활용되는 변수</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {['iv', 'dv', 'med', 'mod'].map((type) => {
              const vars = mappedVars[type as keyof typeof mappedVars] || [];
              if (vars.length === 0) return null;
              
              let typeName = '';
              let typeColor = '';
              if (type === 'iv') { typeName = '독립변수'; typeColor = 'var(--var-iv)'; }
              else if (type === 'dv') { typeName = '종속변수'; typeColor = 'var(--var-dv)'; }
              else if (type === 'med') { typeName = '매개변수'; typeColor = 'var(--var-med)'; }
              else if (type === 'mod') { typeName = '조절변수'; typeColor = 'var(--var-mod)'; }

              return (
                <div key={type} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: typeColor, marginBottom: '8px' }}>
                    {typeName}
                  </div>
                  {vars.map(v => (
                    <div key={v.id} style={{ marginBottom: '8px', paddingLeft: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: typeColor }} />
                        {v.name}
                      </div>
                      {/* 하위 요인 트리 */}
                      {v.subFactors && v.subFactors.length > 0 && (
                        <div style={{ marginLeft: '12px', borderLeft: '1px solid var(--border-light)', paddingLeft: '8px', marginTop: '4px' }}>
                          {v.subFactors.map(sf => (
                            <div key={sf.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              <Layers size={10} />
                              <span>{sf.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* 캔버스 영역 */}
        <div style={{ flex: 1, backgroundColor: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
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
                        <strong>가설 {i + 1}.</strong> {h.text}
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


      {/* 템플릿 모달 */}
      {showTemplateModal && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg-base)', width: '800px', borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
            maxHeight: '90vh'
          }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-panel)' }}>
              <div>
                <h2 className="text-h2" style={{ margin: 0 }}>Process Macro 모형 템플릿 선택</h2>
                <p className="text-small" style={{ margin: '4px 0 0 0' }}>선택 시 캔버스에 선과 조절점이 자동으로 그려집니다.</p>
              </div>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ margin: '20px 24px 0', padding: '16px', background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>💡 변수 대입 및 분석 방법</h4>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <li><strong>자동 대입 원리</strong>: 이전 단계(변수 매핑)에서 그룹화해둔 독립변수, 종속변수, 매개/조절변수들이 선택한 모형 구조에 맞춰 <strong>자동으로 캔버스에 배치</strong>됩니다.</li>
                  <li><strong>분석 진행</strong>: 템플릿을 고른 후 우측 상단의 초록색 <strong>[모형 확정 (가설 생성)]</strong> 버튼을 누르면 이 모형을 기반으로 가설이 만들어지고 검증 단계로 넘어갑니다.</li>
                </ul>
              </div>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              {[
                { id: 'empty', name: '빈 캔버스', desc: '자유롭게 그리기' },
                { id: 'model1', name: 'Model 1', desc: '단순 조절효과' },
                { id: 'model4', name: 'Model 4', desc: '단순 매개효과' },
                { id: 'model6', name: 'Model 6', desc: '이중 매개 (직렬)' },
                { id: 'model7', name: 'Model 7', desc: '전반부 조절된 매개' },
                { id: 'model8', name: 'Model 8', desc: '전반/직접 조절' },
                { id: 'model14', name: 'Model 14', desc: '후반부 조절된 매개' },
                { id: 'model58', name: 'Model 58', desc: '전/후반 조절된 매개' }
              ].map(t => (
                <div 
                  key={t.id} 
                  onClick={() => applyTemplate(t.id)}
                  style={{ 
                    border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', 
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    background: 'var(--bg-surface)', transition: 'all 0.2s', gap: '12px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div style={{ width: '100%', height: '80px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderThumbnail(t.id)}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '4px' }}>{t.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
