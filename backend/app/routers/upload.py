import io
import os
import pandas as pd
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any
from ..store import set_project_data, get_project_data

router = APIRouter()

class UploadResponse(BaseModel):
    project_id: str
    filename: str
    columns: List[str]
    row_count: int

@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        if file.filename.endswith('.csv'):
            # try multiple encodings for csv (utf-8, cp949 for korean windows)
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(contents), encoding='cp949')
        elif file.filename.endswith('.xlsx') or file.filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")
            
        project_id = "test-project-1" # 프로토타입용 고정 ID
        
        # 파일명을 안전하게 저장하고 DataFrame을 메모리에 캐시
        set_project_data(project_id, df, file.filename)
        
        # analysis.py 등 다른 곳에서 읽을 수 있도록 파일로도 저장
        os.makedirs("data", exist_ok=True)
        df.to_csv("data/uploaded_data.csv", index=False)
        
        return {
            "project_id": project_id,
            "filename": file.filename,
            "columns": df.columns.tolist(),
            "row_count": len(df)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data/smart")
async def get_smart_data():
    df = _get_active_df()
    if df is None:
        raise HTTPException(status_code=404, detail="업로드된 데이터가 없습니다.")

    abnormal_mask = df.isna().any(axis=1)
    for col in df.select_dtypes(include=[np.number]).columns:
        abnormal_mask = abnormal_mask | (df[col] < 0) | (df[col] > 100)
        
    abnormal_df = df[abnormal_mask].copy()

    result = []
    columns = df.columns.tolist()
    
    for idx, row in abnormal_df.iterrows():
        row_dict = {"id": int(idx)} 
        for col in columns:
            val = row[col]
            if pd.isna(val):
                row_dict[col] = None
            elif hasattr(val, 'item'):
                row_dict[col] = val.item()
            else:
                row_dict[col] = val
            
        result.append(row_dict)

    return {
        "columns": ["id"] + columns,
        "total_rows": len(df),
        "abnormal_count": len(result),
        "data": result
    }

def _get_active_df():
    df = get_project_data("test-project-1")
    if df is None:
        file_path = "data/uploaded_data.csv"
        if os.path.exists(file_path):
            df = pd.read_csv(file_path)
            set_project_data("test-project-1", df, "uploaded_data.csv")
    return df

class RecodeRequest(BaseModel):
    column_name: str
    old_values: List[Any]
    new_value: Any

@router.post("/data/recode")
async def recode_data(req: RecodeRequest):
    df = _get_active_df()
    if df is None:
        raise HTTPException(status_code=404, detail="업로드된 데이터가 없습니다.")
        
    try:
        if req.column_name not in df.columns:
            raise HTTPException(status_code=400, detail="존재하지 않는 컬럼입니다.")
            
        # Convert column to string for safe replacement if old_values are strings
        df[req.column_name] = df[req.column_name].astype(str)
        
        # Replace values
        df[req.column_name] = df[req.column_name].replace(req.old_values, req.new_value)
        
        # Save back to store and disk
        set_project_data("test-project-1", df, "uploaded_data.csv")
        df.to_csv("data/uploaded_data.csv", index=False)
        
        return {"success": True, "message": "성공적으로 병합되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DropValuesRequest(BaseModel):
    column_name: str
    values_to_drop: List[Any]

@router.post("/data/drop_values")
async def drop_data_values(req: DropValuesRequest):
    df = _get_active_df()
    if df is None:
        raise HTTPException(status_code=404, detail="업로드된 데이터가 없습니다.")
        
    try:
        if req.column_name not in df.columns:
            raise HTTPException(status_code=400, detail="존재하지 않는 컬럼입니다.")
            
        # Drop rows where column value is in values_to_drop (convert to str to match)
        original_len = len(df)
        df = df[~df[req.column_name].astype(str).isin(req.values_to_drop)]
        new_len = len(df)
        
        # Save back to store and disk
        set_project_data("test-project-1", df, "uploaded_data.csv")
        df.to_csv("data/uploaded_data.csv", index=False)
        
        return {
            "success": True, 
            "message": f"성공적으로 제외되었습니다. (삭제된 행: {original_len - new_len}개)",
            "new_total_rows": new_len
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateCellRequest(BaseModel):
    row_id: int
    column_name: str
    new_value: Any

@router.post("/data/update_cell")
async def update_cell(req: UpdateCellRequest):
    df = _get_active_df()
    if df is None:
        raise HTTPException(status_code=404, detail="데이터가 없습니다.")
        
    try:
        if req.column_name not in df.columns:
            raise HTTPException(status_code=400, detail="존재하지 않는 컬럼입니다.")
        
        if req.row_id not in df.index:
            raise HTTPException(status_code=400, detail="존재하지 않는 행입니다.")
            
        # Update value
        df.at[req.row_id, req.column_name] = req.new_value
        
        # Save back to store and disk
        set_project_data("test-project-1", df, "uploaded_data.csv")
        df.to_csv("data/uploaded_data.csv", index=False)
        
        return {"success": True, "message": "셀이 성공적으로 수정되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ReverseCodeRequest(BaseModel):
    columns: List[str]
    min_val: float
    max_val: float

@router.post("/data/reverse_code")
async def reverse_code(req: ReverseCodeRequest):
    df = _get_active_df()
    if df is None:
        raise HTTPException(status_code=404, detail="데이터가 없습니다.")
        
    try:
        for col in req.columns:
            if col not in df.columns:
                continue
            # (Max + Min) - Value
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col] = (req.max_val + req.min_val) - df[col]
            
        # Save back to store and disk
        set_project_data("test-project-1", df, "uploaded_data.csv")
        df.to_csv("data/uploaded_data.csv", index=False)
        
        return {"success": True, "message": "성공적으로 역코딩되었습니다."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data/download")
async def download_data():
    df = _get_active_df()
    if df is None:
        raise HTTPException(status_code=404, detail="업로드된 데이터가 없습니다.")
    
    excel_path = "data/cleansed_data.xlsx"
    df.to_excel(excel_path, index=False)
    
    return FileResponse(
        path=excel_path, 
        filename="cleansed_data.xlsx", 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
