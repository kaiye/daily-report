from __future__ import annotations

import json
import os
from typing import Any
import httpx
import yaml

SYSTEM_PROMPT = """You are generating a structured AI daily report YAML from raw GitHub trending data.
Return YAML only.
Schema:
report_date: YYYY-MM-DD
title: string
summary: string
sections:
  - name: GitHub Trending
    summary: string
    items:
      - repo: owner/name
        url: https://...
        why_it_matters: string
        highlights:
          - string
"""


def generate_yaml(raw: dict[str, Any], report_date: str, model: str | None = None) -> dict[str, Any]:
    api_key = os.environ["OPENAI_API_KEY"]
    base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps({"report_date": report_date, "raw": raw}, ensure_ascii=False)},
        ],
        "temperature": 0.2,
    }

    with httpx.Client(timeout=120) as client:
        resp = client.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    content = data["choices"][0]["message"]["content"]
    return yaml.safe_load(content)
