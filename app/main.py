from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.agents.bedrock_client import BedrockError
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


@app.exception_handler(BedrockError)
async def bedrock_error(_request, exc: BedrockError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/health")
async def health():
    return {"status": "ok", "service": "vognis-api"}
