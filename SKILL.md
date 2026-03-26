# daily-report SKILL.md

> This file is for AI agents (OpenClaw, Claude, etc.) running this pipeline.
> Human users: see README.md instead.

## What This Does

Produces a daily AI report covering three dimensions:
- **media**: RSS news from AI blogs and tech media
- **github**: GitHub Trending repositories
- **x**: Trending AI tweets via TwitterAPI.io

Each section outputs: `raw.json` → `post.json` → `report.json` → `report.md` + `report.html` + `report.png`

Pipeline contract:
- `raw.json -> post.json` is deterministic post-processing (no LLM calls).
- LLM is only used for `post.json -> report.json`.
- Verification is mandatory after JSON generation (`raw -> post -> llm -> json -> verify`).

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
node scripts/run_daily.js

# Single section
node scripts/run_daily.js --section media
node scripts/run_daily.js --section github
node scripts/run_daily.js --section x

# Specific date
node scripts/run_daily.js --date 2026-03-22 --section github

# Validation
node scripts/validate_reports.js --date 2026-03-22 --fix
```

## Output Structure

```
output/YYYY-MM-DD/
  media/   raw.json  post.json  report.json  report.md  report.html  report.png
  github/  raw.json  post.json  report.json  report.md  report.html  report.png
  x/       raw.json  post.json  report.json  report.md  report.html  report.png
```

## Config Files

- `config/defaults.yaml` — LLM settings + per-section directives
- `config/rss_sources.yaml` — RSS feed list (public URLs only)
- `config/x_keywords.yaml` — X search keyword list

## JS Code Layout

- `src/daily_report_js/collectors/*` — per-channel raw collectors
- `src/daily_report_js/postprocessors/*` — per-channel deterministic post processors
- `src/daily_report_js/schema/report_schema.js` — shared report schema/rules (LLM + verify)
- `src/daily_report_js/generators/llm_report.js` — LLM JSON generator
- `src/daily_report_js/renderers/*` — markdown/html/png renderers
- `src/daily_report_js/verify/validate_reports.js` — JSON/schema/value consistency validator
- `src/daily_report_js/pipeline/*` — channel pipeline assembly

## LLM Directive

The `llm_directive` in `defaults.yaml` is injected into the LLM system prompt.
Customize it to change how items are sorted, filtered, and summarized.

## Important Notes

- **media**: only public RSS URLs supported. Local addresses (127.0.0.1) are skipped.
- **x**: uses TwitterAPI.io advanced search (`TWITTERAPI_IO_KEY`). Do not substitute with other scrapers.
- **LLM key**: set via `OPENAI_API_KEY` env var. `base_url` and `model` in config. No key in config files.
- **PNG**: requires `npx playwright install chromium --with-deps`. Pipeline succeeds without it.
- **GitHub Actions**: runs at 00:00 UTC (08:00 Beijing). Manual trigger available with date + section override.
