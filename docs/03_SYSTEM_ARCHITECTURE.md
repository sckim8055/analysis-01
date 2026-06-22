# 시스템 아키텍처

> 본 문서는 박사논문용 웹 기반 통계분석 솔루션의 전체 시스템 아키텍처를 정의한다.

---

## 1. 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                        사용자 (브라우저)                          │
│                     React (Vite) SPA                            │
└──────────┬──────────────────┬───────────────────────────────────┘
           │ REST API (HTTP)  │ WebSocket
           ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI (Python)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Auth API │  │ Data API │  │ Model API│  │ Analysis API   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────┬────────┘  │
│                                                     │           │
│  ┌──────────────────────────────────────────────────┘           │
│  │ WebSocket Manager (실시간 진행률/결과 전송)                    │
│  └──────────┬───────────────────────────────────────────────────┘
│             │
│  ┌──────────▼──────────────────────────────────────┐
│  │           Celery Worker (비동기 분석 처리)         │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │  │Factor│ │Reliab│ │Correl│ │T-test│ │ANOVA │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐           │
│  │  │Regres│ │Media │ │Moder │ │Report│           │
│  │  └──────┘ └──────┘ └──────┘ └──────┘           │
│  └─────────────────────────────────────────────────┘
│             │                │                │
│  ┌──────────▼─┐  ┌──────────▼─┐  ┌───────────▼──┐
│  │ PostgreSQL │  │   Redis    │  │ File Storage │
│  │ (데이터/결과)│  │ (큐/캐시)  │  │ (업로드 파일) │
│  └────────────┘  └────────────┘  └──────────────┘
│
│  ┌──────────────────────────────┐
│  │    AI Integration Layer      │
│  │  ┌────────┐  ┌───────────┐  │
│  │  │ Gemini │  │  Claude   │  │
│  │  └────────┘  └───────────┘  │
│  └──────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 레이어 구조

### 2.1 Frontend Layer

| 항목 | 기술 |
|---|---|
| 프레임워크 | React 18+ (Vite) |
| 상태 관리 | Zustand 또는 Redux Toolkit |
| HTTP 클라이언트 | Axios |
| WebSocket | 네이티브 WebSocket API |
| 차트/시각화 | Recharts 또는 Chart.js |
| 모형 빌더 | React Flow (Drag & Drop 노드 그래프) |
| 스타일링 | CSS Modules 또는 styled-components |
| 라우팅 | React Router v6 |

### 2.2 Backend Layer

| 항목 | 기술 |
|---|---|
| 프레임워크 | FastAPI (Python 3.11+) |
| ASGI 서버 | Uvicorn |
| ORM | SQLAlchemy 2.0 (async) |
| 마이그레이션 | Alembic |
| 인증 | JWT (python-jose) |
| WebSocket | FastAPI WebSocket 내장 |
| 비동기 큐 | Celery 5.x |
| 메시지 브로커 | Redis |

### 2.3 Analysis Engine Layer

| 항목 | 기술 |
|---|---|
| 데이터 처리 | pandas, numpy |
| 요인분석 | factor_analyzer |
| 신뢰도 | pingouin |
| 상관/T검정/ANOVA | scipy.stats, pingouin |
| 회귀분석 | statsmodels (OLS) |
| 매개/조절 | statsmodels + 자체 Bootstrap 구현 |
| 보고서 | python-docx, openpyxl |

### 2.4 Infrastructure Layer

| 항목 | 기술 |
|---|---|
| 컨테이너 | Docker + Docker Compose |
| 리버스 프록시 | Nginx |
| DB | PostgreSQL 15+ |
| 캐시/큐 | Redis 7+ |

---

## 3. WebSocket 통신 흐름

### 3.1 분석 실행 흐름

```
Frontend                     FastAPI                      Celery Worker
   │                            │                              │
   │── POST /api/analysis/run ─→│                              │
   │←── {job_id, status} ───────│                              │
   │                            │── task.delay(job_id) ───────→│
   │                            │                              │
   │── WS /ws/analysis/{job_id}→│                              │
   │←── {"status":"accepted"} ──│                              │
   │                            │                              │
   │                            │←── progress(30%) ────────────│
   │←── {"progress":30} ───────│                              │
   │                            │                              │
   │                            │←── progress(60%) ────────────│
   │←── {"progress":60} ───────│                              │
   │                            │                              │
   │                            │←── complete(result) ─────────│
   │←── {"status":"done", ─────│                              │
   │     "result": {...}}       │                              │
```

### 3.2 요인분석 수동 조정 흐름

```
Frontend                     FastAPI                      Analysis Engine
   │                            │                              │
   │── WS: {"action":"remove",  │                              │
   │    "item":"Q3_2"} ────────→│── 재분석 요청 ──────────────→│
   │                            │                              │
   │                            │←── 재분석 결과 ──────────────│
   │←── {"result": 새결과} ─────│                              │
   │                            │                              │
   │── WS: {"action":"confirm"} │                              │
   │───────────────────────────→│── DB 저장 ──────────────────→│
   │←── {"status":"confirmed"} ─│                              │
```

---

## 4. 데이터 흐름

### 4.1 파일 업로드 → 분석 완료까지의 전체 흐름

```
[1] 파일 업로드
    └─ 파일 → File Storage (서버 디렉토리)
    └─ 메타데이터 → PostgreSQL (uploaded_files 테이블)

[2] 데이터 클린징
    └─ File Storage에서 파일 읽기
    └─ 클린징 규칙 적용 (pandas)
    └─ 정제 데이터 → PostgreSQL (cleaned_datasets 테이블)

[3] 변수 매핑
    └─ 사용자 입력 → PostgreSQL (variables, variable_groups 테이블)

[4] 요인분석
    └─ 정제 데이터 + 변수 설정 → factor_analyzer
    └─ 결과 → PostgreSQL (analysis_results 테이블)
    └─ 실시간 → WebSocket으로 프론트엔드 전송

[5] 4단계 분석 (탭별 독립 실행)
    └─ 요인 확정 데이터 → 각 분석 엔진
    └─ 결과 → PostgreSQL (analysis_results 테이블)
    └─ 실시간 → WebSocket으로 프론트엔드 전송

[6] AI 해석
    └─ 분석 결과 → Gemini/Claude API
    └─ 해석 초안 → PostgreSQL (interpretations 테이블)

[7] 보고서 출력
    └─ 분석 결과 + 해석 → python-docx / openpyxl
    └─ 파일 생성 → File Storage
    └─ 다운로드 URL → 프론트엔드
```

---

## 5. 파일 저장 구조

```
/data/
├─ uploads/                    # 원본 업로드 파일
│  └─ {user_id}/
│     └─ {project_id}/
│        └─ {timestamp}_{filename}
│
├─ cleaned/                    # 정제된 데이터 파일
│  └─ {project_id}/
│     └─ {dataset_id}.parquet
│
├─ exports/                    # 생성된 보고서 파일
│  └─ {project_id}/
│     ├─ {report_id}.docx
│     └─ {report_id}.xlsx
│
└─ temp/                       # 임시 파일 (분석 중간 결과)
   └─ {job_id}/
```

---

## 6. 보안 아키텍처

### 6.1 인증 흐름

```
[로그인]
POST /api/auth/login → {username, password}
                     ← {access_token, refresh_token}

[API 호출]
GET /api/projects → Authorization: Bearer {access_token}

[WebSocket 연결]
WS /ws/analysis/{job_id}?token={access_token}
```

### 6.2 보안 원칙

| 항목 | 적용 방법 |
|---|---|
| 인증 | JWT 기반, access_token (30분) + refresh_token (7일) |
| 비밀번호 | bcrypt 해싱 |
| API 보호 | FastAPI Depends를 통한 인증 미들웨어 |
| WebSocket 보호 | 연결 시 쿼리 파라미터로 토큰 검증 |
| 파일 접근 | 인증된 사용자만 본인 프로젝트 파일 접근 |
| CORS | 허용 오리진 제한 |

---

## 7. 에러 처리 전략

| 레이어 | 전략 |
|---|---|
| Frontend | 전역 에러 바운더리 + Toast 알림 |
| API | HTTPException + 표준 에러 응답 형식 |
| WebSocket | 에러 메시지 타입 정의 + 자동 재연결 |
| Analysis | 분석 실패 시 상세 에러 메시지 + 로깅 |
| Celery | 태스크 실패 시 재시도 (최대 3회) + Dead Letter Queue |

### 표준 에러 응답 형식

```json
{
  "error": {
    "code": "ANALYSIS_FAILED",
    "message": "요인분석 중 KMO 값이 기준치 미달입니다.",
    "detail": {
      "kmo_value": 0.42,
      "threshold": 0.5
    }
  }
}
```
