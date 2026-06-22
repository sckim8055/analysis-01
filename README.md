# Analysis-01 (구조방정식 모형 빌더)

사용자가 데이터를 업로드하고, 변수를 매핑하며, 요인 분석(EFA)을 거쳐 구조방정식 모형(SEM)을 시각적으로 구성할 수 있게 돕는 데이터 기반 웹 애플리케이션입니다.

## 주요 파이프라인 흐름
1. **데이터 업로드**: CSV, Excel 파일 파싱 및 데이터셋 그리드 렌더링
2. **변수 매핑**: 독립변수, 종속변수, 매개/조절변수를 드래그 앤 드롭 방식으로 시각적 그룹핑
3. **요인분석 (EFA)**: 매핑된 변수들을 단일 풀로 묶어 요인 추출 및 직교 회전 (결측치 및 적재량 미달 항목 제거)
4. **모형 설정**: (예정) 추출된 요인을 바탕으로 가설 경로 및 구조방정식 모형 설정

## 실행 방법 (개발 환경)

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

### Backend (Python FastAPI)
```bash
cd backend
# 가상환경 진입 (Windows 기준)
venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
