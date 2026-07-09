import networkx as nx
from typing import List, Dict, Any
import itertools

def generate_hypotheses_from_graph(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Generate hypotheses based on the provided React Flow nodes and edges using NetworkX.
    Nodes are expected to be the main variable nodes connected by edges, which contain subFactors in their data.
    Returns a hierarchical structure:
    [
      {
        "type": "주효과",
        "main_text": "A은(는) B에 정(+)의 영향을 미칠 것이다.",
        "sub_hypotheses": [ "A-1은(는) B-1에...", "A-2은(는) B-1에..." ]
      }
    ]
    """
    G = nx.DiGraph()
    hypotheses = []
    
    # Helper to extract sub-elements (sub-factors) from a node
    def get_elements(n_id: str) -> List[str]:
        node = G.nodes[n_id]
        data = node.get('original_data', {})
        sub_factors = data.get('subFactors', [])
        # If there are valid sub-factors, return their names
        if sub_factors and len(sub_factors) > 0:
            return [sf.get('name') for sf in sub_factors if sf.get('name')]
        # Otherwise fallback to the main node label
        return [node.get('label', '알 수 없는 변수')]

    # 1. Build the graph
    node_labels = {}
    for n in nodes:
        node_id = n.get("id")
        if not node_id:
            continue
        # Process variable nodes and junction nodes
        node_type = n.get("type")
        if node_type not in ["subFactorNode", "customVariable", "junction"]:
            continue
            
        data_payload = n.get("data", {})
        label = data_payload.get("label", "알 수 없는 변수")
        var_type = data_payload.get("varType")
        
        G.add_node(node_id, label=label, type=node_type, varType=var_type, original_data=data_payload)
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
                "main_text": "모형에 순환 오류(Cycle)가 있습니다. 화살표 방향을 확인해주세요.",
                "sub_hypotheses": []
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
            if G.nodes[u].get('varType') != 'mod':
                u_main = node_labels[u]
                v_main = node_labels[v]
                main_text = f"{u_main}은(는) {v_main}에 정(+)의 영향을 미칠 것이다."
                
                u_elems = get_elements(u)
                v_elems = get_elements(v)
                
                sub_hypotheses = []
                for u_e in u_elems:
                    for v_e in v_elems:
                        sub_text = f"{u_e}은(는) {v_e}에 정(+)의 영향을 미칠 것이다."
                        if sub_text != main_text:
                            sub_hypotheses.append(sub_text)
                            
                hypotheses.append({
                    "type": "주효과",
                    "main_text": main_text,
                    "sub_hypotheses": sub_hypotheses
                })
            
    # Junction (Moderation) resolution for Main Effects
    for j in junctions:
        incoming = list(G.predecessors(j))
        outgoing = list(G.successors(j))
        
        if incoming and outgoing:
            for src in incoming:
                for tgt in outgoing:
                    if G.nodes[src].get('varType') != 'mod':
                        u_main = node_labels[src]
                        v_main = node_labels[tgt]
                        main_text = f"{u_main}은(는) {v_main}에 정(+)의 영향을 미칠 것이다."
                        
                        u_elems = get_elements(src)
                        v_elems = get_elements(tgt)
                        
                        sub_hypotheses = []
                        for u_e in u_elems:
                            for v_e in v_elems:
                                sub_text = f"{u_e}은(는) {v_e}에 정(+)의 영향을 미칠 것이다."
                                if sub_text != main_text:
                                    sub_hypotheses.append(sub_text)
                                    
                        hypotheses.append({
                            "type": "주효과",
                            "main_text": main_text,
                            "sub_hypotheses": sub_hypotheses
                        })
                        
    # 3. Mediation Effects (Paths of length >= 2 through 'med' nodes)
    for iv in iv_nodes:
        for dv in dv_nodes:
            if nx.has_path(G, iv, dv):
                paths = list(nx.all_simple_paths(G, iv, dv))
                for path in paths:
                    if len(path) > 2:
                        path_meds = [n for n in path[1:-1] if G.nodes[n].get('type') != 'junction']
                        if path_meds:
                            iv_main = node_labels[iv]
                            dv_main = node_labels[dv]
                            med_main_labels = " 및 ".join([node_labels[m] for m in path_meds])
                            main_text = f"{med_main_labels}은(는) {iv_main}과(와) {dv_main} 사이의 관계를 매개할 것이다."
                            
                            iv_elems = get_elements(iv)
                            dv_elems = get_elements(dv)
                            meds_elems_lists = [get_elements(m) for m in path_meds]
                            
                            sub_hypotheses = []
                            for iv_e in iv_elems:
                                for dv_e in dv_elems:
                                    for meds_combo in itertools.product(*meds_elems_lists):
                                        med_labels = " 및 ".join(meds_combo)
                                        sub_text = f"{med_labels}은(는) {iv_e}과(와) {dv_e} 사이의 관계를 매개할 것이다."
                                        if sub_text != main_text:
                                            sub_hypotheses.append(sub_text)
                                            
                            hypotheses.append({
                                "type": "매개효과",
                                "main_text": main_text,
                                "sub_hypotheses": sub_hypotheses
                            })
                            
    # 4. Moderation Effects
    mod_nodes = [n for n, d in G.nodes(data=True) if d.get('varType') == 'mod']
    for mod in mod_nodes:
        for succ in G.successors(mod):
            if G.nodes[succ].get('type') == 'junction':
                junction_preds = [p for p in G.predecessors(succ) if p != mod]
                junction_succs = list(G.successors(succ))
                for p in junction_preds:
                    for s in junction_succs:
                        if G.nodes[s].get('varType') == 'med' or G.nodes[p].get('varType') == 'med':
                            h_type = "조절된 매개효과"
                        else:
                            h_type = "조절효과"
                        
                        m_main = node_labels[mod]
                        p_main = node_labels[p]
                        s_main = node_labels[s]
                        main_text = f"{m_main}은(는) {p_main}과(와) {s_main} 간의 관계를 조절할 것이다."
                        
                        mod_elems = get_elements(mod)
                        p_elems = get_elements(p)
                        s_elems = get_elements(s)
                        
                        sub_hypotheses = []
                        for m_e in mod_elems:
                            for p_e in p_elems:
                                for s_e in s_elems:
                                    sub_text = f"{m_e}은(는) {p_e}과(와) {s_e} 간의 관계를 조절할 것이다."
                                    if sub_text != main_text:
                                        sub_hypotheses.append(sub_text)
                                        
                        hypotheses.append({
                            "type": h_type,
                            "main_text": main_text,
                            "sub_hypotheses": sub_hypotheses
                        })
            else:
                m_main = node_labels[mod]
                s_main = node_labels[succ]
                main_text = f"{m_main}은(는) {s_main}에 미치는 영향을 조절할 것이다."
                
                mod_elems = get_elements(mod)
                succ_elems = get_elements(succ)
                
                sub_hypotheses = []
                for m_e in mod_elems:
                    for s_e in succ_elems:
                        sub_text = f"{m_e}은(는) {s_e}에 미치는 영향을 조절할 것이다."
                        if sub_text != main_text:
                            sub_hypotheses.append(sub_text)
                            
                hypotheses.append({
                    "type": "조절효과",
                    "main_text": main_text,
                    "sub_hypotheses": sub_hypotheses
                })

    # Remove duplicates based on type and main_text, merging sub_hypotheses
    merged_hypotheses = {}
    for h in hypotheses:
        key = (h["type"], h["main_text"])
        if key not in merged_hypotheses:
            merged_hypotheses[key] = {
                "type": h["type"],
                "main_text": h["main_text"],
                "sub_hypotheses": list(h["sub_hypotheses"])
            }
        else:
            for sub in h["sub_hypotheses"]:
                if sub not in merged_hypotheses[key]["sub_hypotheses"]:
                    merged_hypotheses[key]["sub_hypotheses"].append(sub)
                    
    return list(merged_hypotheses.values())
