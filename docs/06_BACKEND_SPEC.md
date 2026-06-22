# 백엔드 명세

> 본 문서는 Python + FastAPI 기반 백엔드의 모듈 구성, 설계 원칙, 핵심 구현 사항을 정의한다.

---

## 1. 모듈 구조

### 1.1 전체 모듈 맵

```
backend/
└─ app/
   ├─ main.py                     # FastAPI 앱 진입점
   ├─ core/                       # 핵심 설정
   │  ├─ config.py                # 환경변수, 설정값
   │  ├─ security.py              # JWT, 비밀번호 해싱
   │  ├─ database.py              # DB 연결 (SQLAlchemy async)
   │  ├─ redis.py                 # Redis 연결
   │  ├─ dependencies.py          # FastAPI 의존성 주입
   │  └─ exceptions.py            # 커스텀 예외 정의
   │
   ├─ api/                        # HTTP 라우터 (Controller 역할)
   │  ├─ v1/
   │  │  ├─ auth.py
   │  │  ├─ projects.py
   │  │  ├─ files.py
   │  │  ├─ datasets.py
   │  │  ├─ variables.py
   │  │  ├─ models.py
   │  │  ├─ factor_analysis.py
   │  │  ├─ reliability.py
   │  │  ├─ correlation.py
   │  │  ├─ t_test.py
   │  │  ├─ anova.py
   │  │  ├─ regression.py
   │  │  ├─ mediation.py
   │  │  ├─ moderation.py
   │  │  ├─ interpretation.py
   │  │  └─ export.py
   │  └─ router.py                # 라우터 통합
   │
   ├─ ws/                         # WebSocket 엔드포인트
   │  ├─ manager.py               # WebSocket 연결 관리자
   │  └─ analysis.py              # 분석 진행률/결과 스트리밍
   │
   ├─ domain/                     # 도메인 모델 (SQLAlchemy ORM)
   │  ├─ user.py
   │  ├─ project.py
   │  ├─ uploaded_file.py
   │  ├─ dataset.py
   │  ├─ variable.py
   │  ├─ variable_group.py
   │  ├─ factor.py                # 4단계: 요인
   │  ├─ factor_item.py           # 4단계: 요인 측정항목
   │  ├─ research_model_node.py
   │  ├─ research_model_edge.py
   │  ├─ analysis_job.py
   │  ├─ analysis_result.py
   │  ├─ interpretation.py
   │  └─ export_history.py
   │
   ├─ schemas/                    # Pydantic DTO (요청/응답)
   │  ├─ auth.py
   │  ├─ project.py
   │  ├─ file.py
   │  ├─ dataset.py
   │  ├─ variable.py
   │  ├─ model.py
   │  ├─ analysis.py
   │  └─ export.py
   │
   ├─ services/                   # 비즈니스 로직 (Service Layer)
   │  ├─ auth_service.py
   │  ├─ project_service.py
   │  ├─ file_service.py
   │  ├─ dataset_service.py
   │  ├─ variable_service.py
   │  ├─ model_service.py
   │  ├─ analysis_service.py      # 분석 요청 조율
   │  ├─ interpretation_service.py
   │  └─ export_service.py
   │
   ├─ repositories/               # 데이터 접근 (Repository Layer)
   │  ├─ base.py                  # 기본 CRUD
   │  ├─ user_repo.py
   │  ├─ project_repo.py
   │  ├─ dataset_repo.py
   │  ├─ variable_repo.py
   │  ├─ model_repo.py
   │  ├─ analysis_repo.py
   │  └─ export_repo.py
   │
   ├─ analysis/                   # 통계 분석 엔진 (순수 Python)
   │  ├─ __init__.py
   │  ├─ base.py                  # 분석기 기본 인터페이스
   │  ├─ cleansing/
   │  │  ├─ __init__.py
   │  │  ├─ missing_handler.py    # 결측치 처리
   │  │  ├─ outlier_detector.py   # 이상치 탐지
   │  │  ├─ reverse_coding.py     # 역코딩
   │  │  └─ validator.py          # 데이터 검증
   │  ├─ frequency/
   │  │  ├─ __init__.py
   │  │  └─ frequency_analyzer.py # 빈도분석, 교차분석
   │  ├─ factor/
   │  │  ├─ __init__.py
   │  │  ├─ efa_analyzer.py       # 탐색적 요인분석
   │  │  ├─ pca_analyzer.py       # 주성분분석
   │  │  ├─ kmo_bartlett.py       # KMO/Bartlett 검정
   │  │  └─ auto_refiner.py       # 자동 정리 알고리즘
   │  ├─ reliability/
   │  │  ├─ __init__.py
   │  │  └─ cronbach.py           # Cronbach's α
   │  ├─ correlation/
   │  │  ├─ __init__.py
   │  │  └─ correlation.py        # Pearson/Spearman
   │  ├─ t_test/
   │  │  ├─ __init__.py
   │  │  └─ independent_t.py      # 독립표본 T검정
   │  ├─ anova/
   │  │  ├─ __init__.py
   │  │  ├─ one_way.py            # 일원분산분석
   │  │  └─ post_hoc.py           # 사후검정
   │  ├─ regression/
   │  │  ├─ __init__.py
   │  │  └─ multiple_ols.py       # 다중회귀 (OLS)
   │  ├─ mediation/
   │  │  ├─ __init__.py
   │  │  ├─ baron_kenny.py        # Baron & Kenny 3단계
   │  │  ├─ sobel_test.py         # Sobel 검정
   │  │  └─ bootstrap.py          # Bootstrap 간접효과
   │  ├─ moderation/
   │  │  ├─ __init__.py
   │  │  ├─ interaction.py        # 상호작용항 분석
   │  │  └─ simple_slope.py       # 단순 기울기 분석
   │  ├─ process_model/
   │  │  ├─ __init__.py
   │  │  ├─ detector.py           # Model 자동 판별
   │  │  ├─ model4.py             # 단순 매개
   │  │  ├─ model7.py             # 조절된 매개 (1단계)
   │  │  ├─ model14.py            # 조절된 매개 (2단계)
   │  │  └─ model8.py             # 양단계 조절된 매개
   │  └─ report/
   │     ├─ __init__.py
   │     ├─ word_generator.py     # Word 보고서
   │     └─ excel_generator.py    # Excel 보고서
   │
   ├─ integrations/               # 외부 서비스 연동
   │  ├─ ai/
   │  │  ├─ base.py               # AI 클라이언트 인터페이스
   │  │  ├─ gemini_client.py      # Gemini API
   │  │  └─ claude_client.py      # Claude API
   │  └─ __init__.py
   │
   ├─ tasks/                      # Celery 비동기 태스크
   │  ├─ __init__.py
   │  ├─ celery_app.py            # Celery 앱 설정
   │  ├─ analysis_tasks.py        # 분석 실행 태스크
   │  └─ export_tasks.py          # 보고서 생성 태스크
   │
   └─ tests/                      # 테스트
      ├─ unit/
      │  ├─ analysis/             # 분석 함수 단위 테스트
      │  ├─ services/             # 서비스 단위 테스트
      │  └─ repositories/         # 리포지토리 단위 테스트
      ├─ integration/
      │  └─ api/                  # API 통합 테스트
      └─ conftest.py              # 테스트 설정
```

---

## 2. 설계 원칙

### 2.1 레이어 분리 (SOLID 준수)

```
[API Layer]          ← HTTP 요청/응답 처리만. 비즈니스 로직 없음
     │
     ▼
[Service Layer]      ← 비즈니스 로직. 분석 조율, 트랜잭션 관리
     │
     ├──────────────→ [Analysis Engine]  ← 순수 Python. HTTP/DB 의존성 없음
     │
     ▼
[Repository Layer]   ← DB 접근만. SQL 쿼리, ORM 조작
     │
     ▼
[Domain Layer]       ← 엔티티 정의. 순수 데이터 모델
```

### 2.2 핵심 원칙

| 원칙 | 적용 |
|---|---|
| **단일 책임 (SRP)** | API 라우터는 요청 처리만, Service는 비즈니스 로직만, Analysis는 통계 계산만 |
| **개방-폐쇄 (OCP)** | 새 분석 추가 시 기존 코드 수정 없이 새 모듈만 추가 |
| **의존성 역전 (DIP)** | Analysis 엔진은 인터페이스에 의존, DB/HTTP 구현에 의존하지 않음 |
| **인터페이스 분리 (ISP)** | AI 클라이언트는 공통 인터페이스, Gemini/Claude 각각 구현 |
| **리스코프 치환 (LSP)** | 모든 분석기는 BaseAnalyzer 인터페이스를 구현 |

### 2.3 분석 엔진 설계 원칙

```python
# analysis/base.py — 모든 분석기의 기본 인터페이스
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict

@dataclass
class AnalysisInput:
    """분석 입력 데이터 (순수 데이터, DB 의존 없음)"""
    data: Any  # pandas DataFrame
    options: Dict[str, Any]

@dataclass
class AnalysisOutput:
    """분석 결과 (순수 데이터)"""
    success: bool
    result: Dict[str, Any]
    warnings: list[str]
    errors: list[str]

class BaseAnalyzer(ABC):
    """모든 분석기의 기본 인터페이스"""
    
    @abstractmethod
    def validate(self, input: AnalysisInput) -> list[str]:
        """입력 데이터 검증"""
        ...
    
    @abstractmethod
    def analyze(self, input: AnalysisInput) -> AnalysisOutput:
        """분석 실행"""
        ...
```

---

## 3. WebSocket 관리자

```python
# ws/manager.py
from typing import Dict
from fastapi import WebSocket

class WebSocketManager:
    """WebSocket 연결 관리"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, job_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[job_id] = websocket
    
    async def disconnect(self, job_id: str):
        if job_id in self.active_connections:
            del self.active_connections[job_id]
    
    async def send_progress(self, job_id: str, progress: int, message: str):
        if ws := self.active_connections.get(job_id):
            await ws.send_json({
                "type": "progress",
                "progress": progress,
                "message": message
            })
    
    async def send_result(self, job_id: str, result: dict):
        if ws := self.active_connections.get(job_id):
            await ws.send_json({
                "type": "result",
                "data": result
            })
    
    async def send_error(self, job_id: str, error: str):
        if ws := self.active_connections.get(job_id):
            await ws.send_json({
                "type": "error",
                "message": error
            })
```

---

## 4. Celery 태스크 설계

```python
# tasks/analysis_tasks.py
from celery import shared_task
from app.analysis.factor.efa_analyzer import EFAAnalyzer
from app.ws.manager import ws_manager

@shared_task(bind=True, max_retries=3)
def run_factor_analysis(self, job_id: str, dataset_id: str, options: dict):
    """요인분석 비동기 실행"""
    try:
        # 진행률 전송
        ws_manager.send_progress(job_id, 10, "데이터 로딩 중...")
        
        # 데이터 로드
        data = load_dataset(dataset_id)
        
        ws_manager.send_progress(job_id, 30, "KMO/Bartlett 검정 중...")
        
        # 분석 실행
        analyzer = EFAAnalyzer()
        input_data = AnalysisInput(data=data, options=options)
        result = analyzer.analyze(input_data)
        
        ws_manager.send_progress(job_id, 90, "결과 저장 중...")
        
        # 결과 저장
        save_analysis_result(job_id, result)
        
        # 완료 전송
        ws_manager.send_result(job_id, result.to_dict())
        
    except Exception as exc:
        ws_manager.send_error(job_id, str(exc))
        self.retry(exc=exc, countdown=5)
```

---

## 5. 인증 모듈

### 5.1 계정 생성 (관리자 CLI)

```python
# 관리자용 스크립트: 사용자 계정 생성
# python -m app.scripts.create_user --username admin --password secret123

async def create_user(username: str, password: str):
    hashed = hash_password(password)
    user = User(username=username, hashed_password=hashed)
    await user_repo.create(user)
    print(f"사용자 '{username}' 생성 완료")
```

### 5.2 로그인 흐름

```
POST /api/v1/auth/login
  Body: {"username": "admin", "password": "secret123"}
  Response: {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer"
  }
```

---

## 6. 파일 업로드 모듈

```python
# api/v1/files.py
@router.post("/upload")
async def upload_file(
    file: UploadFile,
    project_id: int,
    current_user: User = Depends(get_current_user)
):
    # 파일 검증
    validate_file_type(file, allowed=[".xlsx", ".xls", ".csv"])
    validate_file_size(file, max_mb=50)
    
    # 저장 경로: /data/uploads/{user_id}/{project_id}/{timestamp}_{filename}
    save_path = build_upload_path(current_user.id, project_id, file.filename)
    await save_file(file, save_path)
    
    # DB 기록
    uploaded_file = await file_service.register(
        project_id=project_id,
        filename=file.filename,
        path=save_path,
        size=file.size
    )
    
    return {"file_id": uploaded_file.id, "path": save_path}
```

---

## 7. 의존성 목록 (requirements.txt 예상)

```text
# Web Framework
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9

# Database
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.29.0
alembic>=1.13.0

# Auth
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4

# Analysis
pandas>=2.2.0
numpy>=1.26.0
scipy>=1.12.0
statsmodels>=0.14.0
scikit-learn>=1.4.0
factor-analyzer>=0.5.0
pingouin>=0.5.4
scikit-posthocs>=0.9.0

# Async Task
celery[redis]>=5.3.0
redis>=5.0.0

# Export
python-docx>=1.1.0
openpyxl>=3.1.0

# AI Integration
google-generativeai>=0.7.0
anthropic>=0.34.0

# Testing
pytest>=8.0.0
pytest-asyncio>=0.23.0
pytest-cov>=5.0.0
httpx>=0.27.0  # FastAPI 테스트 클라이언트

# Utils
pydantic>=2.6.0
pydantic-settings>=2.2.0
python-dotenv>=1.0.0
```
