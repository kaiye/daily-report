# daily-report

Open-source AI daily report data pipeline.

Goal:
- collect source data every day
- write normalized `raw.json`
- use LLM to extract structured `report.yaml`
- render `report.md` and `report.html`
- run automatically with GitHub Actions at 08:00 Asia/Shanghai
- also support manual runs

## Pipeline

1. Fetch GitHub Trending HTML and parse raw repository data
2. Save raw source JSON to `output/YYYY-MM-DD/raw/`
3. Use an LLM to turn raw data into structured YAML
4. Render Markdown and HTML from YAML
5. Commit generated outputs back to this repository

## Status

This repository is the **data production side** of the daily report system.
It is designed to be:
- usable standalone
- reusable by sites like `manbo.im`
- easy to fork and customize

## Quick start

### 1. Configure secrets

Repository secrets:
- `OPENAI_API_KEY` — any OpenAI-compatible key
- `OPENAI_BASE_URL` — optional, defaults to OpenAI official endpoint
- `OPENAI_MODEL` — optional, defaults to `gpt-4o-mini`

### 2. Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/run_daily.py --date 2026-03-23
```

### 3. Run in GitHub Actions

Workflow file: `.github/workflows/daily-report.yml`
- scheduled daily at **08:00 Beijing time**
- also supports manual trigger via **Run workflow**

## Output layout

```text
output/
  YYYY-MM-DD/
    raw/
      github_trending.json
    report.yaml
    report.md
    report.html
```

## Notes

- GitHub does not provide an official Trending API.
- This project fetches the public Trending page and parses it.
- If GitHub changes page structure, the parser may need updates.
