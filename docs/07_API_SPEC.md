# API 명세

> 본 문서는 FastAPI 기반 REST API 및 WebSocket 엔드포인트의 명세를 정의한다.  
> 기본 URL: `http://localhost:8000/api/v1`

---

## 1. API 개요

### 1.1 공통 규칙

| 항목 | 규칙 |
|---|---|
| Base URL | `/api/v1` |
| 인증 | `Authorization: Bearer {access_token}` |
| Content-Type | `application/json` (파일 업로드 제외) |
| 에러 응답 | `{"error": {"code": "...", "message": "...", "detail": {...}}}` |
| 페이지네이션 | `?page=1&size=20` (목록 API) |

### 1.2 HTTP 상태 코드

| 코드 | 의미 | 사용 |
|---|---|---|
| 200 | OK | 조회/수정 성공 |
| 201 | Created | 생성 성공 |
| 204 | No Content | 삭제 성공 |
| 400 | Bad Request | 잘못된 요청 (검증 실패) |
| 401 | Unauthorized | 인증 실패 |
| 403 | Forbidden | 권한 없음 |
| 404 | Not Found | 리소스 없음 |
| 422 | Unprocessable Entity | 분석 실행 불가 |
| 500 | Internal Server Error | 서버 오류 |

---

## 2. 인증 API

### POST `/auth/login`
> 로그인

**Request:**
```json
{
  "username": "researcher01",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

### POST `/auth/refresh`
> 토큰 갱신

**Request:**
```json
{
  "refresh_token": "eyJhbGciOi..."
}
```

### POST `/auth/users` (관리자 전용)
> 사용자 계정 생성

**Request:**
```json
{
  "username": "researcher02",
  "password": "password456",
  "display_name": "김연구"
}
```

---

## 3. 프로젝트 API

### GET `/projects`
> 프로젝트 목록 조회

**Response (200):**
```json
{
  "items": [
    {
      "id": 1,
      "name": "박사논문 연구 1",
      "status": "factor_analysis_completed",
      "created_at": "2026-06-20T10:00:00Z",
      "updated_at": "2026-06-20T15:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "size": 20
}
```

### POST `/projects`
> 프로젝트 생성

**Request:**
```json
{
  "name": "박사논문 연구 1",
  "description": "서비스 품질이 고객 만족에 미치는 영향"
}
```

### GET `/projects/{id}`
### PUT `/projects/{id}`
### DELETE `/projects/{id}`

---

## 4. 파일 API

### POST `/projects/{project_id}/files/upload`
> 데이터 파일 업로드

**Request:** `multipart/form-data`
- `file`: 파일 (xlsx, xls, csv)

**Response (201):**
```json
{
  "file_id": 1,
  "filename": "survey_data.xlsx",
  "file_path": "/data/uploads/1/1/20260620_survey_data.xlsx",
  "size_bytes": 245760,
  "row_count": 330,
  "column_count": 42,
  "preview": [
    {"ID": 1, "SQ1": 4, "SQ2": 5, "SQ3": 3},
    {"ID": 2, "SQ1": 5, "SQ2": 4, "SQ3": 4}
  ],
  "columns": ["ID", "SQ1", "SQ2", "SQ3", "..."],
  "uploaded_at": "2026-06-20T10:05:00Z"
}
```

---

## 5. 데이터셋 API

### POST `/projects/{project_id}/datasets/cleanse`
> 데이터 클린징 실행

**Request:**
```json
{
  "file_id": 1,
  "rules": {
    "missing_value_strategy": "mean",
    "outlier_detection": {
      "method": "z_score",
      "threshold": 3.0
    },
    "reverse_coding": {
      "items": ["SQ3_R", "PF2_R"],
      "scale_min": 1,
      "scale_max": 5
    }
  }
}
```

**Response (201):**
```json
{
  "dataset_id": 1,
  "original_rows": 330,
  "cleaned_rows": 318,
  "removed_rows": 12,
  "changes": [
    {"type": "missing_replaced", "column": "SQ2", "count": 3, "method": "mean"},
    {"type": "outlier_removed", "column": "PF1", "count": 5},
    {"type": "reverse_coded", "column": "SQ3_R", "count": 318}
  ]
}
```

---

## 6. 변수 API

### POST `/projects/{project_id}/variables/mapping`
> 변수-요인 매핑 저장

**Request:**
```json
{
  "variable_groups": [
    {
      "name": "서비스 품질",
      "type": "IV",
      "items": ["SQ1", "SQ2", "SQ3", "SQ4"]
    },
    {
      "name": "가격 적정성",
      "type": "IV",
      "items": ["PF1", "PF2", "PF3"]
    },
    {
      "name": "고객 만족",
      "type": "DV",
      "items": ["CS1", "CS2", "CS3"]
    },
    {
      "name": "신뢰",
      "type": "MED",
      "items": ["TR1", "TR2", "TR3"]
    },
    {
      "name": "이용 경험",
      "type": "MOD",
      "items": ["EX1", "EX2"]
    }
  ]
}
```

### GET `/projects/{project_id}/variables/mapping`
> 변수 매핑 조회

---

## 7. 연구모형 API

### POST `/projects/{project_id}/model`
> 연구모형 저장

**Request:**
```json
{
  "nodes": [
    {"id": "n1", "type": "IV", "label": "서비스 품질", "x": 100, "y": 200},
    {"id": "n2", "type": "MED", "label": "신뢰", "x": 350, "y": 200},
    {"id": "n3", "type": "DV", "label": "고객 만족", "x": 600, "y": 200},
    {"id": "n4", "type": "MOD", "label": "이용 경험", "x": 225, "y": 50}
  ],
  "edges": [
    {"id": "e1", "source": "n1", "target": "n2", "type": "direct"},
    {"id": "e2", "source": "n2", "target": "n3", "type": "direct"},
    {"id": "e3", "source": "n1", "target": "n3", "type": "direct"},
    {"id": "e4", "source": "n4", "target": "e1", "type": "moderate"}
  ]
}
```

**Response (200):**
```json
{
  "model_id": 1,
  "detected_process_model": "Model 7",
  "description": "조절된 매개효과 (1단계 조절)",
  "analysis_paths": [
    {"path": "서비스 품질 → 신뢰 → 고객 만족", "type": "mediation"},
    {"path": "이용 경험 × 서비스 품질 → 신뢰", "type": "moderation"}
  ]
}
```

---

## 8. 요인분석 API

### POST `/projects/{project_id}/analysis/factor`
> 요인분석 실행

**Request:**
```json
{
  "dataset_id": 1,
  "variable_group_id": 1,
  "options": {
    "extraction_method": "pca",
    "rotation_method": "varimax",
    "eigenvalue_threshold": 1.0,
    "loading_threshold": 0.5,
    "communality_threshold": 0.4,
    "explained_variance_threshold": 60.0,
    "kmo_threshold": 0.5,
    "auto_refine": true
  }
}
```

**Response (202):**
```json
{
  "job_id": "fa-20260620-001",
  "status": "queued",
  "message": "요인분석이 대기열에 등록되었습니다. WebSocket으로 진행 상황을 확인하세요.",
  "ws_url": "ws://localhost:8000/ws/analysis/fa-20260620-001"
}
```

### POST `/projects/{project_id}/analysis/factor/confirm`
> 요인분석 결과 확정

**Request:**
```json
{
  "job_id": "fa-20260620-001",
  "confirmed_factors": [
    {
      "factor_name": "서비스 품질",
      "items": ["SQ1", "SQ2", "SQ4"]
    }
  ],
  "removed_items": ["SQ3"]
}
```

---

## 9. 4단계 분석 API (동일 패턴)

> 모든 4단계 분석은 동일한 요청/응답 패턴을 따른다.

### POST `/projects/{project_id}/analysis/{analysis_type}`

`analysis_type`: `reliability` | `correlation` | `t-test` | `anova` | `regression` | `mediation` | `moderation`

**공통 Request:**
```json
{
  "dataset_id": 1,
  "options": {
    // 분석별 옵션 (아래 참고)
  }
}
```

**공통 Response (202):**
```json
{
  "job_id": "{type}-20260620-001",
  "status": "queued",
  "ws_url": "ws://localhost:8000/ws/analysis/{job_id}"
}
```

### 분석별 옵션

#### 신뢰도 (reliability)
```json
{ "variable_group_ids": [1, 2, 3, 4] }
```

#### 상관관계 (correlation)
```json
{ "method": "pearson", "significance_level": 0.05 }
```

#### 독립표본 T검정 (t-test)
```json
{
  "grouping_variable": "gender",
  "test_variables": ["서비스 품질", "가격 적정성", "고객 만족"]
}
```

#### ANOVA (anova)
```json
{
  "grouping_variable": "age_group",
  "test_variables": ["서비스 품질", "고객 만족"],
  "post_hoc": "scheffe"
}
```

#### 회귀분석 (regression)
```json
{
  "independent_variables": ["서비스 품질", "가격 적정성"],
  "dependent_variable": "고객 만족"
}
```

#### 매개효과 (mediation)
```json
{
  "iv": "서비스 품질",
  "mediator": "신뢰",
  "dv": "고객 만족",
  "bootstrap_n": 5000,
  "confidence_level": 0.95
}
```

#### 조절효과 (moderation)
```json
{
  "iv": "서비스 품질",
  "moderator": "이용 경험",
  "dv": "고객 만족",
  "simple_slope_levels": [-1, 0, 1]
}
```

---

## 10. AI 해석 API

### POST `/projects/{project_id}/interpretation`
> AI 결과 해석 요청

**Request:**
```json
{
  "analysis_job_ids": ["med-20260620-001", "mod-20260620-001"],
  "ai_provider": "claude",
  "language": "ko",
  "style": "academic"
}
```

**Response (200):**
```json
{
  "interpretation_id": 1,
  "sections": [
    {
      "analysis_type": "mediation",
      "draft_text": "매개효과 분석 결과, 서비스 품질은 신뢰를 매개로 고객 만족에 유의한 간접효과를 미치는 것으로 나타났다 (간접효과 = 0.224, 95% Bootstrap CI [0.148, 0.312])...",
      "editable": true
    }
  ]
}
```

---

## 11. 보고서 출력 API

### POST `/projects/{project_id}/export`
> 보고서 생성

**Request:**
```json
{
  "format": "docx",
  "sections": ["factor_analysis", "reliability", "correlation", "regression", "mediation"],
  "include_interpretation": true
}
```

**Response (202):**
```json
{
  "export_id": 1,
  "status": "generating",
  "ws_url": "ws://localhost:8000/ws/export/exp-20260620-001"
}
```

### GET `/projects/{project_id}/export/{export_id}/download`
> 생성된 보고서 다운로드

**Response:** 파일 바이너리 (Content-Disposition: attachment)

---

## 12. WebSocket 엔드포인트

### WS `/ws/analysis/{job_id}`
> 분석 진행률 및 결과 수신

**연결:**
```
ws://localhost:8000/ws/analysis/{job_id}?token={access_token}
```

**수신 메시지 타입:**

```json
// 진행률
{"type": "progress", "progress": 30, "message": "KMO 계산 중..."}

// 결과
{"type": "result", "data": { /* 분석 결과 */ }}

// 에러
{"type": "error", "code": "ANALYSIS_FAILED", "message": "..."}
```

**송신 메시지 (요인분석 수동 조정용):**

```json
// 항목 제거
{"action": "remove_item", "item": "SQ3"}

// 항목 복원
{"action": "restore_item", "item": "SQ3"}

// 재분석
{"action": "rerun"}

// 확정
{"action": "confirm"}
```
