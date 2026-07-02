import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import json

def generate_excel_report(output_path, request, df):
    wb = Workbook()
    wb.remove(wb.active) # Remove default sheet

    # Define some styles
    header_fill = PatternFill(start_color="D3D3D3", end_color="D3D3D3", fill_type="solid")
    header_font = Font(bold=True)
    center_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    def apply_header_style(ws, row, col_start, col_end):
        for c in range(col_start, col_end + 1):
            cell = ws.cell(row=row, column=c)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align
            cell.border = thin_border

    def apply_data_style(ws, row, col_start, col_end):
        for c in range(col_start, col_end + 1):
            cell = ws.cell(row=row, column=c)
            cell.border = thin_border

    # 1. Audit Logs
    ws_audit = wb.create_sheet("변경 이력 (Audit Logs)")
    ws_audit.append(["시간", "단계", "액션", "상세 내용"])
    apply_header_style(ws_audit, 1, 1, 4)
    ws_audit.column_dimensions['A'].width = 25
    ws_audit.column_dimensions['B'].width = 20
    ws_audit.column_dimensions['C'].width = 30
    ws_audit.column_dimensions['D'].width = 80
    
    if request.auditLogs:
        for r_idx, log in enumerate(request.auditLogs, start=2):
            details = log.get('details', '')
            if isinstance(details, (dict, list)):
                details_str = json.dumps(details, ensure_ascii=False)
            else:
                details_str = str(details)
            ws_audit.append([log.get('timestamp', ''), log.get('step', ''), log.get('action', ''), details_str])
            apply_data_style(ws_audit, r_idx, 1, 4)
    else:
        ws_audit.append(["기록이 없습니다.", "", "", ""])

    # 2. Cleansed Data
    ws_data = wb.create_sheet("정제된 데이터 (Data)")
    columns = list(df.columns)
    ws_data.append(columns)
    apply_header_style(ws_data, 1, 1, len(columns))
    for r_idx, row in enumerate(df.itertuples(index=False), start=2):
        ws_data.append(list(row))
        # Optional: styling every data cell is slow for large datasets. Skip border styling for raw data.

    # 3. Mapping & Settings
    ws_map = wb.create_sheet("설정 및 매핑 (Settings)")
    ws_map.append(["유형", "역할", "매핑된 변수 목록"])
    apply_header_style(ws_map, 1, 1, 3)
    ws_map.column_dimensions['A'].width = 15
    ws_map.column_dimensions['B'].width = 25
    ws_map.column_dimensions['C'].width = 60
    
    role_names = {
        'iv': '독립변수 (IV)',
        'dv': '종속변수 (DV)',
        'med': '매개변수 (Mediator)',
        'mod': '조절변수 (Moderator)',
        'gen': '인구통계/통제변수'
    }
    
    r_idx = 2
    if 'mappedVars' in request.project_config:
        for role, vars in request.project_config['mappedVars'].items():
            for v in vars:
                ws_map.append([role_names.get(role, role), v.get('name', ''), ", ".join(v.get('itemIds', []))])
                apply_data_style(ws_map, r_idx, 1, 3)
                r_idx += 1

    # 4. Cached Results
    if request.cachedResults:
        for key, cache in request.cachedResults.items():
            results = cache.get("results", {})
            settings = cache.get("settings", {})
            interpretation = cache.get("interpretation", "")
            
            # Create a sheet for each analysis type
            safe_title = str(key)[:31]
            ws = wb.create_sheet(safe_title)
            
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
            
            # Simple flattening for results if it's a dict/list to avoid complexity,
            # but try to make it look like a table
            if isinstance(results, dict):
                if key == 'correlation':
                    # Extract corr matrix if present
                    if 'matrix' in results:
                        mat = results['matrix']
                        labels = list(mat.keys())
                        ws.cell(row=curr_row, column=1, value="변수명").fill = header_fill
                        for i, l in enumerate(labels):
                            ws.cell(row=curr_row, column=i+2, value=l).fill = header_fill
                        curr_row += 1
                        for l in labels:
                            ws.cell(row=curr_row, column=1, value=l)
                            for i, c_l in enumerate(labels):
                                val = mat[l].get(c_l, "")
                                ws.cell(row=curr_row, column=i+2, value=val)
                            curr_row += 1
                    curr_row += 1
                elif key == 'ttest':
                    if 'desc_stats' in results:
                        ws.append(["변수명", "하위요인", "평균", "표준편차"])
                        curr_row += 1
                        for st in results['desc_stats']:
                            ws.append([st.get('parent',''), st.get('name',''), st.get('mean',''), st.get('sd','')])
                            curr_row += 1
                    curr_row += 1
                    if 'diff_results' in results:
                        for diff in results['diff_results']:
                            ws.cell(row=curr_row, column=1, value=f"인구통계 변수: {diff.get('demographic','')}").font = header_font
                            curr_row += 1
                            ws.append(["측정 변수", "그룹", "평균", "표준편차", "통계량", "유의확률(p)"])
                            curr_row += 1
                            for f_name, f_data in diff.get('factors', {}).items():
                                groups = f_data.get('groups', [])
                                if groups:
                                    # Print first group with stats
                                    ws.append([f_name, groups[0].get('group_name'), groups[0].get('mean'), groups[0].get('sd'), f_data.get('statistic'), f_data.get('p_value')])
                                    curr_row += 1
                                    # Print rest of groups
                                    for g in groups[1:]:
                                        ws.append(["", g.get('group_name'), g.get('mean'), g.get('sd'), "", ""])
                                        curr_row += 1
                            curr_row += 1
                elif key == 'regression':
                    if 'model_summary' in results:
                        ws.cell(row=curr_row, column=1, value="[모형 요약]").font = header_font
                        curr_row += 1
                        ws.append(["R", "R Square", "Adj R Square", "F", "p-value"])
                        curr_row += 1
                        ms = results['model_summary']
                        ws.append([ms.get('r',''), ms.get('r_square',''), ms.get('adj_r_square',''), ms.get('f_stat',''), ms.get('p_value','')])
                        curr_row += 2
                    if 'coefficients' in results:
                        ws.cell(row=curr_row, column=1, value="[회귀 계수]").font = header_font
                        curr_row += 1
                        ws.append(["독립변수", "B", "표준오차", "Beta", "t", "유의확률(p)", "VIF"])
                        curr_row += 1
                        for c in results['coefficients']:
                            ws.append([c.get('name',''), c.get('B',''), c.get('std_err',''), c.get('beta',''), c.get('t_stat',''), c.get('p_value',''), c.get('vif','')])
                            curr_row += 1
                        curr_row += 2
                else:
                    # Fallback flat dict dump
                    ws.cell(row=curr_row, column=1, value=json.dumps(results, ensure_ascii=False))
                    curr_row += 1
            else:
                ws.cell(row=curr_row, column=1, value=json.dumps(results, ensure_ascii=False))
                curr_row += 1
                
            curr_row += 1
            ws.cell(row=curr_row, column=1, value="[자동 해석 및 결론]").font = header_font
            curr_row += 1
            # Split interpretation by newline and put in cells
            for line in interpretation.split('\n'):
                ws.cell(row=curr_row, column=1, value=line)
                curr_row += 1

    wb.save(output_path)
