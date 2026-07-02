import networkx as nx
from typing import List, Dict, Any

def generate_hypotheses_from_graph(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    """
    Generate hypotheses based on the provided React Flow nodes and edges using NetworkX.
    Nodes are expected to be the sub-factor nodes connected by edges.
    """
    G = nx.DiGraph()
    hypotheses = []
    
    # 1. Build the graph
    node_labels = {}
    for n in nodes:
        node_id = n.get("id")
        if not node_id:
            continue
        # Only process variable nodes and junction nodes
        node_type = n.get("type")
        if node_type not in ["subFactorNode", "customVariable", "junction"]:
            continue
            
        label = n.get("data", {}).get("label", "알 수 없는 변수")
        var_type = n.get("data", {}).get("varType")
        
        G.add_node(node_id, label=label, type=node_type, varType=var_type)
        node_labels[node_id] = label
        
    for e in edges:
        source = e.get("source")
        target = e.get("target")
        if source and target and source in G.nodes and target in G.nodes:
            G.add_edge(source, target)
            
    # Check for cycles
    try:
        cycles = list(nx.simple_cycles(G))
        if cycles:
            hypotheses.append({
                "type": "오류",
                "text": "모형에 순환 오류(Cycle)가 있습니다. 화살표 방향을 확인해주세요."
            })
            return hypotheses
    except nx.NetworkXNotImplemented:
        pass
        
    # Extract Paths
    iv_nodes = [n for n, d in G.nodes(data=True) if d.get('varType') == 'iv']
    dv_nodes = [n for n, d in G.nodes(data=True) if d.get('varType') == 'dv']
    med_nodes = [n for n, d in G.nodes(data=True) if d.get('varType') == 'med']
    junctions = [n for n, d in G.nodes(data=True) if d.get('type') == 'junction']
    
    # 2. Main Effects (Direct paths between IV/Med and DV/Med without going through another Med)
    for u, v in G.edges():
        if G.nodes[u].get('type') != 'junction' and G.nodes[v].get('type') != 'junction':
            # Skip if source is mod (mods moderate relationships, not direct effects usually)
            if G.nodes[u].get('varType') != 'mod':
                hypotheses.append({
                    "type": "주효과",
                    "text": f"{node_labels[u]}은(는) {node_labels[v]}에 정(+)의 영향을 미칠 것이다."
                })
            
    # Junction (Moderation) resolution
    for j in junctions:
        incoming = list(G.predecessors(j))
        outgoing = list(G.successors(j))
        
        if incoming and outgoing:
            for src in incoming:
                for tgt in outgoing:
                    if G.nodes[src].get('varType') != 'mod':
                        hypotheses.append({
                            "type": "주효과",
                            "text": f"{node_labels[src]}은(는) {node_labels[tgt]}에 정(+)의 영향을 미칠 것이다."
                        })
                        
    # 3. Mediation Effects (Paths of length >= 2 through 'med' nodes)
    # Only IV -> Med -> DV, or IV -> Med1 -> Med2 -> DV
    for iv in iv_nodes:
        for dv in dv_nodes:
            # Find all simple paths from iv to dv
            if nx.has_path(G, iv, dv):
                paths = list(nx.all_simple_paths(G, iv, dv))
                for path in paths:
                    # A path is [iv, med1, med2, ..., dv]
                    # Exclude the direct path
                    if len(path) > 2:
                        # Extract the mediators in the path
                        path_meds = [n for n in path[1:-1] if G.nodes[n].get('type') != 'junction']
                        if path_meds:
                            med_labels = " 및 ".join([node_labels[m] for m in path_meds])
                            hypotheses.append({
                                "type": "매개효과",
                                "text": f"{med_labels}은(는) {node_labels[iv]}과(와) {node_labels[dv]} 사이의 관계를 매개할 것이다."
                            })
                            
    # 4. Moderation Effects
    mod_nodes = [n for n, d in G.nodes(data=True) if d.get('varType') == 'mod']
    for mod in mod_nodes:
        for succ in G.successors(mod):
            if G.nodes[succ].get('type') == 'junction':
                # The junction represents the relationship between some IV and some DV
                junction_preds = [p for p in G.predecessors(succ) if p != mod]
                junction_succs = list(G.successors(succ))
                for p in junction_preds:
                    for s in junction_succs:
                        # Check if it's a moderated mediation (if target is a mediator or source is a mediator)
                        if G.nodes[s].get('varType') == 'med' or G.nodes[p].get('varType') == 'med':
                            h_type = "조절된 매개효과"
                        else:
                            h_type = "조절효과"
                        
                        hypotheses.append({
                            "type": h_type,
                            "text": f"{node_labels[mod]}은(는) {node_labels[p]}과(와) {node_labels[s]} 간의 관계를 조절할 것이다."
                        })
            else:
                hypotheses.append({
                    "type": "조절효과",
                    "text": f"{node_labels[mod]}은(는) {node_labels[succ]}에 미치는 영향을 조절할 것이다."
                })

    # Remove duplicates
    unique_hypotheses = []
    seen = set()
    for h in hypotheses:
        key = (h["type"], h["text"])
        if key not in seen:
            seen.add(key)
            unique_hypotheses.append(h)
            
    return unique_hypotheses
