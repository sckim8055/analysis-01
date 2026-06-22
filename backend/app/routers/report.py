from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
import os
import io

import pingouin as pg
from factor_analyzer import FactorAnalyzer

from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

router = APIRouter()

class ReportConfig(BaseModel):
    format: str
    project_config: Dict[str, Any]

@router.post("/full-report")
async def generate_full_report(request: ReportConfig):
    file_path = "data/uploaded_data.csv"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="데이터 파일이 없습니다.")
    
    df = pd.read_csv(file_path)
    config = request.project_config
    
    if request.format == 'word':
        doc = Document()
        
        # Title
        title = doc.add_heading("통계 분석 전체 보고서", level=0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # 1. 인구통계학적 특성 (빈도분석)
        demographics = config.get("demographicColumns", [])
        if demographics:
            doc.add_heading("1. 조사대상자의 일반적 특성", level=1)
            doc.add_paragraph("본 연구의 조사대상자에 대한 인구통계학적 특성은 다음과 같다.")
            
            table = doc.add_table(rows=1, cols=4)
            table.style = 'Table Grid'
            hdr_cells = table.rows[0].cells
            hdr_cells[0].text = '구분'
            hdr_cells[1].text = '범주'
            hdr_cells[2].text = '빈도(N)'
            hdr_cells[3].text = '비율(%)'
            
            total_n = len(df)
            for col in demographics:
                if col in df.columns:
                    counts = df[col].value_counts(dropna=False).sort_index()
                    for idx, (val, count) in enumerate(counts.items()):
                        category = "결측 (Missing)" if pd.isna(val) else str(val)
                        pct = round((count / total_n) * 100, 1) if total_n > 0 else 0
                        
                        row_cells = table.add_row().cells
                        row_cells[0].text = col if idx == 0 else ""
                        row_cells[1].text = category
                        row_cells[2].text = str(int(count))
                        row_cells[3].text = str(pct)
            
            row_cells = table.add_row().cells
            row_cells[0].text = "전체"
            row_cells[2].text = str(total_n)
            row_cells[3].text = "100.0"

        # 2. 신뢰도 분삭
        mappedVars = config.get("mappedVars", {})
        excludedItems = config.get("excludedItems", {})
        
        all_factors = []
        for vType in ['iv', 'dv', 'med', 'mod']:
            for var in mappedVars.get(vType, []):
                # 프론트엔드 Variable 타입의 필드명은 'itemIds' (items가 아님)
                raw_items = var.get('itemIds', []) or var.get('items', [])
                items = [item for item in raw_items if item not in excludedItems.get(var.get('id', ''), [])]
                all_factors.append({
                    "name": var.get('name', ''),
                    "items": items
                })
        
        if all_factors:
            doc.add_heading("2. 측정항목의 신뢰도", level=1)
            doc.add_paragraph("측정 도구의 신뢰도를 검증하기 위해 Cronbach's α 계수를 산출한 결과는 다음과 같다.")
            
            table = doc.add_table(rows=1, cols=3)
            table.style = 'Table Grid'
            hdr_cells = table.rows[0].cells
            hdr_cells[0].text = '요인 (변수)'
            hdr_cells[1].text = '문항 수'
            hdr_cells[2].text = "Cronbach's α"
            
            for factor in all_factors:
                items = [i for i in factor['items'] if i in df.columns]
                if len(items) >= 2:
                    df_f = df[items].apply(pd.to_numeric, errors='coerce').dropna()
                    try:
                        alpha_val = pg.cronbach_alpha(data=df_f)[0]
                    except:
                        alpha_val = 0.0
                    
                    row_cells = table.add_row().cells
                    row_cells[0].text = factor['name']
                    row_cells[1].text = str(len(items))
                    row_cells[2].text = f"{alpha_val:.3f}"

        # 3. 추가 분석 결과 생략 (시간 관계상 데모에서는 생략하거나 추가 개발 가능)
        doc.add_heading("3. 추가 분석", level=1)
        doc.add_paragraph("상관관계, T-검정, 다중회귀분석 등의 전체 결과가 이어집니다. (이곳에 추가 개발 가능)")

        # 파일 저장
        output_path = "data/Full_Report.docx"
        doc.save(output_path)
        return FileResponse(path=output_path, filename="Full_Report.docx", media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        
    elif request.format == 'excel':
        # Excel 로직 (일단 임시로 빈 시트들)
        output_path = "data/Full_Report.xlsx"
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            pd.DataFrame([{"Message": "Excel 보고서는 준비 중입니다."}]).to_excel(writer, index=False, sheet_name="Info")
            
        return FileResponse(path=output_path, filename="Full_Report.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 포맷입니다.")
