# daily-report

Open-source AI daily report data pipeline.

Collects data from three dimensions every day, processes it with an LLM, and renders it into structured reports (JSON / Markdown / HTML / PNG).

```
media   → RSS feeds (official blogs, tech media)
github  → GitHub Trending page
x       → X/Twitter via TwitterAPI.io advanced search
```

---

## Quick Start

### 1. Fork this repo

Click **Fork** on GitHub. All configuration is committed to the repo — no external config server needed.

### 2. Configure GitHub Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | Any OpenAI-compatible API key |
| `OPENAI_BASE_URL` | optional | API base URL (default: OpenAI official) |
| `OPENAI_MODEL` | optional | Model name (default: `gpt-5.4`) |
| `TWITTERAPI_IO_KEY` | optional | [TwitterAPI.io](https://twitterapi.io) key for X section |

The `LLM` config accepts any OpenAI-compatible endpoint. You can use:
- **OpenAI** (`https://api.openai.com/v1`)
- **SiliconFlow** (`https://api.siliconflow.cn/v1`)
- **DeepSeek** (`https://api.deepseek.com/v1`)
- Any other compatible provider

### 3. Customize configuration

Edit `config/defaults.yaml` to set your LLM preferences and section-level directives:

```yaml
llm:
  base_url: https://cc.dingsum.com/v1
  model: gpt-5.4

media:
  hours: 24
  llm_directive: |
    Select the 7 most impactful AI news items. Prioritize product launches
    and major industry events. Deduplicate overlapping stories.

github:
  max_results: 10
  llm_directive: |
    Include all trending repos, sort by stars_today descending.

x:
  min_faves: 1000
  top_n: 10
  llm_directive: |
    Select the 10 most insightful AI tweets, sorted by view count.
```

Edit `config/rss_sources.yaml` to configure RSS feeds:

```yaml
sources:
  - name: Google AI Blog
    url: https://blog.google/technology/ai/rss/
  - name: The Verge AI
    url: https://www.theverge.com/rss/ai-artificial-intelligence/index.xml
```

> **Tip:** [RSSHub](https://rsshub.app) generates RSS feeds for many sites that don't provide them natively. You can use the public instance (`https://rsshub.app/...`) or [self-host](https://docs.rsshub.app/deploy/) for better reliability.
>
> Examples:
> - `https://rsshub.app/anthropic/news` — Anthropic news
> - `https://rsshub.app/openai/news` — OpenAI news
> - `https://rsshub.app/huggingface/blog` — HuggingFace blog

Edit `config/x_keywords.yaml` to configure X/Twitter search keywords.

### 4. Enable GitHub Actions

GitHub Actions is enabled by default for public repos. For private repos, go to **Settings → Actions → General → Allow all actions**.

The pipeline runs automatically at **08:00 Beijing time** every day.

---

## Output Layout

```text
output/
  YYYY-MM-DD/
    media/
      raw.json        ← raw RSS items collected
      post.json       ← post-processed items (html2md + inferred time)
      report.json     ← LLM-distilled structured data
      report.md       ← Markdown render
      report.html     ← HTML render (styled)
      report.png      ← Screenshot (requires Playwright)
    github/
      raw.json
      post.json
      report.json
      report.md
      report.html
      report.png
    x/
      raw.json
      post.json       ← post-processed tweets (strict UTC filter + trimmed fields)
      report.json
      report.md
      report.html
      report.png
```

---

## Run Locally

```bash
# 1. Clone and set up
git clone https://github.com/kaiye/daily-report.git
cd daily-report
npm install

# 2. Install Playwright browser (optional)
npx playwright install chromium --with-deps

# 3. Set environment variables
export OPENAI_API_KEY=sk-...
export TWITTERAPI_IO_KEY=...   # only needed for X section

# 4. Run all sections
node scripts/run_daily.js

# Run specific section
node scripts/run_daily.js --section media
node scripts/run_daily.js --section github
node scripts/run_daily.js --section x

# Run for a specific date
node scripts/run_daily.js --date 2026-03-22

# Optional: validate report.json consistency against post/raw data
node scripts/validate_reports.js --date 2026-03-22
node scripts/validate_reports.js --date 2026-03-22 --fix
```

Pipeline order is enforced as:
`raw -> post -> llm -> json -> verify`

---

## Architecture

```text
config/
  defaults.yaml                    ← main config (LLM, section settings)
  rss_sources.yaml                 ← media RSS list
  x_keywords.yaml                  ← X keyword list

scripts/
  run_daily.js                     ← orchestration entry only
  validate_reports.js              ← validation CLI entry only

src/daily_report_js/
  collectors/                      ← raw collectors (per channel)
    media_rss.js
    github_trending.js
    x_twitter.js
  postprocessors/                  ← deterministic raw -> post (NO LLM)
    media.js
    github.js
    x.js
  schema/
    report_schema.js              ← single source of truth for report fields/rules
  generators/
    llm_report.js                  ← only post -> report.json (LLM)
  renderers/
    markdown.js
    html.js
    png.js
  verify/
    validate_reports.js            ← json/schema/value consistency checks
  pipeline/                        ← channel pipeline assembly
    media.js
    github.js
    x.js
    verify.js

output/
  YYYY-MM-DD/<section>/            ← raw/post/report outputs
```

---

## Secrets Reference

| Variable | Where to set | Description |
|---|---|---|
| `OPENAI_API_KEY` | GitHub Secret | LLM API key (required) |
| `OPENAI_BASE_URL` | GitHub Secret | LLM base URL (optional, for non-OpenAI providers) |
| `OPENAI_MODEL` | GitHub Secret | Model name override (optional) |
| `TWITTERAPI_IO_KEY` | GitHub Secret | TwitterAPI.io key (required for X section) |

For local runs, export these as environment variables.

---

## FAQ

**Q: Can I use this without the X section?**
A: Yes. If `TWITTERAPI_IO_KEY` is not set, the X section is skipped gracefully. Run with `--section github` or `--section media` to skip X entirely.

**Q: Can I use Chinese RSS sources?**
A: Yes. Standard public RSS URLs work. For WeChat public accounts, services like [wechat2rss](https://wechat2rss.xlab.app) can generate RSS feeds.

**Q: PNG generation failed — is that a problem?**
A: No. PNG generation is optional. If Playwright is not installed, the pipeline completes without PNG. All other outputs (JSON, Markdown, HTML) are always produced.

**Q: How does the LLM directive work?**
A: In `config/defaults.yaml`, each section has an `llm_directive` field. This text is injected into the LLM system prompt, telling it how to sort, filter, and summarize the raw data. This is the primary way to customize the report style without touching code.

---

## License

MIT
