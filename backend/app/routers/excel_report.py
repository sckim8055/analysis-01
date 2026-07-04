import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import json

def generate_excel_report(output_path, request, df):
    wb = Workbook()
    wb.remove(wb.active)

    header_fill = PatternFill(start_color="D3D3D3", end_color="D3D3D3", fill_type="solid")
    header_font = Font(bold=True)
    center_align = Alignment(horizontal="center", vertical="center")
    left_align = Alignment(horizontal="left", vertical="center")
    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    def format_cell(ws, row, col, value, is_header=False, align='center'):
        cell = ws.cell(row=row, column=col, value=value)
        cell.border = thin_border
        if is_header:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align
        else:
            cell.alignment = center_align if align == 'center' else left_align
        return cell

    # 1. Audit Logs
    ws_audit = wb.create_sheet("변경 이력(Data Cleansing)")
    headers = ["시간", "단계", "액션", "상세 내용"]
    for c, h in enumerate(headers, 1):
        format_cell(ws_audit, 1, c, h, is_header=True)
    ws_audit.column_dimensions['A'].width = 25
    ws_audit.column_dimensions['B'].width = 20
    ws_audit.column_dimensions['C'].width = 30
    ws_audit.column_dimensions['D'].width = 80
    
    if request.auditLogs:
        for r_idx, log in enumerate(request.auditLogs, start=2):
            details = log.get('details', '')
            action = log.get('action', '')
            details_str = ""
            if isinstance(details, dict):
                if action in ['결측치 수정', '셀 값 수정']:
                    row_id = details.get('rowId', '')
                    col_id = details.get('columnId', '')
                    old_v = details.get('oldValue', '결측치(null)')
                    new_v = details.get('newValue', '결측치(null)')
                    if old_v is None: old_v = '결측치(null)'
                    if new_v is None: new_v = '결측치(null)'
                    details_str = f"[{row_id}번 응답자] '{col_id}' 문항의 값 변경: {old_v} -> {new_v}"
                elif action == '역코딩 적용':
                    cols = details.get('columns', [])
                    details_str = f"문항 {', '.join(cols)} 역코딩 적용 (범위: {details.get('min', 1)}~{details.get('max', 5)})"
                elif action == '항목 삭제':
                    details_str = f"문항 '{details.get('itemId', '')}' 삭제 처리"
                else:
                    details_str = json.dumps(details, ensure_ascii=False)
            else:
                details_str = str(details)
                
            format_cell(ws_audit, r_idx, 1, log.get('timestamp', ''))
            format_cell(ws_audit, r_idx, 2, log.get('step', ''))
            format_cell(ws_audit, r_idx, 3, action)
            format_cell(ws_audit, r_idx, 4, details_str, align='left')
    else:
        format_cell(ws_audit, 2, 1, "기록이 없습니다.")
        for c in range(2, 5): format_cell(ws_audit, 2, c, "")

    # 2. Data
    ws_data = wb.create_sheet("정제된 데이터 (Data)")
    columns = list(df.columns)
    for c, h in enumerate(columns, 1):
        format_cell(ws_data, 1, c, h, is_header=True)
    for r_idx, row in enumerate(df.itertuples(index=False), start=2):
        for c_idx, val in enumerate(row, start=1):
            ws_data.cell(row=r_idx, column=c_idx, value=val)

    # 3. Settings
    ws_map = wb.create_sheet("설정 및 매핑 (Settings)")
    headers = ["유형", "역할", "매핑된 변수 목록"]
    for c, h in enumerate(headers, 1):
        format_cell(ws_map, 1, c, h, is_header=True)
    ws_map.column_dimensions['A'].width = 15
    ws_map.column_dimensions['B'].width = 25
    ws_map.column_dimensions['C'].width = 60
    
    role_names = {
        'iv': '독립변수 (IV)', 'dv': '종속변수 (DV)', 'med': '매개변수 (Mediator)',
        'mod': '조절변수 (Moderator)', 'gen': '인구통계/통제변수'
    }
    
    r_idx = 2
    if 'mappedVars' in request.project_config:
        for role, vars in request.project_config['mappedVars'].items():
            for v in vars:
                format_cell(ws_map, r_idx, 1, role_names.get(role, role))
                format_cell(ws_map, r_idx, 2, v.get('name', ''))
                format_cell(ws_map, r_idx, 3, ", ".join(v.get('itemIds', [])), align='left')
                r_idx += 1

    # 4. Results
    if request.cachedResults:
        for key, cache in request.cachedResults.items():
            results = cache.get("results", {})
            settings = cache.get("settings", {})
            interpretation = cache.get("interpretation", "")
            
            safe_title = str(key)[:31]
            ws = wb.create_sheet(safe_title)
            ws.column_dimensions['A'].width = 20
            ws.column_dimensions['B'].width = 20
            
            curr_row = 1
            ws.cell(row=curr_row, column=1, value="[분석 옵션 및 설정]").font = header_font
            curr_row += 1
            for sk, sv in settings.items():
                ws.cell(row=curr_row, column=1, value=str(sk))
                ws.cell(row=curr_row, column=2, value=str(sv))
                curr_row += 1
            curr_row += 1
            
            ws.cell(row=curr_row, column=1, value="[분석 결과 데이터]").font = header_font
            curr_row += 1
            
            parsed = False
            try:
                if key == 'efa':
                    if 'loadings' in results:
                        loadings = results['loadings']
                        factors = list(list(loadings.values())[0].keys()) if loadings else []
                        headers = ["항목"] + factors + ["공통성"]
                        for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                        curr_row += 1
                        
                        items = list(loadings.keys())
                        for item in items:
                            format_cell(ws, curr_row, 1, item)
                            c_idx = 2
                            for f in factors:
                                val = loadings[item].get(f, '')
                                format_cell(ws, curr_row, c_idx, round(val, 3) if isinstance(val, float) else val)
                                c_idx += 1
                            comm = results.get('communalities', {}).get(item, '')
                            format_cell(ws, curr_row, c_idx, round(comm, 3) if isinstance(comm, float) else comm)
                            curr_row += 1
                        
                        var_exp = results.get('variance_explained', {})
                        if var_exp and 'eigenvalues' in var_exp:
                            format_cell(ws, curr_row, 1, "고유값")
                            c_idx = 2
                            for i, f in enumerate(factors):
                                val = var_exp['eigenvalues'][i]
                                format_cell(ws, curr_row, c_idx, round(val, 3) if isinstance(val, float) else val)
                                c_idx += 1
                            format_cell(ws, curr_row, c_idx, "")
                            curr_row += 1
                            
                            format_cell(ws, curr_row, 1, "분산 설명력(%)")
                            c_idx = 2
                            for i, f in enumerate(factors):
                                val = var_exp['variance_pct'][i]
                                format_cell(ws, curr_row, c_idx, round(val, 2) if isinstance(val, float) else val)
                                c_idx += 1
                            format_cell(ws, curr_row, c_idx, "")
                            curr_row += 1
                            
                            format_cell(ws, curr_row, 1, "누적 설명력(%)")
                            c_idx = 2
                            for i, f in enumerate(factors):
                                val = var_exp['cumulative_pct'][i]
                                format_cell(ws, curr_row, c_idx, round(val, 2) if isinstance(val, float) else val)
                                c_idx += 1
                            format_cell(ws, curr_row, c_idx, "")
                            curr_row += 1
                        
                        curr_row += 1
                        ws.cell(row=curr_row, column=1, value=f"KMO Measure of Sampling Adequacy: {round(results.get('kmo',0),3)}")
                        curr_row += 1
                        ws.cell(row=curr_row, column=1, value=f"Bartlett's Test of Sphericity: Approx. Chi-Square = {round(results.get('bartlett_chi_square',0),3)}, df = {results.get('bartlett_df',0)}, p = {round(results.get('bartlett_p_value',1),3)}")
                        curr_row += 1
                        parsed = True
                        
                elif key == 'reliability':
                    if isinstance(results, dict):
                        headers = ["요인", "문항", "항목 삭제시 크론바흐 알파", "크론바흐 알파"]
                        for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                        curr_row += 1
                        
                        for factor, data in results.items():
                            items = data.get('items', [])
                            item_alphas = data.get('item_alpha_if_deleted', {})
                            ca = data.get('cronbach_alpha', '')
                            if items:
                                format_cell(ws, curr_row, 1, factor)
                                format_cell(ws, curr_row, 2, items[0])
                                val = item_alphas.get(items[0], '')
                                format_cell(ws, curr_row, 3, round(val, 3) if isinstance(val, float) else val)
                                format_cell(ws, curr_row, 4, round(ca, 3) if isinstance(ca, float) else ca)
                                curr_row += 1
                                for item in items[1:]:
                                    format_cell(ws, curr_row, 1, factor)
                                    format_cell(ws, curr_row, 2, item)
                                    val = item_alphas.get(item, '')
                                    format_cell(ws, curr_row, 3, round(val, 3) if isinstance(val, float) else val)
                                    format_cell(ws, curr_row, 4, "")
                                    curr_row += 1
                        parsed = True
                        
                elif key == 'frequency':
                    if isinstance(results, dict):
                        for var_name, data in results.items():
                            ws.cell(row=curr_row, column=1, value=f"[{var_name}]").font = header_font
                            curr_row += 1
                            headers = ["구분", "빈도수(명)", "비율(%)", "유효비율(%)", "누적비율(%)"]
                            for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                            curr_row += 1
                            
                            freq = data.get('frequency', {})
                            pct = data.get('percent', {})
                            vpct = data.get('valid_percent', {})
                            cpct = data.get('cumulative_percent', {})
                            
                            for cat in freq.keys():
                                if cat in ['Total', 'Missing']: continue
                                format_cell(ws, curr_row, 1, str(cat))
                                format_cell(ws, curr_row, 2, freq.get(cat, ''))
                                format_cell(ws, curr_row, 3, round(pct.get(cat, 0), 1))
                                format_cell(ws, curr_row, 4, round(vpct.get(cat, 0), 1))
                                format_cell(ws, curr_row, 5, round(cpct.get(cat, 0), 1))
                                curr_row += 1
                                
                            format_cell(ws, curr_row, 1, "Total(Valid)")
                            format_cell(ws, curr_row, 2, freq.get('Total', ''))
                            format_cell(ws, curr_row, 3, round(pct.get('Total', 0), 1))
                            format_cell(ws, curr_row, 4, "100.0")
                            format_cell(ws, curr_row, 5, "")
                            curr_row += 1
                            
                            if 'Missing' in freq and freq['Missing'] > 0:
                                format_cell(ws, curr_row, 1, "Missing")
                                format_cell(ws, curr_row, 2, freq.get('Missing', ''))
                                format_cell(ws, curr_row, 3, round(pct.get('Missing', 0), 1))
                                format_cell(ws, curr_row, 4, "")
                                format_cell(ws, curr_row, 5, "")
                                curr_row += 1
                            curr_row += 1
                        parsed = True

                elif key == 'ttest':
                    if 'diff_results' in results:
                        for diff in results['diff_results']:
                            demo = diff.get('demographic', '')
                            ws.cell(row=curr_row, column=1, value=f"인구통계 변수: {demo}").font = header_font
                            curr_row += 1
                            
                            headers = ["측정 변수", "구분", "N", "평균", "표준편차", "t/F값", "유의확률(p)"]
                            has_posthoc = any(f.get('post_hoc') for f in diff.get('factors', {}).values())
                            if has_posthoc:
                                headers.append("사후검정")
                            for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                            curr_row += 1
                            
                            for f_name, f_data in diff.get('factors', {}).items():
                                groups = f_data.get('groups', [])
                                stat = f_data.get('statistic')
                                p = f_data.get('p_value')
                                ph = f_data.get('post_hoc', '')
                                
                                stat_str = round(stat, 3) if isinstance(stat, float) else stat
                                p_str = round(p, 3) if isinstance(p, float) else p
                                
                                if groups:
                                    g0 = groups[0]
                                    format_cell(ws, curr_row, 1, f_name)
                                    format_cell(ws, curr_row, 2, g0.get('group_name'))
                                    format_cell(ws, curr_row, 3, g0.get('n'))
                                    format_cell(ws, curr_row, 4, round(g0.get('mean'), 3) if isinstance(g0.get('mean'), float) else g0.get('mean'))
                                    format_cell(ws, curr_row, 5, round(g0.get('sd'), 3) if isinstance(g0.get('sd'), float) else g0.get('sd'))
                                    format_cell(ws, curr_row, 6, stat_str)
                                    format_cell(ws, curr_row, 7, p_str)
                                    if has_posthoc:
                                        format_cell(ws, curr_row, 8, ph)
                                    curr_row += 1
                                    
                                    for g in groups[1:]:
                                        format_cell(ws, curr_row, 1, f_name)
                                        format_cell(ws, curr_row, 2, g.get('group_name'))
                                        format_cell(ws, curr_row, 3, g.get('n'))
                                        format_cell(ws, curr_row, 4, round(g.get('mean'), 3) if isinstance(g.get('mean'), float) else g.get('mean'))
                                        format_cell(ws, curr_row, 5, round(g.get('sd'), 3) if isinstance(g.get('sd'), float) else g.get('sd'))
                                        format_cell(ws, curr_row, 6, "")
                                        format_cell(ws, curr_row, 7, "")
                                        if has_posthoc: format_cell(ws, curr_row, 8, "")
                                        curr_row += 1
                            curr_row += 1
                        parsed = True

                elif key == 'correlation':
                    if 'factor_names' in results:
                        names = results['factor_names']
                        mat_r = results.get('matrix_r', [])
                        mat_p = results.get('matrix_p', [])
                        
                        headers = ["구분"] + names
                        for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                        curr_row += 1
                        
                        for i, name in enumerate(names):
                            format_cell(ws, curr_row, 1, name)
                            for j in range(len(names)):
                                if i == j:
                                    format_cell(ws, curr_row, j+2, "1")
                                elif j < i:
                                    r = mat_r[i][j]
                                    p = mat_p[i][j]
                                    if r is None:
                                        format_cell(ws, curr_row, j+2, "-")
                                    else:
                                        stars = ""
                                        if p is not None:
                                            if p < 0.001: stars = "***"
                                            elif p < 0.01: stars = "**"
                                            elif p < 0.05: stars = "*"
                                        val_str = f"{r:.3f}".replace("0.", ".") + stars
                                        format_cell(ws, curr_row, j+2, val_str)
                                else:
                                    format_cell(ws, curr_row, j+2, "")
                            curr_row += 1
                        parsed = True

                elif key.startswith('regression'):
                    if 'models' in results:
                        for idx, model in enumerate(results['models'], 1):
                            ws.cell(row=curr_row, column=1, value=f"[Model {idx}] {model.get('model_name', '')}").font = header_font
                            curr_row += 1
                            
                            ms = model.get('model_summary', {})
                            headers = ["R", "R²", "Adj R²", "F값", "유의확률(p)"]
                            for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                            curr_row += 1
                            
                            format_cell(ws, curr_row, 1, round(ms.get('r', 0), 3))
                            format_cell(ws, curr_row, 2, round(ms.get('r_square', 0), 3))
                            format_cell(ws, curr_row, 3, round(ms.get('adj_r_square', 0), 3))
                            format_cell(ws, curr_row, 4, round(ms.get('f_stat', 0), 3))
                            format_cell(ws, curr_row, 5, round(ms.get('p_value', 1), 3))
                            curr_row += 2
                            
                            headers = ["독립변수", "B", "표준오차", "Beta", "t값", "유의확률(p)", "VIF"]
                            for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                            curr_row += 1
                            
                            for coef in model.get('coefficients', []):
                                format_cell(ws, curr_row, 1, coef.get('name', ''))
                                format_cell(ws, curr_row, 2, round(coef.get('B', 0), 3))
                                format_cell(ws, curr_row, 3, round(coef.get('std_err', 0), 3))
                                format_cell(ws, curr_row, 4, round(coef.get('beta', 0), 3) if coef.get('beta') is not None else "")
                                format_cell(ws, curr_row, 5, round(coef.get('t_stat', 0), 3))
                                format_cell(ws, curr_row, 6, round(coef.get('p_value', 1), 3))
                                format_cell(ws, curr_row, 7, round(coef.get('vif', 0), 3) if coef.get('vif') is not None else "")
                                curr_row += 1
                            curr_row += 1
                        parsed = True
                        
                elif key.startswith('mediation') or key.startswith('moderation') or key.startswith('mod_med'):
                    res_list = results.get('results', [])
                    if res_list:
                        for dvRes in res_list:
                            dv_name = dvRes.get('dv_name', '')
                            ws.cell(row=curr_row, column=1, value=f"종속변수: {dv_name}").font = header_font
                            curr_row += 1
                            
                            models = dvRes.get('models', [])
                            if models:
                                if 'model1' in models[0]:
                                    for m in models:
                                        iv_name = m.get('iv_name', 'IV')
                                        mod_name = m.get('mod_name', 'MOD')
                                        ws.cell(row=curr_row, column=1, value=f"{iv_name} * {mod_name} -> {dv_name}").font = header_font
                                        curr_row += 1
                                        headers = ["구분", "모델1 (B)", "모델2 (B)", "모델3 (B)"]
                                        for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                                        curr_row += 1
                                        
                                        rows_dict = {}
                                        for c_idx, mod_key in enumerate(['model1', 'model2', 'model3'], 2):
                                            if mod_key in m:
                                                for coef in m[mod_key].get('coefficients', []):
                                                    name = coef.get('name')
                                                    if name not in rows_dict: rows_dict[name] = ["", "", ""]
                                                    p = coef.get('p_value', 1)
                                                    stars = "***" if p<0.001 else "**" if p<0.01 else "*" if p<0.05 else ""
                                                    rows_dict[name][c_idx-2] = f"{coef.get('B',0):.3f}{stars}"
                                        
                                        for name, vals in rows_dict.items():
                                            format_cell(ws, curr_row, 1, name)
                                            for i, v in enumerate(vals): format_cell(ws, curr_row, i+2, v)
                                            curr_row += 1
                                        
                                        format_cell(ws, curr_row, 1, "R²")
                                        for i, mod_key in enumerate(['model1', 'model2', 'model3']):
                                            val = m.get(mod_key, {}).get('model_summary', {}).get('r_square', '')
                                            format_cell(ws, curr_row, i+2, round(val, 3) if isinstance(val, float) else val)
                                        curr_row += 1
                                        
                                        format_cell(ws, curr_row, 1, "F값")
                                        for i, mod_key in enumerate(['model1', 'model2', 'model3']):
                                            val = m.get(mod_key, {}).get('model_summary', {}).get('f_stat', '')
                                            format_cell(ws, curr_row, i+2, round(val, 3) if isinstance(val, float) else val)
                                        curr_row += 2
                                elif 'step1' in models[0] or 'm_model' in models[0]:
                                    for m in models:
                                        is_modmed = 'm_model' in m
                                        m_key = 'm_model' if is_modmed else 'step2'
                                        y_key = 'y_model' if is_modmed else 'step3'
                                        med_name = m.get('med_name', 'M')
                                        ws.cell(row=curr_row, column=1, value=f"매개변수: {med_name}").font = header_font
                                        curr_row += 1
                                        
                                        headers = ["구분", "매개변수모형(M)", "종속변수모형(Y)"]
                                        for c, h in enumerate(headers, 1): format_cell(ws, curr_row, c, h, is_header=True)
                                        curr_row += 1
                                        
                                        rows_dict = {}
                                        for c_idx, mod_key in enumerate([m_key, y_key], 2):
                                            if mod_key in m:
                                                for coef in m[mod_key].get('coefficients', []):
                                                    name = coef.get('name')
                                                    if name not in rows_dict: rows_dict[name] = ["", ""]
                                                    p = coef.get('p_value', 1)
                                                    stars = "***" if p<0.001 else "**" if p<0.01 else "*" if p<0.05 else ""
                                                    rows_dict[name][c_idx-2] = f"{coef.get('B',0):.3f}{stars}"
                                                    
                                        for name, vals in rows_dict.items():
                                            format_cell(ws, curr_row, 1, name)
                                            for i, v in enumerate(vals): format_cell(ws, curr_row, i+2, v)
                                            curr_row += 1
                                            
                                        format_cell(ws, curr_row, 1, "R²")
                                        for i, mod_key in enumerate([m_key, y_key]):
                                            val = m.get(mod_key, {}).get('model_summary', {}).get('r_square', '')
                                            format_cell(ws, curr_row, i+2, round(val, 3) if isinstance(val, float) else val)
                                        curr_row += 1
                                        
                                        format_cell(ws, curr_row, 1, "F값")
                                        for i, mod_key in enumerate([m_key, y_key]):
                                            val = m.get(mod_key, {}).get('model_summary', {}).get('f_stat', '')
                                            format_cell(ws, curr_row, i+2, round(val, 3) if isinstance(val, float) else val)
                                        curr_row += 2
                                        
                                        if 'sobel' in m:
                                            sobel = m['sobel']
                                            if sobel:
                                                ws.cell(row=curr_row, column=1, value="[Sobel Test]").font = header_font
                                                curr_row += 1
                                                format_cell(ws, curr_row, 1, "Z", is_header=True)
                                                format_cell(ws, curr_row, 2, "p-value", is_header=True)
                                                curr_row += 1
                                                format_cell(ws, curr_row, 1, round(sobel.get('z',0),3))
                                                format_cell(ws, curr_row, 2, round(sobel.get('p',1),3))
                                                curr_row += 2
                                        if 'bootstrap' in m:
                                            boot = m['bootstrap']
                                            if boot:
                                                ws.cell(row=curr_row, column=1, value="[Bootstrap]").font = header_font
                                                curr_row += 1
                                                format_cell(ws, curr_row, 1, "Effect", is_header=True)
                                                format_cell(ws, curr_row, 2, "SE", is_header=True)
                                                format_cell(ws, curr_row, 3, "LLCI", is_header=True)
                                                format_cell(ws, curr_row, 4, "ULCI", is_header=True)
                                                curr_row += 1
                                                format_cell(ws, curr_row, 1, round(boot.get('effect',0),3))
                                                format_cell(ws, curr_row, 2, round(boot.get('se',0),3))
                                                format_cell(ws, curr_row, 3, round(boot.get('llci',0),3))
                                                format_cell(ws, curr_row, 4, round(boot.get('ulci',0),3))
                                                curr_row += 2
                                        
                                        if 'conditional_effects' in m and m['conditional_effects']:
                                            ws.cell(row=curr_row, column=1, value="[Conditional Effects]").font = header_font
                                            curr_row += 1
                                            format_cell(ws, curr_row, 1, "조절변수 값", is_header=True)
                                            format_cell(ws, curr_row, 2, "Effect", is_header=True)
                                            format_cell(ws, curr_row, 3, "SE", is_header=True)
                                            format_cell(ws, curr_row, 4, "t", is_header=True)
                                            format_cell(ws, curr_row, 5, "p", is_header=True)
                                            curr_row += 1
                                            for ce in m['conditional_effects']:
                                                format_cell(ws, curr_row, 1, round(ce.get('mod_value',0),3))
                                                format_cell(ws, curr_row, 2, round(ce.get('effect',0),3))
                                                format_cell(ws, curr_row, 3, round(ce.get('se',0),3))
                                                format_cell(ws, curr_row, 4, round(ce.get('t',0),3))
                                                format_cell(ws, curr_row, 5, round(ce.get('p',1),3))
                                                curr_row += 1
                                            curr_row += 1
                                            
                                        if 'index_of_moderated_mediation' in m and m['index_of_moderated_mediation']:
                                            ws.cell(row=curr_row, column=1, value="[Index of Moderated Mediation]").font = header_font
                                            curr_row += 1
                                            idx_m = m['index_of_moderated_mediation']
                                            format_cell(ws, curr_row, 1, "Index", is_header=True)
                                            format_cell(ws, curr_row, 2, "SE", is_header=True)
                                            format_cell(ws, curr_row, 3, "LLCI", is_header=True)
                                            format_cell(ws, curr_row, 4, "ULCI", is_header=True)
                                            curr_row += 1
                                            format_cell(ws, curr_row, 1, round(idx_m.get('index',0),3))
                                            format_cell(ws, curr_row, 2, round(idx_m.get('se',0),3))
                                            format_cell(ws, curr_row, 3, round(idx_m.get('llci',0),3))
                                            format_cell(ws, curr_row, 4, round(idx_m.get('ulci',0),3))
                                            curr_row += 2
                        parsed = True
            except Exception as e:
                import traceback
                traceback.print_exc()
                parsed = False
                
            if not parsed:
                ws.cell(row=curr_row, column=1, value=json.dumps(results, ensure_ascii=False))
                curr_row += 1
                
            curr_row += 1
            ws.cell(row=curr_row, column=1, value="[자동 해석 및 결론]").font = header_font
            curr_row += 1
            for line in interpretation.split("\\n"):
                ws.cell(row=curr_row, column=1, value=line)
                curr_row += 1

    wb.save(output_path)
