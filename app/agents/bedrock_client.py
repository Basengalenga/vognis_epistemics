"""
Shared Bedrock client using ABSK token via Authorization header.
Includes retry with exponential backoff for rate limits (429).
"""

import os
import time

import httpx

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
) -> dict:
    """Call Bedrock invoke-model endpoint with ABSK token auth and retry."""
    token, region = _get_config()

    url = (
        f"https://bedrock-runtime.{region}.amazonaws.com"
        f"/model/{model}/invoke"
    )

    body: dict = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "messages": messages,
    }
    if system:
        body["system"] = system

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }

    for attempt in range(MAX_RETRIES):
        response = httpx.post(url, json=body, headers=headers, timeout=60.0)
        if response.status_code == 429:
            delay = BASE_DELAY * (2 ** attempt)
            time.sleep(delay)
            continue
        response.raise_for_status()
        return response.json()

    response.raise_for_status()
    return response.json()
