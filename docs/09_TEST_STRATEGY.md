# 테스트 전략

> 본 문서는 TDD 원칙에 기반한 테스트 전략과 각 테스트 레벨의 범위, 도구, 실행 계획을 정의한다.

---

## 1. 테스트 원칙

### 1.1 TDD 워크플로우

```
[1] Red    — 실패하는 테스트 먼저 작성
[2] Green  — 테스트를 통과하는 최소한의 코드 작성
[3] Refactor — 코드 정리, 테스트는 계속 통과
```

### 1.2 핵심 원칙

| 원칙 | 적용 |
|---|---|
| **분석 함수 테스트 우선** | 통계 분석 함수는 반드시 테스트 먼저 작성 |
| **SPSS 결과와 비교 검증** | 알려진 데이터셋으로 SPSS 26 결과와 비교 |
| **독립적 테스트** | 각 테스트는 다른 테스트에 의존하지 않음 |
| **빠른 피드백** | Unit Test는 1초 이내 실행 |
| **결정론적** | 동일 입력 → 동일 결과 (seed 고정) |

---

## 2. 테스트 피라미드

```
        ┌─────────────┐
        │    UAT      │  ← 실제 논문 데이터 시나리오
        │   (수동)     │     소수, 핵심 시나리오만
        ├─────────────┤
        │    SAT      │  ← 시스템 전체 통합
        │  (자동+수동)  │     전체 파이프라인 검증
        ├─────────────┤
        │ Integration │  ← API + DB + 분석 엔진 통합
        │   (자동)     │     주요 흐름 검증
        ├─────────────┤
        │             │
        │  Unit Test  │  ← 분석 함수, 서비스, 유틸리티
        │   (자동)     │     가장 많은 수, 가장 빠름
        │             │
        └─────────────┘
```

| 레벨 | 비율 | 실행 시간 | 자동화 |
|---|---|---|---|
| Unit Test | 70% | < 1초/건 | 완전 자동 |
| Integration Test | 20% | < 5초/건 | 완전 자동 |
| SAT | 7% | 수 분 | 반자동 |
| UAT | 3% | 수십 분 | 수동 |

---

## 3. Unit Test

### 3.1 분석 엔진 Unit Test

> **최우선 대상:** 모든 통계 분석 함수는 Unit Test 필수

#### 요인분석 테스트

```python
# tests/unit/analysis/test_efa_analyzer.py

import pytest
import pandas as pd
from app.analysis.factor.efa_analyzer import EFAAnalyzer
from app.analysis.base import AnalysisInput

class TestEFAAnalyzer:
    """탐색적 요인분석 단위 테스트"""
    
    @pytest.fixture
    def sample_data(self):
        """SPSS 26 검증용 표준 데이터셋"""
        return pd.read_csv("tests/fixtures/factor_analysis_sample.csv")
    
    @pytest.fixture
    def analyzer(self):
        return EFAAnalyzer()
    
    def test_kmo_calculation(self, analyzer, sample_data):
        """KMO 값이 SPSS 26 결과와 일치하는지 검증"""
        input_data = AnalysisInput(
            data=sample_data,
            options={"extraction_method": "pca"}
        )
        result = analyzer.analyze(input_data)
        # SPSS 26 결과: KMO = 0.842
        assert abs(result.result["kmo"] - 0.842) < 0.001
    
    def test_factor_loadings_match_spss(self, analyzer, sample_data):
        """요인적재값이 SPSS 26 결과와 일치하는지 검증"""
        input_data = AnalysisInput(
            data=sample_data,
            options={
                "extraction_method": "pca",
                "rotation_method": "varimax",
                "n_factors": 3
            }
        )
        result = analyzer.analyze(input_data)
        # SPSS 26과 소수점 2자리까지 일치 확인
        loadings = result.result["factor_matrix"]
        assert abs(loadings["SQ1"][0] - 0.82) < 0.01
    
    def test_auto_refine_removes_low_loading(self, analyzer, sample_data):
        """요인적재값 기준 미달 항목이 자동 제거되는지 검증"""
        input_data = AnalysisInput(
            data=sample_data,
            options={
                "extraction_method": "pca",
                "rotation_method": "varimax",
                "loading_threshold": 0.5,
                "auto_refine": True
            }
        )
        result = analyzer.analyze(input_data)
        removed = [r["item"] for r in result.result["removed_items"]]
        assert "SQ3" in removed  # SQ3은 적재값 0.312로 기준 미달
    
    def test_eigenvalue_threshold(self, analyzer, sample_data):
        """고유값 기준 이상인 요인만 추출되는지 검증"""
        input_data = AnalysisInput(
            data=sample_data,
            options={
                "extraction_method": "pca",
                "eigenvalue_threshold": 1.0
            }
        )
        result = analyzer.analyze(input_data)
        eigenvalues = result.result["eigenvalues"]
        assert all(ev >= 1.0 for ev in eigenvalues)
    
    def test_empty_data_returns_error(self, analyzer):
        """빈 데이터 입력 시 에러 반환"""
        input_data = AnalysisInput(
            data=pd.DataFrame(),
            options={}
        )
        result = analyzer.analyze(input_data)
        assert result.success is False
        assert "empty" in result.errors[0].lower()
```

#### 신뢰도 분석 테스트

```python
# tests/unit/analysis/test_reliability.py

class TestCronbachAlpha:
    def test_known_alpha_value(self):
        """알려진 데이터에서 Cronbach's α 정확성 검증"""
        # 4개 항목, α ≈ 0.876 (SPSS 26 결과)
        result = calculate_cronbach_alpha(sample_data[["SQ1", "SQ2", "SQ3", "SQ4"]])
        assert abs(result["alpha"] - 0.876) < 0.001
    
    def test_item_deleted_alpha(self):
        """항목 제거 시 α 변화 계산 검증"""
        result = calculate_cronbach_alpha(sample_data[["SQ1", "SQ2", "SQ3", "SQ4"]])
        assert "item_deleted_alpha" in result
        assert len(result["item_deleted_alpha"]) == 4
```

#### 매개효과 분석 테스트

```python
# tests/unit/analysis/test_mediation.py

class TestMediationAnalysis:
    def test_indirect_effect_matches_process_macro(self):
        """간접효과가 PROCESS Macro v5 결과와 일치하는지 검증"""
        result = run_mediation(
            data=sample_data,
            iv="서비스_품질", mediator="신뢰", dv="고객_만족",
            bootstrap_n=5000, seed=42
        )
        # PROCESS Macro v5 결과: 간접효과 = 0.224
        assert abs(result["indirect_effect"] - 0.224) < 0.01
    
    def test_bootstrap_ci_excludes_zero(self):
        """유의한 매개효과의 Bootstrap CI에 0이 미포함"""
        result = run_mediation(...)
        ci_lower, ci_upper = result["bootstrap_ci"]
        assert ci_lower > 0 or ci_upper < 0  # 0을 포함하지 않으면 유의
    
    def test_process_model_4_paths(self):
        """Model 4 경로 (a, b, c, c') 계수 검증"""
        result = run_mediation(...)
        assert "a_path" in result
        assert "b_path" in result
        assert "c_path" in result  # 총효과
        assert "c_prime_path" in result  # 직접효과
```

### 3.2 서비스 레이어 Unit Test

```python
# tests/unit/services/test_variable_service.py

class TestVariableService:
    def test_duplicate_mapping_raises_error(self):
        """같은 항목이 2개 변수 그룹에 매핑되면 에러"""
        ...
    
    def test_empty_group_raises_error(self):
        """하위변수 없는 그룹 생성 시 에러"""
        ...
```

---

## 4. Integration Test

### 4.1 API 통합 테스트

```python
# tests/integration/api/test_analysis_flow.py

class TestAnalysisFlow:
    """업로드 → 클린징 → 변수설정 → 요인분석 전체 흐름 테스트"""
    
    async def test_full_pipeline(self, client: AsyncClient, auth_headers):
        # 1. 프로젝트 생성
        resp = await client.post("/api/v1/projects", json={"name": "Test"}, headers=auth_headers)
        project_id = resp.json()["id"]
        
        # 2. 파일 업로드
        with open("tests/fixtures/sample.xlsx", "rb") as f:
            resp = await client.post(
                f"/api/v1/projects/{project_id}/files/upload",
                files={"file": f},
                headers=auth_headers
            )
        assert resp.status_code == 201
        file_id = resp.json()["file_id"]
        
        # 3. 클린징
        resp = await client.post(
            f"/api/v1/projects/{project_id}/datasets/cleanse",
            json={"file_id": file_id, "rules": {...}},
            headers=auth_headers
        )
        assert resp.status_code == 201
        
        # 4. 변수 매핑
        # 5. 요인분석 실행
        # 6. 결과 확인
```

### 4.2 WebSocket 통합 테스트

```python
# tests/integration/ws/test_analysis_ws.py

async def test_analysis_progress_via_websocket(client):
    """WebSocket으로 분석 진행률을 수신하는지 테스트"""
    async with client.websocket_connect("/ws/analysis/test-job-1?token=...") as ws:
        data = await ws.receive_json()
        assert data["type"] == "progress"
        assert 0 <= data["progress"] <= 100
```

---

## 5. SAT (System Acceptance Test)

### 5.1 시나리오 목록

| ID | 시나리오 | 검증 항목 |
|---|---|---|
| SAT-001 | 전체 파이프라인 실행 | 업로드→클린징→매핑→요인→7개분석→보고서 출력 |
| SAT-002 | 대용량 데이터 처리 | 1000행 이상 데이터 업로드 및 분석 |
| SAT-003 | 동시 분석 실행 | 2개 이상 분석 동시 실행 시 간섭 없음 |
| SAT-004 | 에러 복구 | 분석 실패 후 재시도 성공 |
| SAT-005 | 세션 유지 | 토큰 만료 후 갱신 |
| SAT-006 | Word 출력 정확성 | 출력된 Word 파일의 표/수치 정확성 |
| SAT-007 | Excel 출력 정확성 | 출력된 Excel 파일의 데이터 정확성 |

---

## 6. UAT (User Acceptance Test)

### 6.1 시나리오

| ID | 시나리오 | 검증 내용 | 검증자 |
|---|---|---|---|
| UAT-001 | 실제 박사논문 설문 데이터로 전체 분석 | SPSS 26 결과와 비교 | 연구자 |
| UAT-002 | 요인분석 수동 조정 후 결과 확인 | 기대한 요인 구조 도출 여부 | 연구자 |
| UAT-003 | 매개효과 분석 → PROCESS v5 결과 비교 | Bootstrap CI 일치 여부 | 연구자 |
| UAT-004 | 조절효과 분석 → PROCESS v5 결과 비교 | 상호작용항, 단순 기울기 일치 | 연구자 |
| UAT-005 | Word 보고서 → 논문에 직접 사용 가능 여부 | 표 양식, 수치 정확성 | 연구자 |
| UAT-006 | AI 해석 → 카피킬러 통과 여부 | 수정 후 표절률 확인 | 연구자 |

---

## 7. 테스트 도구

| 도구 | 용도 |
|---|---|
| `pytest` | 테스트 프레임워크 |
| `pytest-asyncio` | 비동기 테스트 |
| `pytest-cov` | 커버리지 측정 |
| `httpx` | FastAPI 테스트 클라이언트 |
| `factory_boy` | 테스트 데이터 생성 |
| `pytest-mock` | Mocking |

---

## 8. 커버리지 목표

| 모듈 | 커버리지 목표 | 사유 |
|---|---|---|
| `analysis/` | **95%** | 핵심 분석 로직, 정확성 최우선 |
| `services/` | **85%** | 비즈니스 로직 |
| `api/` | **80%** | 요청/응답 처리 |
| `repositories/` | **70%** | CRUD, DB 연동 |
| 전체 | **85%** | |

---

## 9. 테스트 실행 명령

```bash
# 전체 테스트
pytest

# Unit Test만
pytest tests/unit/ -v

# 분석 엔진 테스트만
pytest tests/unit/analysis/ -v

# 커버리지 포함
pytest --cov=app --cov-report=html

# 특정 테스트
pytest tests/unit/analysis/test_efa_analyzer.py -v -k "test_kmo"
```

---

## 10. 테스트 데이터

### 10.1 표준 테스트 데이터셋

| 파일 | 용도 | 행 수 | 열 수 |
|---|---|---|---|
| `factor_analysis_sample.csv` | 요인분석 검증용 (SPSS 26 결과 대조) | 300 | 20 |
| `mediation_sample.csv` | 매개효과 검증용 (PROCESS v5 결과 대조) | 250 | 10 |
| `moderation_sample.csv` | 조절효과 검증용 | 200 | 8 |
| `edge_case_missing.csv` | 결측치 다수 포함 | 100 | 15 |
| `edge_case_outlier.csv` | 이상치 포함 | 100 | 10 |

> 모든 테스트 데이터는 `tests/fixtures/` 디렉토리에 저장
