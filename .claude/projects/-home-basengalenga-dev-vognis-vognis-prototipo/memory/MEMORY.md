# Vognis Prototipo - Project Memory

## Stack
- **Backend**: FastAPI + httpx (direct Bedrock HTTP calls)
- **Containerization**: Docker + Docker Compose
- **LLM Model**: `us.anthropic.claude-sonnet-4-20250514-v1:0` via Bedrock

## Bedrock Auth
- Uses ABSK token (Bedrock API Key) passed as `Authorization: Bearer {token}`
- Token stored in `.env` as `AWS_BEDROCK_TOKEN`
- Direct HTTP to `bedrock-runtime.{region}.amazonaws.com/model/{model}/invoke`
- NOT using SigV4 / IAM credentials - pure ABSK token auth
- Retry with exponential backoff for 429 rate limits

## Architecture
- `app/main.py` - FastAPI entrypoint
- `app/models/schemas.py` - Pydantic models (Session, Nodes, Scores, Graph)
- `app/engine/scoring.py` - Mathematical core (PS, CI, Penalty, VI)
- `app/agents/bedrock_client.py` - Shared HTTP client with retry for Bedrock
- `app/agents/sub_agents.py` - 6 sub-agents scoring via Bedrock in parallel
- `app/agents/core_agent.py` - Core agent (keyword extraction, synthesis, concept bank, node4 chat)
- `app/routers/workflow.py` - API endpoints for Nodes 1-4 + session/graph utilities

## Key Decisions
- In-memory session store (prototype only)
- Sub-agents run in parallel via asyncio.gather + run_in_executor
- log(1 + CI) used instead of log(CI) to keep VI positive (scores are 0-1)
- PCF_FLOOR = 0.05 to avoid division by zero in penalty
- Fallback score of 0.5 if any sub-agent API call fails

## User Preferences
- Everything must run via `docker compose up`
- Claude is the data/GenAI/backend agent; Gemini handles frontend/web dev
