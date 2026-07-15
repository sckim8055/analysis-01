import os
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import Dict, Any, Optional

try:
    from google import genai
except ImportError:
    genai = None

router = APIRouter()

client = None

def get_gemini_client():
    global client
    if client is not None:
        return client
    
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API key not configured on the server.")
    if genai is None:
        raise HTTPException(status_code=500, detail="google-genai package is not installed.")
    
    try:
        client = genai.Client(api_key=api_key)
        return client
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize Gemini client: {e}")

class AIInterpretRequest(BaseModel):
    analysis_type: str
    results: Dict[str, Any]
    prompt_context: Optional[str] = None

@router.post("/interpret")
async def interpret_results(req: AIInterpretRequest):
    c = get_gemini_client()
        
    system_prompt = """
    당신은 한국 사회과학 논문의 최고 수준 통계 분석 전문가이자 학술 논문 작성가입니다.
    사용자가 통계 분석 결과 수치를 제공하면, APA 7판 기준 및 한국 학술 논문 관행에 맞는 고급스러운 학술 논문체로 해석문을 작성해주세요.
    
    작성 규칙:
    1. '~다', '~음/함'으로 끝나는 건조하고 학술적인 문체를 사용하세요.
    2. 불필요한 서론(안녕하세요, 분석 결과는 다음과 같습니다 등)은 생략하고 곧바로 본문 텍스트만 출력하세요.
    3. 수치는 소수점 셋째 자리까지 표기하는 것을 원칙으로 하되, p값이 0.000으로 나오는 경우 p<.001로 표기하세요. (유의확률 p의 경우 소수점 앞 0은 생략 예: p=.031)
    4. 분석의 배경, 검증 목적, 해석 결과, 연구의 실무적/이론적 함의를 논리적으로 연결하여 완성된 문단으로 구성하세요.
    5. 절대로 마크다운(표, 코드 블록, 별표 등)을 사용하지 마시고, 복사해서 워드에 바로 붙여넣기 좋은 순수 텍스트(Plain Text)로 작성하세요. 기호는 <표 4-1>, χ² 등 일반적인 텍스트 기호만 사용하세요.
    """
    
    prompt = f"분석 종류: {req.analysis_type}\n"
    if req.prompt_context:
        prompt += f"추가 맥락: {req.prompt_context}\n"
    prompt += f"통계 결과 데이터 JSON:\n{req.results}\n\n위 데이터를 바탕으로 완벽한 학술 논문체 해석문(결론 및 시사점 포함)을 작성해주세요."

    try:
        response = c.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.3,
            )
        )
        return {"interpretation": response.text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI 생성 중 오류가 발생했습니다: {str(e)}")
