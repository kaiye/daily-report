# daily-report SKILL.md

> This file is for AI agents (OpenClaw, Claude, etc.) running this pipeline.
> Human users: see README.md instead.

## What This Does

Produces a daily AI report covering three dimensions:
- **media**: RSS news from AI blogs and tech media
- **github**: GitHub Trending repositories
- **x**: Trending AI tweets via TwitterAPI.io

Each section outputs: `raw.json` → `report.yaml` → `report.md` + `report.html` + `report.png`

## Key Environment Variables

| Variable | Section | Required |
|---|---|---|
| `OPENAI_API_KEY` | all (LLM) | ✅ |
| `OPENAI_BASE_URL` | all (LLM) | optional |
| `OPENAI_MODEL` | all (LLM) | optional |
| `TWITTERAPI_IO_KEY` | x | for X section |

## Running

```bash
# Full pipeline (all sections)
python scripts/run_daily.py

# Single section
python scripts/run_daily.py --section media
python scripts/run_daily.py --section github
python scripts/run_daily.py --section x

# Specific date
python scripts/run_daily.py --date 2026-03-22 --section github
```

## Output Structure

```
output/YYYY-MM-DD/
  media/   raw.json  report.yaml  report.md  report.html  report.png
  github/  raw.json  report.yaml  report.md  report.html  report.png
  x/       raw.json  report.yaml  report.md  report.html  report.png
```

## Config Files

- `config/defaults.yaml` — LLM settings + per-section directives
- `config/rss_sources.yaml` — RSS feed list (public URLs only)
- `config/x_keywords.yaml` — X search keyword list

## LLM Directive

The `llm_directive` in `defaults.yaml` is injected into the LLM system prompt.
Customize it to change how items are sorted, filtered, and summarized.

## Important Notes

- **media**: only public RSS URLs supported. Local addresses (127.0.0.1) are skipped.
- **x**: uses TwitterAPI.io advanced search (`TWITTERAPI_IO_KEY`). Do not substitute with other scrapers.
- **LLM key**: set via `OPENAI_API_KEY` env var. `base_url` and `model` in config. No key in config files.
- **PNG**: requires `playwright install chromium --with-deps`. Pipeline succeeds without it.
- **GitHub Actions**: runs at 00:00 UTC (08:00 Beijing). Manual trigger available with date + section override.
