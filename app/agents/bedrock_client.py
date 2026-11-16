"""
Shared Bedrock client using ABSK token via Authorization header.
Includes retry with exponential backoff for rate limits (429).
"""

import os
import time
from urllib.parse import quote

import httpx


class BedrockError(RuntimeError):
    """Bedrock rejected the call. Raised so the API can return a real response."""

_token: str = ""
_region: str = ""


def _get_config() -> tuple[str, str]:
    global _token, _region
    if not _token:
        _token = os.getenv("AWS_BEDROCK_TOKEN", "")
        _region = os.getenv("AWS_REGION", "us-east-1")
    return _token, _region


MAX_RETRIES = 5
BASE_DELAY = 2  # seconds


def invoke_model(
    model: str,
    messages: list[dict],
    max_tokens: int = 1024,
    system: str | None = None,
    temperature: float | None = None,
    extra: dict | None = None,
) -> dict:
    """Call Bedrock invoke-model endpoint with ABSK token auth and retry.

    temperature and extra (more body fields, such as output_config) are only sent when given.
    """
    token, region = _get_config()

    url = (
        f"https://bedrock-runtime.{region}.amazonaws.com"
        f"/model/{quote(model, safe='')}/invoke"
    )

    body: dict = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        body["system"] = system
    if temperature is not None:
        body["temperature"] = temperature
    if extra:
        body.update(extra)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    transport_failures = 0
    for attempt in range(MAX_RETRIES):
        try:
            response = httpx.post(url, json=body, headers=headers, timeout=60.0)
        except httpx.TransportError as exc:
            transport_failures += 1
            if transport_failures >= 3:
                raise BedrockError("No pudimos conectar con el modelo") from exc
            time.sleep(BASE_DELAY * (2 ** (transport_failures - 1)))
            continue
        if response.status_code == 429:
            delay = BASE_DELAY * (2 ** attempt)
            time.sleep(delay)
            continue
        if response.status_code >= 400:
            raise BedrockError(f"Bedrock {response.status_code}: {response.text[:500]}")
        return response.json()

    raise BedrockError(f"Bedrock 429: rate limited after {MAX_RETRIES} attempts")
