from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.hypothesis_service import generate_hypotheses_from_graph

router = APIRouter(prefix="/api/hypotheses", tags=["hypotheses"])

class GraphData(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

class HypothesisResponse(BaseModel):
    type: str
    text: str

@router.post("/generate", response_model=List[HypothesisResponse])
async def generate_hypotheses(data: GraphData):
    try:
        hypotheses = generate_hypotheses_from_graph(data.nodes, data.edges)
        return hypotheses
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
