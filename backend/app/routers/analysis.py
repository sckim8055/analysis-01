from ..store import get_project_data
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import math
import pandas as pd

def sanitize_float(val, default=0.0):
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except:
        return default

import numpy as np
import os
from factor_analyzer import FactorAnalyzer
from factor_analyzer.factor_analyzer import calculate_kmo, calculate_bartlett_sphericity

router = APIRouter()

class EFARequest(BaseModel):
    columns: List[str]
    n_factors: Optional[int] = None
    rotation: Optional[str] = "varimax"
    extraction: Optional[str] = "minres" # minres, ml, principal
    eigenvalue_threshold: Optional[float] = 1.0

class VarianceExplained(BaseModel):
    factor: str
    ss_loadings: float      # 회전 후 적재제곱합 (SPSS: Rotation Sums of Squared Loadings, Total)
    variance_pct: float     # 설명 분산 비율 (%)
    cumulative_pct: float   # 누적 분산 비율 (%)

class EFAResponse(BaseModel):
    kmo: float
    bartlett_chi_square: float
    bartlett_df: int
    bartlett_p_value: float
    n_factors: int
    eigenvalues: List[float]
    loadings: Dict[str, Dict[str, float]]
    communalities: Dict[str, float]
    variance_explained: List[VarianceExplained]
    total_variance: float
    suggested_mapping: Dict[str, List[str]]

@router.post("/efa", response_model=EFAResponse)
async def perform_efa(request: EFARequest):
    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 존재하지 않습니다. 먼저 데이터를 업로드해주세요.")
    
    try:
        # 1. 데이터 로드 및 전처리
        # df = get_project_data("test-project-1") (이미 위에서 로드함)
        
        # 선택된 컬럼만 필터링
        missing_cols = [col for col in request.columns if col not in df.columns]
        if missing_cols:
            raise HTTPException(status_code=400, detail=f"데이터에 없는 컬럼입니다: {missing_cols}")
            
        df_selected = df[request.columns].copy()
        
        # 숫자로 변환 가능한 데이터만 유지 및 결측치 제거 (Listwise deletion)
        df_selected = df_selected.apply(pd.to_numeric, errors='coerce').dropna()
        
        if len(df_selected) < 10:
            raise HTTPException(status_code=400, detail="유효한 데이터 샘플 수가 너무 적습니다 (최소 10개 이상 권장). 결측치가 너무 많은지 확인하세요.")
            
        # 2. 적합성 검정 (KMO & Bartlett)
        try:
            kmo_all, kmo_model = calculate_kmo(df_selected)
            kmo_value = float(kmo_model) if not pd.isna(kmo_model) else 0.0
        except Exception:
            kmo_value = 0.0
            
        k_vars = len(df_selected.columns)
        bartlett_df = int(k_vars * (k_vars - 1) / 2)
        try:
            chi_square_value, p_value = calculate_bartlett_sphericity(df_selected)
            bartlett_chi_square = float(chi_square_value) if not pd.isna(chi_square_value) else 0.0
            bartlett_p_value = float(p_value) if not pd.isna(p_value) else 1.0
        except Exception:
            bartlett_chi_square = 0.0
            bartlett_p_value = 1.0

        # 3. 요인 수 결정 (Eigenvalue 기준)
        if request.n_factors is None or request.n_factors <= 0:
            # 초기 추출로 고유값 확인
            fa_initial = FactorAnalyzer(n_factors=len(request.columns), rotation=None, method=request.extraction)
            fa_initial.fit(df_selected)
            ev, v = fa_initial.get_eigenvalues()
            
            # 기준값(보통 1.0) 이상인 요인 수 계산
            n_factors = sum(ev > request.eigenvalue_threshold)
            
            # 최소 1개의 요인은 있어야 함
            n_factors = max(1, int(n_factors))
            # 변수 개수를 초과할 수 없음
            n_factors = min(n_factors, len(request.columns))
            
            eigenvalues = ev.tolist()
        else:
            n_factors = request.n_factors
            # 고유값 계산을 위한 임시 피팅
            fa_temp = FactorAnalyzer(n_factors=len(request.columns), rotation=None, method=request.extraction)
            fa_temp.fit(df_selected)
            ev, v = fa_temp.get_eigenvalues()
            eigenvalues = ev.tolist()

        # 4. 탐색적 요인 분석 실행
        # rotation이 'none' 문자열로 오면 None 타입으로 변환
        rot = None if request.rotation and request.rotation.lower() == 'none' else request.rotation
        
        fa = FactorAnalyzer(n_factors=n_factors, rotation=rot, method=request.extraction)
        fa.fit(df_selected)

        loadings_matrix = fa.loadings_
        
        # SPSS 일치: 각 요인(열)에서 절댓값이 가장 큰 적재값의 부호가 음수라면, 해당 요인의 모든 부호를 반전시킵니다.
        # 방향성만 바뀌는 것이므로 분산설명력 등의 통계적 의미는 동일합니다.
        for j in range(loadings_matrix.shape[1]):
            max_idx = np.argmax(np.abs(loadings_matrix[:, j]))
            if loadings_matrix[max_idx, j] < 0:
                loadings_matrix[:, j] *= -1

        # 공통성(Communality) — 각 항목이 추출된 요인들로 설명되는 비율
        communalities_arr = fa.get_communalities()
        communalities_dict = {
            col: round(float(communalities_arr[idx]), 3)
            for idx, col in enumerate(request.columns)
        }

        # 분산설명력 — 회전 후 적재제곱합 / 설명비율 / 누적비율 (SPSS Total Variance Explained)
        ss_loadings, prop_var, cum_var = fa.get_factor_variance()
        variance_explained = [
            VarianceExplained(
                factor=f"Factor {f_idx+1}",
                ss_loadings=round(float(ss_loadings[f_idx]), 3),
                variance_pct=round(float(prop_var[f_idx]) * 100, 2),
                cumulative_pct=round(float(cum_var[f_idx]) * 100, 2),
            )
            for f_idx in range(n_factors)
        ]
        total_variance = round(float(cum_var[-1]) * 100, 2) if n_factors > 0 else 0.0

        # 5. 결과 포맷팅
        loadings_dict = {}
        suggested_mapping = {f"Factor {i+1}": [] for i in range(n_factors)}
        
        for idx, col in enumerate(request.columns):
            row_loadings = loadings_matrix[idx]
            
            # 해당 문항의 각 요인별 적재량
            col_loadings = {}
            max_loading = -1
            max_factor = -1
            
            for f_idx, loading in enumerate(row_loadings):
                val = float(loading)
                col_loadings[f"Factor {f_idx+1}"] = val
                
                # 가장 적재량이 높은 요인 찾기 (절댓값 기준)
                if abs(val) > max_loading:
                    max_loading = abs(val)
                    max_factor = f_idx
                    
            loadings_dict[col] = col_loadings
            
            # 가장 높은 적재량을 가진 요인에 문항 할당
            if max_factor >= 0:
                suggested_mapping[f"Factor {max_factor+1}"].append(col)

        return EFAResponse(
            kmo=round(kmo_value, 3),
            bartlett_chi_square=round(bartlett_chi_square, 3),
            bartlett_df=bartlett_df,
            bartlett_p_value=round(bartlett_p_value, 4),
            n_factors=n_factors,
            eigenvalues=[round(e, 3) for e in eigenvalues],
            loadings=loadings_dict,
            communalities=communalities_dict,
            variance_explained=variance_explained,
            total_variance=total_variance,
            suggested_mapping=suggested_mapping
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"요인 분석 중 오류 발생: {str(e)}")

# --- Frequency Analysis ---
class FrequencyRequest(BaseModel):
    columns: List[str]
    title: Optional[str] = None
    footer: Optional[str] = None

class FrequencyResult(BaseModel):
    category: str
    count: int
    percent: float
    valid_percent: Optional[float] = None
    cumulative_percent: Optional[float] = None

class FrequencyResponse(BaseModel):
    frequencies: Dict[str, List[FrequencyResult]]

@router.post("/frequency", response_model=FrequencyResponse)
async def perform_frequency(request: FrequencyRequest):
    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 메모리에 존재하지 않습니다. 먼저 업로드해주세요.")
    frequencies = {}
    
    for col in request.columns:
        if col in df.columns:
            counts = df[col].value_counts(dropna=False).sort_index()
            total_cases = len(df[col])
            valid_cases = df[col].dropna().count()
            
            freq_list = []
            cum_pct = 0.0
            
            # 먼저 유효한 값들 처리
            for val, count in counts.items():
                if pd.isna(val): continue
                
                pct = round((count / total_cases) * 100, 1)
                valid_pct = round((count / valid_cases) * 100, 1)
                cum_pct += valid_pct
                # 부동소수점 오차 보정
                if cum_pct > 100.0: cum_pct = 100.0
                
                freq_list.append(FrequencyResult(
                    category=str(val), 
                    count=int(count), 
                    percent=pct,
                    valid_percent=valid_pct,
                    cumulative_percent=round(cum_pct, 1)
                ))
            
            # 결측치 처리
            missing_count = counts.get(np.nan, 0)
            if missing_count > 0:
                pct = round((missing_count / total_cases) * 100, 1)
                freq_list.append(FrequencyResult(
                    category="결측 시스템 (Missing)", 
                    count=int(missing_count), 
                    percent=pct,
                    valid_percent=None,
                    cumulative_percent=None
                ))
            
            frequencies[col] = freq_list
            
    return FrequencyResponse(frequencies=frequencies)

from ..store import get_project_data
from fastapi.responses import FileResponse

@router.post("/frequency/export")
async def export_frequency(request: FrequencyRequest):
    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 메모리에 존재하지 않습니다. 먼저 업로드해주세요.")
    rows = []
    
    for col in request.columns:
        if col in df.columns:
            counts = df[col].value_counts(dropna=False).sort_index()
            total_cases = len(df[col])
            for val, count in counts.items():
                category = "결측 시스템 (Missing)" if pd.isna(val) else str(val)
                pct = round((count / total_cases) * 100, 1)
                rows.append({"구분": col, "범주": category, "빈도(N)": int(count), "비율(%)": pct})
    
    if len(df) > 0:
        rows.append({"구분": "전체", "범주": "", "빈도(N)": len(df), "비율(%)": 100.0})
        
    out_df = pd.DataFrame(rows)
    excel_path = "data/frequency_analysis.xlsx"
    
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        out_df.to_excel(writer, index=False, startrow=2)
        worksheet = writer.sheets['Sheet1']
        if request.title:
            worksheet.cell(row=1, column=1, value=request.title)
        if request.footer:
            worksheet.cell(row=len(out_df) + 4, column=1, value=request.footer)
            
    return FileResponse(path=excel_path, filename="frequency_analysis.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# --- Reliability Analysis ---
import pingouin as pg

class ReliabilityFactor(BaseModel):
    name: str
    items: List[str]

class ReliabilityRequest(BaseModel):
    factors: List[ReliabilityFactor]

class ItemTotalStat(BaseModel):
    item: str
    scale_mean_if_deleted: float
    scale_var_if_deleted: float
    corrected_item_total_corr: float
    alpha_if_deleted: float

class ReliabilityResult(BaseModel):
    name: str
    alpha: float
    n_items: int
    item_stats: List[ItemTotalStat]

class ReliabilityResponse(BaseModel):
    results: List[ReliabilityResult]

@router.post("/reliability", response_model=ReliabilityResponse)
async def perform_reliability(request: ReliabilityRequest):
    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 메모리에 존재하지 않습니다. 먼저 업로드해주세요.")
    results = []
    
    for factor in request.factors:
        items = [i for i in factor.items if i in df.columns]
        if len(items) < 2:
            continue
            
        df_f = df[items].apply(pd.to_numeric, errors='coerce').dropna()
        n_items = len(items)
        if len(df_f) < 2 or n_items < 2:
            continue
            
        # 전체 alpha
        try:
            alpha_val = pg.cronbach_alpha(data=df_f)[0]
        except:
            alpha_val = 0.0
            
        item_stats = []
        
        for item in items:
            rem_items = [i for i in items if i != item]
            if len(rem_items) < 1:
                continue
                
            # 문항 삭제 시 척도 평균
            # 삭제된 나머지 항목들의 합의 평균
            scale_mean = df_f[rem_items].sum(axis=1).mean()
            
            # 문항 삭제 시 척도 분산 (SPSS는 sample variance ddof=1 을 사용)
            scale_var = df_f[rem_items].sum(axis=1).var(ddof=1)
            
            # 수정된 항목-전체 상관관계
            # 해당 항목과 나머지 항목들의 합 간의 피어슨 상관계수
            try:
                item_total_corr = pg.corr(df_f[item], df_f[rem_items].sum(axis=1))['r'].values[0]
            except:
                item_total_corr = 0.0
                
            # 항목 제거 시 alpha
            if len(rem_items) < 2:
                a_dropped = 0.0
            else:
                try:
                    a_dropped = pg.cronbach_alpha(data=df_f[rem_items])[0]
                except:
                    a_dropped = 0.0
                    
            item_stats.append(ItemTotalStat(
                item=item,
                scale_mean_if_deleted=round(float(scale_mean), 3),
                scale_var_if_deleted=round(float(scale_var), 3),
                corrected_item_total_corr=round(float(item_total_corr), 3),
                alpha_if_deleted=round(float(a_dropped), 3)
            ))
                
        results.append(ReliabilityResult(
            name=factor.name,
            alpha=round(float(alpha_val), 3),
            n_items=n_items,
            item_stats=item_stats
        ))
        
    return ReliabilityResponse(results=results)

class ReliabilityExportRequest(BaseModel):
    title: Optional[str] = None
    rows: List[Dict[str, Any]]
    footer: Optional[str] = None

@router.post("/reliability/export")
async def export_reliability(request: ReliabilityExportRequest):
    out_df = pd.DataFrame(request.rows)
    excel_path = "data/reliability_analysis.xlsx"
    
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        out_df.to_excel(writer, index=False, startrow=2)
        worksheet = writer.sheets['Sheet1']
        if request.title:
            worksheet.cell(row=1, column=1, value=request.title)
        if request.footer:
            worksheet.cell(row=len(out_df) + 4, column=1, value=request.footer)
            
    return FileResponse(
        path=excel_path, 
        filename="reliability_analysis.xlsx", 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


# --- Correlation Analysis ---
from scipy.stats import pearsonr

class CorrelationRequest(BaseModel):
    factors: List[ReliabilityFactor]

class CorrelationResponse(BaseModel):
    factor_names: List[str]
    matrix_r: List[List[float]]
    matrix_p: List[List[Optional[float]]]
    matrix_n: List[List[int]]

@router.post("/correlation", response_model=CorrelationResponse)
async def perform_correlation(request: CorrelationRequest):
    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 메모리에 존재하지 않습니다. 먼저 업로드해주세요.")
    
    # 각 요인별 평균 점수 계산
    factor_means = {}
    names = []
    for factor in request.factors:
        items = [i for i in factor.items if i in df.columns]
        if not items:
            continue
        df_f = df[items].apply(pd.to_numeric, errors='coerce')
        factor_means[factor.name] = df_f.mean(axis=1)
        names.append(factor.name)
        
    df_means = pd.DataFrame(factor_means)
    
    n = len(names)
    matrix_r = [[None]*n for _ in range(n)]
    matrix_p = [[None]*n for _ in range(n)]
    matrix_n = [[0]*n for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            # 두 변수 모두 유효한 케이스만 필터링 (Pairwise deletion)
            valid_df = df_means[[names[i], names[j]]].dropna()
            matrix_n[i][j] = len(valid_df)
            
            if i != j and len(valid_df) > 2:
                r, p = pearsonr(valid_df[names[i]], valid_df[names[j]])
                matrix_r[i][j] = round(float(r), 3) if not math.isnan(r) else None
                matrix_p[i][j] = float(p) if not math.isnan(p) else None
            elif i == j:
                matrix_r[i][j] = 1.0
                matrix_p[i][j] = None
                
    return CorrelationResponse(
        factor_names=names,
        matrix_r=matrix_r,
        matrix_p=matrix_p,
        matrix_n=matrix_n
    )

class CorrelationExportRequest(BaseModel):
    rows: List[Dict[str, Any]]

@router.post("/correlation/export")
async def export_correlation(request: CorrelationExportRequest):
    out_df = pd.DataFrame(request.rows)
    excel_path = "data/correlation_analysis.xlsx"
    out_df.to_excel(excel_path, index=False)
    
    return FileResponse(
        path=excel_path, 
        filename="correlation_analysis.xlsx", 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# --- Difference Analysis (T-test & ANOVA) ---
from scipy import stats

class DifferenceFactor(BaseModel):
    name: str
    parent: str
    items: List[str]

class DifferenceRequest(BaseModel):
    demographics: List[str]
    factors: List[DifferenceFactor]
    use_scheffe: Optional[bool] = False
    bootstrap_n: Optional[int] = 0

class DiffGroupStat(BaseModel):
    group_name: str
    mean: float
    sd: float

class DiffTestResult(BaseModel):
    test_type: str
    statistic: float
    p_value: float
    groups: List[DiffGroupStat]
    posthoc: Optional[str] = None
    levene_p: Optional[float] = None      # Levene 등분산 검정 p값 (SPSS와 동일)
    variance_equal: Optional[bool] = None # True=등분산 가정(Student/F), False=이분산(Welch)

class DemographicsDiffResult(BaseModel):
    demographic: str
    factors: Dict[str, DiffTestResult]

class DescStat(BaseModel):
    name: str
    parent: str
    mean: float
    sd: float

class DifferenceResponse(BaseModel):
    desc_stats: List[DescStat]
    diff_results: List[DemographicsDiffResult]

import traceback
import math

def check_nan(obj):
    if isinstance(obj, float) and math.isnan(obj):
        return True
    if isinstance(obj, dict):
        return any(check_nan(v) for v in obj.values())
    if isinstance(obj, list):
        return any(check_nan(v) for v in obj)
    if hasattr(obj, "__dict__"):
        return check_nan(obj.__dict__)
    return False

@router.post("/difference", response_model=DifferenceResponse)
async def perform_difference(request: DifferenceRequest):
    try:
        res = await _perform_difference(request)
        if check_nan(res):
            with open("error.log", "w") as f:
                f.write("NaN detected in response!\n")
                import json
                # try to dump, it will fail or show where
                f.write(str(res))
        return res
    except Exception as e:
        with open("error.log", "w") as f:
            f.write(traceback.format_exc())
        raise e

async def _perform_difference(request: DifferenceRequest):
    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 메모리에 존재하지 않습니다. 먼저 업로드해주세요.")
    
    # Calculate factor means
    factor_means = {}
    for factor in request.factors:
        items = [i for i in factor.items if i in df.columns]
        if not items:
            continue
        df_f = df[items].apply(pd.to_numeric, errors='coerce')
        factor_means[factor.name] = df_f.mean(axis=1)
        
    df_means = pd.DataFrame(factor_means)
    
    # 1. Descriptive Stats
    desc_stats = []
    for factor in request.factors:
        if factor.name in df_means.columns:
            m = df_means[factor.name].mean()
            sd = df_means[factor.name].std()
            desc_stats.append(DescStat(name=factor.name, parent=factor.parent, mean=round(sanitize_float(m), 3), sd=round(sanitize_float(sd), 3)))
            
    # 2. Difference Tests by Demographics
    diff_results = []
    for demo in request.demographics:
        if demo not in df.columns:
            continue
            
        factors_res = {}
        for factor in request.factors:
            if factor.name not in df_means.columns:
                continue
                
            # Drop NA for this specific pair
            valid_df = pd.DataFrame({'group': df[demo], 'val': df_means[factor.name]}).dropna()
            if len(valid_df) == 0:
                continue
                
            groups = valid_df['group'].unique()
            groups = [g for g in groups if str(g) != 'nan']
            
            group_stats = []
            for g in sorted(groups, key=lambda x: str(x)):
                g_df = valid_df[valid_df['group'] == g]
                group_stats.append(DiffGroupStat(
                    group_name=str(g),
                    mean=round(sanitize_float(g_df['val'].mean()), 3),
                    sd=round(sanitize_float(g_df['val'].std()), 3)
                ))
            
            group_data = [valid_df[valid_df['group'] == g]['val'].values for g in groups]
            
            if len(groups) == 2:
                # T-test: Levene 등분산 검정으로 SPSS와 동일하게 분기
                # SPSS는 평균중심(center='mean') Levene을 사용 (scipy 기본은 median이므로 명시)
                try:
                    _, levene_p = stats.levene(group_data[0], group_data[1], center='mean')
                    levene_p = sanitize_float(levene_p)
                except Exception:
                    levene_p = 1.0
                variance_equal = levene_p >= 0.05  # 등분산이면 Student-t, 아니면 Welch
                t_stat, p_val = stats.ttest_ind(group_data[0], group_data[1], equal_var=variance_equal)

                if request.bootstrap_n and request.bootstrap_n > 0:
                    try:
                        res = stats.permutation_test((group_data[0], group_data[1]), lambda x, y: stats.ttest_ind(x, y, equal_var=variance_equal)[0], n_resamples=request.bootstrap_n, alternative='two-sided')
                        p_val = res.pvalue
                    except:
                        pass

                factors_res[factor.name] = DiffTestResult(
                    test_type='t',
                    statistic=round(sanitize_float(t_stat), 3),
                    p_value=sanitize_float(p_val),
                    groups=group_stats,
                    levene_p=round(levene_p, 4),
                    variance_equal=variance_equal
                )
            elif len(groups) > 2:
                # ANOVA: Levene 등분산 검정으로 SPSS와 동일하게 분기
                try:
                    _, levene_p = stats.levene(*group_data, center='mean')
                    levene_p = sanitize_float(levene_p)
                except Exception:
                    levene_p = 1.0
                variance_equal = levene_p >= 0.05

                if variance_equal:
                    # 등분산 → 일반 일원배치 ANOVA (SPSS One-way ANOVA F)
                    f_stat, p_val = stats.f_oneway(*group_data)
                else:
                    # 이분산 → Welch's ANOVA (SPSS Welch 통계량)
                    try:
                        wa = pg.welch_anova(data=valid_df, dv='val', between='group')
                        f_stat = sanitize_float(wa['F'].values[0])
                        p_val = sanitize_float(wa['p-unc'].values[0])
                    except Exception:
                        f_stat, p_val = stats.f_oneway(*group_data)

                if request.bootstrap_n and request.bootstrap_n > 0:
                    try:
                        # For F-oneway permutation test, we can use a custom function
                        def f_stat_func(*args):
                            return stats.f_oneway(*args)[0]
                        res = stats.permutation_test(group_data, f_stat_func, n_resamples=request.bootstrap_n, alternative='greater')
                        p_val = res.pvalue
                    except:
                        pass

                posthoc_str = None
                if request.use_scheffe and p_val < 0.05:
                    try:
                        sig_pairs = []
                        if variance_equal:
                            # 등분산 → Scheffé 사후검정
                            import scikit_posthocs as sp
                            data_arr = []
                            group_arr = []
                            for i, g in enumerate(groups):
                                data_arr.extend(group_data[i])
                                group_arr.extend([g] * len(group_data[i]))
                            posthoc_res = sp.posthoc_scheffe(data_arr, groups=group_arr)
                            for i in range(len(groups)):
                                for j in range(i+1, len(groups)):
                                    g1 = groups[i]
                                    g2 = groups[j]
                                    if posthoc_res.loc[g1, g2] < 0.05:
                                        m1 = np.mean(group_data[i])
                                        m2 = np.mean(group_data[j])
                                        sig_pairs.append(f"{g1} > {g2}" if m1 > m2 else f"{g2} > {g1}")
                        else:
                            # 이분산 → Games-Howell 사후검정 (SPSS 권장)
                            gh = pg.pairwise_gameshowell(data=valid_df, dv='val', between='group')
                            pcol = 'pval' if 'pval' in gh.columns else 'p-tukey'
                            for _, row in gh.iterrows():
                                if row[pcol] < 0.05:
                                    g1, g2 = row['A'], row['B']
                                    m1 = np.mean(valid_df[valid_df['group'] == g1]['val'])
                                    m2 = np.mean(valid_df[valid_df['group'] == g2]['val'])
                                    sig_pairs.append(f"{g1} > {g2}" if m1 > m2 else f"{g2} > {g1}")
                        if sig_pairs:
                            posthoc_str = ", ".join(sig_pairs)
                    except Exception as e:
                        print("Posthoc Error:", e)
                        pass

                factors_res[factor.name] = DiffTestResult(
                    test_type='F',
                    statistic=round(sanitize_float(f_stat), 3),
                    p_value=sanitize_float(p_val),
                    groups=group_stats,
                    posthoc=posthoc_str,
                    levene_p=round(levene_p, 4),
                    variance_equal=variance_equal
                )
        
        diff_results.append(DemographicsDiffResult(
            demographic=demo,
            factors=factors_res
        ))
        
    return DifferenceResponse(desc_stats=desc_stats, diff_results=diff_results)

class DifferenceExportRequest(BaseModel):
    title: Optional[str] = None
    rows: List[Dict[str, Any]]
    footer: Optional[str] = None

@router.post("/difference/export")
async def export_difference(request: DifferenceExportRequest):
    out_df = pd.DataFrame(request.rows)
    excel_path = "data/difference_analysis.xlsx"
    
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        out_df.to_excel(writer, index=False, startrow=2)
        worksheet = writer.sheets['Sheet1']
        if request.title:
            worksheet.cell(row=1, column=1, value=request.title)
        if request.footer:
            worksheet.cell(row=len(out_df) + 4, column=1, value=request.footer)
            
    return FileResponse(path=excel_path, filename="difference_analysis.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# --- Multiple Regression Analysis ---
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.stattools import durbin_watson

class RegressionFactor(BaseModel):
    name: str
    items: List[str]

class RegressionRequest(BaseModel):
    ivs: List[RegressionFactor]
    dvs: List[RegressionFactor]
    use_mean_centering: Optional[bool] = False
    use_vif: Optional[bool] = False

class RegressionCoef(BaseModel):
    name: str
    B: float
    SE: float
    beta: float
    t: float
    p: float
    vif: Optional[float] = None

class RegressionModelResult(BaseModel):
    dv_name: str
    r_squared: float
    adj_r_squared: float
    f_value: float
    f_p_value: float
    durbin_watson: float
    coefficients: List[RegressionCoef]

class RegressionResponse(BaseModel):
    models: List[RegressionModelResult]

@router.post("/regression", response_model=RegressionResponse)
async def perform_regression(request: RegressionRequest):
    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 메모리에 존재하지 않습니다. 먼저 업로드해주세요.")
    
    # Calculate means for IVs and DVs
    iv_data = {}
    for factor in request.ivs:
        items = [i for i in factor.items if i in df.columns]
        if items:
            df_f = df[items].apply(pd.to_numeric, errors='coerce')
            iv_data[factor.name] = df_f.mean(axis=1)
            
    dv_data = {}
    for factor in request.dvs:
        items = [i for i in factor.items if i in df.columns]
        if items:
            df_f = df[items].apply(pd.to_numeric, errors='coerce')
            dv_data[factor.name] = df_f.mean(axis=1)
            
    df_iv = pd.DataFrame(iv_data)
    df_dv = pd.DataFrame(dv_data)
    
    models_res = []
    
    for dv_name in df_dv.columns:
        # Combine IVs and current DV, drop NA
        temp_df = pd.concat([df_iv, df_dv[[dv_name]]], axis=1).dropna()
        if len(temp_df) < 5 or len(df_iv.columns) == 0:
            continue
            
        y = temp_df[dv_name]
        X = temp_df[df_iv.columns]
        
        # Mean Centering
        if request.use_mean_centering:
            X = X - X.mean()
            
        X_with_const = sm.add_constant(X)
        
        # Fit model
        model = sm.OLS(y, X_with_const)
        results = model.fit()
        
        # Calculate standardized beta
        y_std = (y - y.mean()) / y.std(ddof=0) if y.std(ddof=0) != 0 else y
        X_std = (X - X.mean()) / X.std(ddof=0)
        X_std = X_std.fillna(0)
        std_model = sm.OLS(y_std, X_std)
        std_results = std_model.fit()
        
        # Durbin-Watson
        dw_stat = durbin_watson(results.resid)
        
        # VIF
        vif_dict = {}
        if request.use_vif:
            for i, col in enumerate(X_with_const.columns):
                if col != 'const':
                    try:
                        vif = variance_inflation_factor(X_with_const.values, i)
                        vif_dict[col] = vif
                    except:
                        vif_dict[col] = 0.0
                    
        coefs = []
        # Add constant
        coefs.append(RegressionCoef(
            name="(상수)",
            B=float(results.params['const']),
            SE=float(results.bse['const']),
            beta=0.0,
            t=float(results.tvalues['const']),
            p=float(results.pvalues['const']),
            vif=None
        ))
        
        for iv_name in df_iv.columns:
            coefs.append(RegressionCoef(
                name=iv_name,
                B=float(results.params[iv_name]),
                SE=float(results.bse[iv_name]),
                beta=float(std_results.params[iv_name]),
                t=float(results.tvalues[iv_name]),
                p=float(results.pvalues[iv_name]),
                vif=float(vif_dict.get(iv_name, 0.0)) if request.use_vif else None
            ))
            
        models_res.append(RegressionModelResult(
            dv_name=dv_name,
            r_squared=float(results.rsquared),
            adj_r_squared=float(results.rsquared_adj),
            f_value=float(results.fvalue),
            f_p_value=float(results.f_pvalue),
            durbin_watson=float(dw_stat),
            coefficients=coefs
        ))
        
    return RegressionResponse(models=models_res)

class RegressionExportRequest(BaseModel):
    title: Optional[str] = None
    rows: List[Dict[str, Any]]
    footer: Optional[str] = None

@router.post("/regression/export")
async def export_regression(request: RegressionExportRequest):
    out_df = pd.DataFrame(request.rows)
    excel_path = "data/regression_analysis.xlsx"
    
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        out_df.to_excel(writer, index=False, startrow=2)
        worksheet = writer.sheets['Sheet1']
        if request.title:
            worksheet.cell(row=1, column=1, value=request.title)
        if request.footer:
            worksheet.cell(row=len(out_df) + 4, column=1, value=request.footer)
            
    return FileResponse(path=excel_path, filename="regression_analysis.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

# --- Mediation Analysis ---
from .mediation_utils import run_mediation_analysis
from .process_macro_utils import run_moderation_analysis, run_moderated_mediation

class MediationVarPayload(BaseModel):
    name: str
    items: List[str]

class MediationRequest(BaseModel):
    iv_parent_name: str
    med_parent_name: str
    dv_parent_name: str
    ivs: List[MediationVarPayload]
    meds: List[MediationVarPayload]
    dvs: List[MediationVarPayload]
    mods: List[MediationVarPayload] = []
    analysis_type: str = "mediation" # "mediation", "moderation", "moderated_mediation" 
    n_boot: int = 5000
    seed: Optional[int] = None  # Bootstrap 재현용 시드 (지정 시 매번 동일한 CI)

@router.post("/mediation")
async def perform_mediation(request: MediationRequest):
    df = get_project_data("test-project-1")
    if df is None:
        raise HTTPException(status_code=400, detail="데이터가 메모리에 존재하지 않습니다. 먼저 업로드해주세요.")
    
    try:
        ivs_data = [{"name": iv.name, "items": iv.items} for iv in request.ivs]
        
        all_results = []
        
        if request.analysis_type == "moderation":
            for dv in request.dvs:
                dv_data = {"name": dv.name, "items": dv.items}
                for mod in request.mods:
                    mod_data = {"name": mod.name, "items": mod.items}
                    res = run_moderation_analysis(df, ivs_data, mod_data, dv_data)
                    res["dv_name"] = dv.name
                    res["mod_name"] = mod.name
                    all_results.append(res)
            return {"results": all_results}
            
        elif request.analysis_type == "moderated_mediation":
            for dv in request.dvs:
                dv_data = {"name": dv.name, "items": dv.items}
                for med in request.meds:
                    med_data = {"name": med.name, "items": med.items}
                    for mod in request.mods:
                        mod_data = {"name": mod.name, "items": mod.items}
                        res = run_moderated_mediation(df, ivs_data[0], med_data, mod_data, dv_data, n_boot=request.n_boot, seed=request.seed)
                        res["dv_name"] = dv.name
                        res["med_name"] = med.name
                        res["mod_name"] = mod.name
                        all_results.append(res)
            return {"results": all_results}
            
        else: # Classic mediation
            for dv in request.dvs:
                dv_data = {"name": dv.name, "items": dv.items}
                med_models = []
                
                for med in request.meds:
                    med_data = {"name": med.name, "items": med.items}
                    res = run_mediation_analysis(
                        df=df,
                        ivs_data=ivs_data,
                        med_data=med_data,
                        dv_data=dv_data,
                        n_boot=request.n_boot,
                        seed=request.seed
                    )
                    res['med_name'] = med.name
                    med_models.append(res)
                    
                all_results.append({
                    "dv_name": dv.name,
                    "models": med_models
                })
                
            if not all_results:
                raise HTTPException(status_code=400, detail="매개효과 분석을 수행할 수 없습니다.")
                
            return {"results": all_results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

class MediationExportRequest(BaseModel):
    title: Optional[str] = None
    rows: List[Dict[str, Any]]
    footer: Optional[str] = None

@router.post("/mediation/export")
async def export_mediation(request: MediationExportRequest):
    out_df = pd.DataFrame(request.rows)
    excel_path = "data/mediation_analysis.xlsx"
    
    with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
        out_df.to_excel(writer, index=False, startrow=2)
        worksheet = writer.sheets['Sheet1']
        if request.title:
            worksheet.cell(row=1, column=1, value=request.title)
        if request.footer:
            worksheet.cell(row=len(out_df) + 4, column=1, value=request.footer)
            
    return FileResponse(path=excel_path, filename="mediation_analysis.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

