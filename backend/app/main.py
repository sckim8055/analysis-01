from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, analysis, report, hypotheses

app = FastAPI(title="Research Analyzer API")

import traceback
from fastapi import Request
from fastapi.responses import JSONResponse
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    with open("global_error.log", "w") as f:
        f.write(traceback.format_exc())
    return JSONResponse(status_code=500, content={"message": str(exc)})

# 프론트엔드 로컬 서버(Vite)와의 통신을 허용하기 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173", 
        "https://analysis-01-wucv.vercel.app"
    ],
    allow_origin_regex="https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(analysis.router, prefix="/api/analysis")
app.include_router(report.router, prefix="/api/analysis")
app.include_router(hypotheses.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to Research Analyzer API"}
