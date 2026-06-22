import pandas as pd
import numpy as np
import statsmodels.api as sm
from scipy import stats

def run_mediation_analysis(df, ivs_data, med_data, dv_data, n_boot=5000):
    df_clean = df.copy()
    
    # Create IV columns
    iv_cols = []
    for iv in ivs_data:
        col_name = iv['name']
        items = iv['items']
        if items:
            df_clean[col_name] = df_clean[items].mean(axis=1)
            iv_cols.append(col_name)
        
    # Create Med column
    med_col = med_data['name']
    if med_data['items']:
        df_clean[med_col] = df_clean[med_data['items']].mean(axis=1)
    
    # Create DV column
    dv_col = dv_data['name']
    if dv_data['items']:
        df_clean[dv_col] = df_clean[dv_data['items']].mean(axis=1)
    
    df_clean = df_clean.dropna(subset=iv_cols + [med_col, dv_col])
    
    n = len(df_clean)
    if n < 10:
        raise ValueError("유효한 데이터 샘플 수가 너무 적습니다.")
        
    results = {}
    
    # --- Baron & Kenny 3 Steps ---
    
    # Step 1: IVs -> Med
    X1 = df_clean[iv_cols]
    X1 = sm.add_constant(X1)
    y1 = df_clean[med_col]
    model1 = sm.OLS(y1, X1).fit()
    
    step1_res = {
        "r_squared": model1.rsquared,
        "f_value": model1.fvalue,
        "f_p_value": model1.f_pvalue,
        "coefficients": []
    }
    for col in iv_cols:
        beta = model1.params[col] * (df_clean[col].std() / df_clean[med_col].std())
        step1_res["coefficients"].append({
            "name": col,
            "B": model1.params[col],
            "SE": model1.bse[col],
            "beta": beta,
            "t": model1.tvalues[col],
            "p": model1.pvalues[col]
        })
    results["step1"] = step1_res
    
    # Step 2: IVs -> DV
    X2 = df_clean[iv_cols]
    X2 = sm.add_constant(X2)
    y2 = df_clean[dv_col]
    model2 = sm.OLS(y2, X2).fit()
    
    step2_res = {
        "r_squared": model2.rsquared,
        "f_value": model2.fvalue,
        "f_p_value": model2.f_pvalue,
        "coefficients": []
    }
    for col in iv_cols:
        beta = model2.params[col] * (df_clean[col].std() / df_clean[dv_col].std())
        step2_res["coefficients"].append({
            "name": col,
            "B": model2.params[col],
            "SE": model2.bse[col],
            "beta": beta,
            "t": model2.tvalues[col],
            "p": model2.pvalues[col]
        })
    results["step2"] = step2_res
    
    # Step 3: IVs + Med -> DV
    X3 = df_clean[iv_cols + [med_col]]
    X3 = sm.add_constant(X3)
    y3 = df_clean[dv_col]
    model3 = sm.OLS(y3, X3).fit()
    
    step3_res = {
        "r_squared": model3.rsquared,
        "f_value": model3.fvalue,
        "f_p_value": model3.f_pvalue,
        "coefficients": []
    }
    for col in iv_cols:
        beta = model3.params[col] * (df_clean[col].std() / df_clean[dv_col].std())
        step3_res["coefficients"].append({
            "name": col,
            "B": model3.params[col],
            "SE": model3.bse[col],
            "beta": beta,
            "t": model3.tvalues[col],
            "p": model3.pvalues[col]
        })
        
    med_beta = model3.params[med_col] * (df_clean[med_col].std() / df_clean[dv_col].std())
    step3_res["med_coefficient"] = {
        "name": med_col,
        "B": model3.params[med_col],
        "SE": model3.bse[med_col],
        "beta": med_beta,
        "t": model3.tvalues[med_col],
        "p": model3.pvalues[med_col]
    }
    results["step3"] = step3_res
    
    # --- Adoptions & Indirect Effects (Sobel / Bootstrap) ---
    adoptions = []
    indirect_effects = []
    
    # For Bootstrapping, we will collect the products of a*b for all IVs simultaneously
    boot_samples = {col: [] for col in iv_cols}
    
    if n_boot > 0:
        for _ in range(n_boot):
            indices = np.random.choice(n, n, replace=True)
            df_boot = df_clean.iloc[indices]
            
            X1_b = sm.add_constant(df_boot[iv_cols])
            y1_b = df_boot[med_col]
            m1_b = sm.OLS(y1_b, X1_b).fit()
            
            X3_b = sm.add_constant(df_boot[iv_cols + [med_col]])
            y3_b = df_boot[dv_col]
            m3_b = sm.OLS(y3_b, X3_b).fit()
            
            for col in iv_cols:
                a_boot = m1_b.params[col]
                b_boot = m3_b.params[med_col]
                boot_samples[col].append(a_boot * b_boot)
    
    for col in iv_cols:
        p1 = model1.pvalues[col]
        p2 = model2.pvalues[col]
        p3_med = model3.pvalues[med_col]
        p3_iv = model3.pvalues[col]
        
        b1 = model1.params[col]
        b2 = model2.params[col]
        b3_iv = model3.params[col]
        b3_med = model3.params[med_col]
        
        # 1. Adoption Status (Baron & Kenny)
        status = "기각"
        if p1 < 0.05 and p2 < 0.05 and p3_med < 0.05:
            if p3_iv < 0.05:
                if abs(b3_iv) < abs(b2):
                    status = "부분매개"
                else:
                    status = "기각"
            else:
                status = "완전매개"
                
        adoptions.append({
            "iv": col,
            "status": status
        })
        
        # 2. Sobel Test
        a = model1.params[col]
        b = model3.params[med_col]
        sa = model1.bse[col]
        sb = model3.bse[med_col]
        
        sobel_se = np.sqrt((a**2 * sb**2) + (b**2 * sa**2))
        z_score = (a * b) / sobel_se if sobel_se > 0 else 0
        p_val = stats.norm.sf(abs(z_score)) * 2
        
        # 3. Bootstrapping
        if n_boot > 0:
            boot_arr = np.array(boot_samples[col])
            boot_se = np.std(boot_arr)
            llci = np.percentile(boot_arr, 2.5)
            ulci = np.percentile(boot_arr, 97.5)
            is_sig = not (llci <= 0 <= ulci)
        else:
            boot_se = 0
            llci = 0
            ulci = 0
            is_sig = False
            
        indirect_effects.append({
            "iv": col,
            "effect": a * b,
            "sobel_z": z_score,
            "sobel_p": p_val,
            "boot_se": boot_se,
            "boot_llci": llci,
            "boot_ulci": ulci,
            "is_significant": is_sig
        })
        
    results["adoptions"] = adoptions
    results["indirect_effects"] = indirect_effects
    
    return results
