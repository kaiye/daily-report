"""
LLM YAML generator — converts raw collector data into structured report YAML.

Each section (media/github/x) has its own prompt and schema.
The llm_directive from config is injected into the system prompt so users
can control sorting/filtering/summary style.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx
import yaml


# ── Section schemas (embedded in system prompts) ─────────────────────────────

MEDIA_SYSTEM = """You are generating a structured daily AI news YAML from raw RSS feed data.
Return ONLY valid YAML — no markdown fences, no commentary.
IMPORTANT: Quote all string values that contain colons (use double quotes).

User directive: {directive}

Schema:
report_date: YYYY-MM-DD
section: media
title: string
summary: string  # 2-3 sentence overview of the day's AI news
items:
  - source: string          # RSS source name
    title: string           # article title
    url: string             # article link
    published_at: string    # ISO datetime or date
    why_it_matters: string  # 1-2 sentence explanation of significance
"""

GITHUB_SYSTEM = """You are generating a structured daily GitHub trending YAML from raw trending data.
Return ONLY valid YAML — no markdown fences, no commentary.
IMPORTANT: Quote all string values that contain colons (use double quotes).

User directive: {directive}

Schema:
report_date: YYYY-MM-DD
section: github
title: string
summary: string  # 2-3 sentence overview of today's GitHub trending
items:
  - repo: string            # owner/name
    url: string
    description: string     # from GitHub — quote if it contains colons
    language: string
    stars_today: integer
    stars_total: integer
    why_it_matters: string  # 1-2 sentences on relevance — quote if it contains colons
"""

X_SYSTEM = """You are generating a structured daily X/Twitter trending YAML from raw tweet data.
Return ONLY valid YAML — no markdown fences, no commentary.
IMPORTANT: Quote all string values that contain colons (use double quotes).

User directive: {directive}

Schema:
report_date: YYYY-MM-DD
section: x
title: string
summary: string  # 2-3 sentence overview of the day's AI discourse on X
items:
  - id: string
    author_name: string
    author_handle: string
    text: string            # tweet full text (preserve as-is)
    url: string
    view_count: integer
    like_count: integer
    why_it_matters: string  # 1 sentence
"""

SYSTEM_PROMPTS = {
    "media": MEDIA_SYSTEM,
    "github": GITHUB_SYSTEM,
    "x": X_SYSTEM,
}


def _strip_fences(text: str) -> str:
    """Remove markdown code fences if LLM wraps output in them."""
    text = re.sub(r"^```[a-z]*\n?", "", text.strip())
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


def _fix_yaml(text: str) -> str:
    """
    Best-effort fix for common LLM YAML issues:
    - Unquoted string values containing colons after the first word
      e.g.  `description: Foo: bar` → `description: "Foo: bar"`
    """
    lines = text.splitlines()
    fixed = []
    for line in lines:
        # Match  `  key: value` where value contains a bare colon
        m = re.match(r'^(\s*)([a-zA-Z_][a-zA-Z0-9_ -]*?):\s+(.+)$', line)
        if m:
            indent, key, value = m.group(1), m.group(2), m.group(3)
            # Only fix if value contains a colon and is not already quoted/special
            if ':' in value and not value.startswith(('http://', 'https://', '"', "'", '|', '>')):
                # Escape internal double quotes and wrap
                value_escaped = value.replace('"', '\\"')
                line = f'{indent}{key}: "{value_escaped}"'
        fixed.append(line)
    return "\n".join(fixed)


def generate_section_yaml(
    section: str,
    raw: dict[str, Any],
    report_date: str,
    directive: str = "",
    model: str | None = None,
    base_url: str | None = None,
    temperature: float = 0.2,
) -> dict[str, Any]:
    """
    Call LLM to distill raw collector data into structured YAML for one section.

    Args:
        section: "media" | "github" | "x"
        raw: output from the corresponding collector
        report_date: YYYY-MM-DD string
        directive: user-configurable sorting/summary preference text
        model: LLM model name (overrides env/default)
        base_url: LLM base URL (overrides env/default)
        temperature: sampling temperature
    """
    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set")

    # Priority: env var > function arg > default
    _base_url = (
        os.environ.get("OPENAI_BASE_URL")
        or base_url
        or "https://api.openai.com/v1"
    )
    _model = (
        os.environ.get("OPENAI_MODEL")
        or model
        or "gpt-4o-mini"
    )

    system_tmpl = SYSTEM_PROMPTS.get(section)
    if not system_tmpl:
        raise ValueError(f"Unknown section: {section!r}. Must be one of: {list(SYSTEM_PROMPTS)}")

    system_prompt = system_tmpl.format(directive=directive or "(none — use your best judgment)")

    user_content = json.dumps(
        {"report_date": report_date, "raw": raw},
        ensure_ascii=False,
        indent=None,
    )

    payload = {
        "model": _model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": temperature,
    }

    with httpx.Client(timeout=120) as client:
        resp = client.post(
            f"{_base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    content = _strip_fences(content)
    try:
        result = yaml.safe_load(content)
    except yaml.YAMLError:
        # Try auto-fixing common issues (bare colons in values)
        content = _fix_yaml(content)
        result = yaml.safe_load(content)
    if result is None:
        raise ValueError(f"LLM returned empty YAML for section {section!r}")
    return result
