import type { Edge, Node } from 'reactflow';

export interface Hypothesis {
  type: '주효과' | '매개효과' | '조절효과' | '조절된 매개효과' | '오류';
  main_text: string;
  sub_hypotheses: string[];
}

export const generateHypotheses = (nodes: Node[], edges: Edge[]): Hypothesis[] => {
  const hypotheses: Hypothesis[] = [];
  
  const getLabels = (id: string): string[] => {
    const node = nodes.find(n => n.id === id);
    if (!node) return ['알 수 없는 변수'];
    if (node.data?.subFactors && node.data.subFactors.length > 0) {
      // 부모 이름과 하위 요인 이름을 함께 표시하려면 아래와 같이 변경 가능
      // return node.data.subFactors.map((sf: any) => `${node.data.label}의 ${sf.name}`);
      return node.data.subFactors.map((sf: any) => sf.name);
    }
    return [node.data?.label || '알 수 없는 변수'];
  };

  const isVariableNode = (id: string) => nodes.find(n => n.id === id)?.type === 'customVariable';

  // --- 1. 논리적 경로(Logical Paths) 추출 ---
  interface LogicalPath {
    source: string;
    target: string;
    junctionId?: string;
  }

  const logicalPaths: LogicalPath[] = [];

  // 단순 연결 선 (Var -> Var)
  edges.forEach(e => {
    if (isVariableNode(e.source) && isVariableNode(e.target)) {
      logicalPaths.push({ source: e.source, target: e.target });
    }
  });

  // 조절점(Junction)을 거치는 쪼개진 선 (Var -> Junction -> Var)
  const junctions = nodes.filter(n => n.type === 'junction');
  junctions.forEach(j => {
    const pathIn = edges.find(e => e.target === j.id && isVariableNode(e.source));
    const pathOut = edges.find(e => e.source === j.id && isVariableNode(e.target));
    if (pathIn && pathOut) {
      logicalPaths.push({
        source: pathIn.source,
        target: pathOut.target,
        junctionId: j.id
      });
    }
  });

  // --- 2. 주효과(Main Effects) 가설 ---
  logicalPaths.forEach(path => {
    const sLabels = getLabels(path.source);
    const tLabels = getLabels(path.target);
    
    sLabels.forEach(sLabel => {
      tLabels.forEach(tLabel => {
        hypotheses.push({
          type: '주효과',
          main_text: `${sLabel}은(는) ${tLabel}에 정(+)의 영향을 미칠 것이다.`,
          sub_hypotheses: []
        });
      });
    });
  });

  // --- 3. 매개효과(Mediation Effects) 가설 ---
  const mediators = nodes.filter(n => n.data?.varType === 'med');
  const mediationPaths: { iv: string, med: string, dv: string }[] = [];

  mediators.forEach(med => {
    const incomingPaths = logicalPaths.filter(p => p.target === med.id);
    const outgoingPaths = logicalPaths.filter(p => p.source === med.id);

    incomingPaths.forEach(inPath => {
      outgoingPaths.forEach(outPath => {
        mediationPaths.push({ iv: inPath.source, med: med.id, dv: outPath.target });

        const ivLabels = getLabels(inPath.source);
        const medLabels = getLabels(med.id);
        const dvLabels = getLabels(outPath.target);
        
        ivLabels.forEach(ivLabel => {
          medLabels.forEach(medLabel => {
            dvLabels.forEach(dvLabel => {
              hypotheses.push({
                type: '매개효과',
                main_text: `${medLabel}은(는) ${ivLabel}과(와) ${dvLabel} 사이의 관계를 매개할 것이다.`,
                sub_hypotheses: []
              });
            });
          });
        });
      });
    });
  });

  // --- 4. 조절효과 & 조절된 매개효과 가설 ---
  const modEdges = edges.filter(e => {
    const targetIsJunction = nodes.find(n => n.id === e.target)?.type === 'junction';
    const sourceNode = nodes.find(n => n.id === e.source);
    const isModVariable = sourceNode?.type === 'customVariable' && sourceNode?.data?.varType === 'mod';
    return isModVariable && targetIsJunction;
  });
  
  modEdges.forEach(modE => {
    const junctionId = modE.target;
    const targetPath = logicalPaths.find(p => p.junctionId === junctionId);

    if (targetPath) {
      if (modE.source === targetPath.source) return;

      const modLabels = getLabels(modE.source);
      const sourceLabels = getLabels(targetPath.source);
      const targetLabels = getLabels(targetPath.target);

      const isPartOfMediation = mediationPaths.some(p => 
        (p.iv === targetPath.source && p.med === targetPath.target) || 
        (p.med === targetPath.source && p.dv === targetPath.target)
      );

      modLabels.forEach(modLabel => {
        sourceLabels.forEach(sourceLabel => {
          targetLabels.forEach(targetLabel => {
            if (isPartOfMediation) {
              hypotheses.push({
                type: '조절된 매개효과',
                main_text: `${modLabel}은(는) ${sourceLabel}이(가) ${targetLabel}에 미치는 영향을 조절함으로써, 전체적인 매개효과의 크기를 조절할 것이다.`,
                sub_hypotheses: []
              });
            } else {
              hypotheses.push({
                type: '조절효과',
                main_text: `${modLabel}은(는) ${sourceLabel}이(가) ${targetLabel}에 미치는 영향을 조절할 것이다.`,
                sub_hypotheses: []
              });
            }
          });
        });
      });
    }
  });

  return hypotheses;
};
