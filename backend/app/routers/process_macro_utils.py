import pandas as pd
import numpy as np
import statsmodels.api as sm
from scipy import stats

def mean_center(s):
    return s - s.mean()

def run_moderation_analysis(df, ivs_data, mod_data, dv_data):
    df_clean = df.copy()
    
    # Create IV columns
    iv_cols = []
    for iv in ivs_data:
        col_name = iv['name']
        if iv['items']:
            df_clean[col_name] = df_clean[iv['items']].mean(axis=1)
            iv_cols.append(col_name)
            
    # Create Mod column
    mod_col = mod_data['name']
    if mod_data['items']:
        df_clean[mod_col] = df_clean[mod_data['items']].mean(axis=1)
        
    # Create DV column
    dv_col = dv_data['name']
    if dv_data['items']:
        df_clean[dv_col] = df_clean[dv_data['items']].mean(axis=1)
        
    df_clean = df_clean.dropna(subset=iv_cols + [mod_col, dv_col])
    
    # Mean centering
    for col in iv_cols:
        df_clean[f"{col}_c"] = mean_center(df_clean[col])
    df_clean[f"{mod_col}_c"] = mean_center(df_clean[mod_col])
    
    iv_cols_c = [f"{col}_c" for col in iv_cols]
    mod_col_c = f"{mod_col}_c"
    
    # Interaction terms
    int_cols = []
    for col in iv_cols_c:
        int_col = f"{col}X{mod_col_c}"
        df_clean[int_col] = df_clean[col] * df_clean[mod_col_c]
        int_cols.append(int_col)
        
    # Model 1: IVs -> DV
    X1 = df_clean[iv_cols_c]
    X1 = sm.add_constant(X1)
    y = df_clean[dv_col]
    model1 = sm.OLS(y, X1).fit()
    
    # Model 2: IVs + Mod -> DV
    X2 = df_clean[iv_cols_c + [mod_col_c]]
    X2 = sm.add_constant(X2)
    model2 = sm.OLS(y, X2).fit()
    
    # Model 3: IVs + Mod + Interaction -> DV
    X3 = df_clean[iv_cols_c + [mod_col_c] + int_cols]
    X3 = sm.add_constant(X3)
    model3 = sm.OLS(y, X3).fit()
    
    def extract_coefs(model, term_names, original_names):
        coefs = []
        for term, orig in zip(term_names, original_names):
            if term in model.params:
                coefs.append({
                    "name": orig,
                    "B": float(model.params[term]),
                    "SE": float(model.bse[term]),
                    "t": float(model.tvalues[term]),
                    "p": float(model.pvalues[term])
                })
            else:
                coefs.append({
                    "name": orig, "B": None, "SE": None, "t": None, "p": None
                })
        return coefs

    term_names = iv_cols_c + [mod_col_c] + int_cols
    original_names = [iv['name'] for iv in ivs_data] + [mod_col] + [f"{iv['name']} x {mod_col}" for iv in ivs_data]

    results = {
        "model1": {
            "r_squared": float(model1.rsquared),
            "f_value": float(model1.fvalue),
            "f_p_value": float(model1.f_pvalue),
            "coefficients": extract_coefs(model1, term_names, original_names)
        },
        "model2": {
            "r_squared": float(model2.rsquared),
            "f_value": float(model2.fvalue),
            "f_p_value": float(model2.f_pvalue),
            "delta_r_squared": float(model2.rsquared - model1.rsquared),
            "coefficients": extract_coefs(model2, term_names, original_names)
        },
        "model3": {
            "r_squared": float(model3.rsquared),
            "f_value": float(model3.fvalue),
            "f_p_value": float(model3.f_pvalue),
            "delta_r_squared": float(model3.rsquared - model2.rsquared),
            "coefficients": extract_coefs(model3, term_names, original_names)
        }
    }
    
    return results

def run_moderated_mediation(df, iv_data, med_data, mod_data, dv_data, model_type=14, n_boot=5000, seed=1234):
    rng = np.random.default_rng(seed)
    df_clean = df.copy()
    
    iv_col = iv_data['name']
    if iv_data['items']: df_clean[iv_col] = df_clean[iv_data['items']].mean(axis=1)
        
    med_col = med_data['name']
    if med_data['items']: df_clean[med_col] = df_clean[med_data['items']].mean(axis=1)
        
    mod_col = mod_data['name']
    if mod_data['items']: df_clean[mod_col] = df_clean[mod_data['items']].mean(axis=1)
        
    dv_col = dv_data['name']
    if dv_data['items']: df_clean[dv_col] = df_clean[dv_data['items']].mean(axis=1)
        
    df_clean = df_clean.dropna(subset=[iv_col, med_col, mod_col, dv_col])
    
    df_clean[f"{iv_col}_c"] = mean_center(df_clean[iv_col])
    df_clean[f"{med_col}_c"] = mean_center(df_clean[med_col])
    df_clean[f"{mod_col}_c"] = mean_center(df_clean[mod_col])
    
    iv_c = f"{iv_col}_c"
    med_c = f"{med_col}_c"
    mod_c = f"{mod_col}_c"
    
    mod_mean = df_clean[mod_col].mean()
    mod_sd = df_clean[mod_col].std()
    
    w_values = [
        {"label": "-1SD", "val": -mod_sd, "real_val": mod_mean - mod_sd},
        {"label": "Mean", "val": 0, "real_val": mod_mean},
        {"label": "+1SD", "val": mod_sd, "real_val": mod_mean + mod_sd}
    ]
    
    if model_type == 7:
        int_col = f"{iv_c}X{mod_c}"
        df_clean[int_col] = df_clean[iv_c] * df_clean[mod_c]
        
        # M Model: IV + Mod + IVxMod -> Med
        X_m = df_clean[[iv_c, mod_c, int_col]]
        X_m = sm.add_constant(X_m)
        y_m = df_clean[med_c]
        model_m = sm.OLS(y_m, X_m).fit()
        
        # Y Model: IV + Med -> DV (W is not in Y model in standard Model 7)
        X_y = df_clean[[iv_c, med_c]]
        X_y = sm.add_constant(X_y)
        y_y = df_clean[dv_col]
        model_y = sm.OLS(y_y, X_y).fit()
        
        a1 = model_m.params[iv_c]
        a3 = model_m.params[int_col]
        b = model_y.params[med_c]
        
        boot_samples = {w['label']: [] for w in w_values}
        boot_index = []
        
        if n_boot > 0:
            for _ in range(n_boot):
                idx = rng.choice(df_clean.index, size=len(df_clean), replace=True)
                boot_df = df_clean.loc[idx]
                
                X_m_b = sm.add_constant(boot_df[[iv_c, mod_c, int_col]])
                model_m_b = sm.OLS(boot_df[med_c], X_m_b).fit()
                a1_b = model_m_b.params[iv_c]
                a3_b = model_m_b.params[int_col]
                
                X_y_b = sm.add_constant(boot_df[[iv_c, med_c]])
                model_y_b = sm.OLS(boot_df[dv_col], X_y_b).fit()
                b_b = model_y_b.params[med_c]
                
                boot_index.append(a3_b * b_b)
                for w in w_values:
                    boot_samples[w['label']].append((a1_b + a3_b * w['val']) * b_b)
                    
        cond_effects = []
        for w in w_values:
            eff = (a1 + a3 * w['val']) * b
            se = np.std(boot_samples[w['label']]) if n_boot > 0 else 0
            cond_effects.append({
                "w_label": w['label'], "w_value": w['real_val'], "effect": eff, "se": se,
                "t": eff/se if se>0 else 0,
                "llci": np.percentile(boot_samples[w['label']], 2.5) if n_boot > 0 else 0,
                "ulci": np.percentile(boot_samples[w['label']], 97.5) if n_boot > 0 else 0
            })
            
        index_med = a3 * b
        
        return {
            "m_model": {
                "r_squared": float(model_m.rsquared), "f_value": float(model_m.fvalue), "f_p_value": float(model_m.f_pvalue),
                "coefficients": [
                    {"name": "상수", "B": float(model_m.params['const']), "SE": float(model_m.bse['const']), "t": float(model_m.tvalues['const']), "p": float(model_m.pvalues['const'])},
                    {"name": iv_col, "B": float(model_m.params[iv_c]), "SE": float(model_m.bse[iv_c]), "t": float(model_m.tvalues[iv_c]), "p": float(model_m.pvalues[iv_c])},
                    {"name": mod_col, "B": float(model_m.params[mod_c]), "SE": float(model_m.bse[mod_c]), "t": float(model_m.tvalues[mod_c]), "p": float(model_m.pvalues[mod_c])},
                    {"name": f"{iv_col} X {mod_col}", "B": float(model_m.params[int_col]), "SE": float(model_m.bse[int_col]), "t": float(model_m.tvalues[int_col]), "p": float(model_m.pvalues[int_col])}
                ]
            },
            "y_model": {
                "r_squared": float(model_y.rsquared), "f_value": float(model_y.fvalue), "f_p_value": float(model_y.f_pvalue), "delta_r_squared": 0.0,
                "coefficients": [
                    {"name": "상수", "B": float(model_y.params['const']), "SE": float(model_y.bse['const']), "t": float(model_y.tvalues['const']), "p": float(model_y.pvalues['const'])},
                    {"name": iv_col, "B": float(model_y.params[iv_c]), "SE": float(model_y.bse[iv_c]), "t": float(model_y.tvalues[iv_c]), "p": float(model_y.pvalues[iv_c])},
                    {"name": med_col, "B": float(model_y.params[med_c]), "SE": float(model_y.bse[med_c]), "t": float(model_y.tvalues[med_c]), "p": float(model_y.pvalues[med_c])}
                ]
            },
            "conditional_effects": cond_effects,
            "index_of_moderated_mediation": {
                "index": index_med,
                "se": np.std(boot_index) if n_boot > 0 else 0,
                "llci": np.percentile(boot_index, 2.5) if n_boot > 0 else 0,
                "ulci": np.percentile(boot_index, 97.5) if n_boot > 0 else 0
            }
        }
    else:
        # Default Model 14
        int_col = f"{med_c}X{mod_c}"
        df_clean[int_col] = df_clean[med_c] * df_clean[mod_c]
        
        # M Model: IV -> Med
        X_m = df_clean[iv_c]
        X_m = sm.add_constant(X_m)
        y_m = df_clean[med_c]
        model_m = sm.OLS(y_m, X_m).fit()
        
        # Y Model: IV + Med + Mod + Interaction -> DV
        X_y = df_clean[[iv_c, med_c, mod_c, int_col]]
        X_y = sm.add_constant(X_y)
        y_y = df_clean[dv_col]
        model_y = sm.OLS(y_y, X_y).fit()
        
        a = model_m.params[iv_c]
        b1 = model_y.params[med_c]
        b2 = model_y.params[int_col]
        
        boot_samples = {w['label']: [] for w in w_values}
        boot_index = []
        
        if n_boot > 0:
            for _ in range(n_boot):
                idx = rng.choice(df_clean.index, size=len(df_clean), replace=True)
                boot_df = df_clean.loc[idx]
                
                X_m_b = sm.add_constant(boot_df[iv_c])
                model_m_b = sm.OLS(boot_df[med_c], X_m_b).fit()
                a_b = model_m_b.params[iv_c]
                
                X_y_b = sm.add_constant(boot_df[[iv_c, med_c, mod_c, int_col]])
                model_y_b = sm.OLS(boot_df[dv_col], X_y_b).fit()
                b1_b = model_y_b.params[med_c]
                b2_b = model_y_b.params[int_col]
                
                boot_index.append(a_b * b2_b)
                for w in w_values:
                    boot_samples[w['label']].append(a_b * (b1_b + b2_b * w['val']))
                    
        cond_effects = []
        for w in w_values:
            eff = a * (b1 + b2 * w['val'])
            se = np.std(boot_samples[w['label']]) if n_boot > 0 else 0
            cond_effects.append({
                "w_label": w['label'], "w_value": w['real_val'], "effect": eff, "se": se,
                "t": eff/se if se>0 else 0,
                "llci": np.percentile(boot_samples[w['label']], 2.5) if n_boot > 0 else 0,
                "ulci": np.percentile(boot_samples[w['label']], 97.5) if n_boot > 0 else 0
            })
            
        index_med = a * b2
        
        return {
            "m_model": {
                "r_squared": float(model_m.rsquared), "f_value": float(model_m.fvalue), "f_p_value": float(model_m.f_pvalue),
                "coefficients": [
                    {"name": "상수", "B": float(model_m.params['const']), "SE": float(model_m.bse['const']), "t": float(model_m.tvalues['const']), "p": float(model_m.pvalues['const'])},
                    {"name": iv_col, "B": float(model_m.params[iv_c]), "SE": float(model_m.bse[iv_c]), "t": float(model_m.tvalues[iv_c]), "p": float(model_m.pvalues[iv_c])}
                ]
            },
            "y_model": {
                "r_squared": float(model_y.rsquared), "f_value": float(model_y.fvalue), "f_p_value": float(model_y.f_pvalue), "delta_r_squared": 0.0,
                "coefficients": [
                    {"name": "상수", "B": float(model_y.params['const']), "SE": float(model_y.bse['const']), "t": float(model_y.tvalues['const']), "p": float(model_y.pvalues['const'])},
                    {"name": iv_col, "B": float(model_y.params[iv_c]), "SE": float(model_y.bse[iv_c]), "t": float(model_y.tvalues[iv_c]), "p": float(model_y.pvalues[iv_c])},
                    {"name": med_col, "B": float(model_y.params[med_c]), "SE": float(model_y.bse[med_c]), "t": float(model_y.tvalues[med_c]), "p": float(model_y.pvalues[med_c])},
                    {"name": mod_col, "B": float(model_y.params[mod_c]), "SE": float(model_y.bse[mod_c]), "t": float(model_y.tvalues[mod_c]), "p": float(model_y.pvalues[mod_c])},
                    {"name": f"{med_col} X {mod_col}", "B": float(model_y.params[int_col]), "SE": float(model_y.bse[int_col]), "t": float(model_y.tvalues[int_col]), "p": float(model_y.pvalues[int_col])}
                ]
            },
            "conditional_effects": cond_effects,
            "index_of_moderated_mediation": {
                "index": index_med,
                "se": np.std(boot_index) if n_boot > 0 else 0,
                "llci": np.percentile(boot_index, 2.5) if n_boot > 0 else 0,
                "ulci": np.percentile(boot_index, 97.5) if n_boot > 0 else 0
            }
        }
