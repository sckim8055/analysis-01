from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import upload, analysis, report

app = FastAPI(title="Research Analyzer API")

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

@app.get("/")
def read_root():
    return {"message": "Welcome to Research Analyzer API"}
