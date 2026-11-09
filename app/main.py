from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.workflow import router as workflow_router

app = FastAPI(
    title="Vognis API",
    description="The Serendipity Workspace - Backend Prototype",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflow_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vognis-api"}
