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
| `OPENAI_BASE_URL` | optional | Overrides `llm.base_url` in `config/defaults.yaml` |
| `OPENAI_MODEL` | optional | Overrides `llm.model` in `config/defaults.yaml` |
| `TWITTERAPI_IO_KEY` | optional | [TwitterAPI.io](https://twitterapi.io) key for X section |

The `llm` config accepts any OpenAI-compatible endpoint; set `llm.base_url` (or the `OPENAI_BASE_URL` secret) to your provider and `llm.model` (or `OPENAI_MODEL`) to a model it serves. Providers such as OpenAI, SiliconFlow, and DeepSeek work.

### 3. Customize configuration

Edit `config/defaults.yaml` to set your LLM preferences and section settings. Set `llm.base_url` to your provider's base URL; the other key shipped values are:

```yaml
llm:
  model: deepseek-v4-flash        # use a model your provider serves
  temperature: 0.2
  proxy: ""                        # optional HTTP proxy

output:
  language: zh-cn                  # used by the llm_directive templates
  section_titles:
    media: 媒体资讯
    github: Github 趋势
    x: X 热点

verify:
  max_repair_attempts: 2           # LLM repair attempts after a failed check

media:
  hours: 24
  max_items: 9

github:
  since: daily                     # daily | weekly | monthly
  max_results: 15

x:
  min_faves: 1000
  top_n: 10
```

Each section also has an `llm_directive` (full text in `config/defaults.yaml`) that is injected into the LLM system prompt. Directives support these placeholders: `{{max_items}}`, `{{output_language}}`, and, for the media section, `{{priority_keywords}}`. Media/X post-processing knobs live under `post_process` in the same file.

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

Each section runs:
`raw -> post -> report.json (LLM) -> verify -> repair if needed (up to verify.max_repair_attempts) -> Markdown / HTML / PNG`

---

## Architecture

```text
config/
  defaults.yaml                    ← main config (LLM, output, sections, verify, post-process)
  rss_sources.yaml                 ← media RSS list
  x_keywords.yaml                  ← X keyword list

scripts/
  run_daily.js                     ← orchestration entry
  run_daily_no_llm_fallback.js     ← no-LLM collect/post/render fallback
  validate_reports.js              ← validation CLI entry

src/daily_report_js/
  config.js                        ← config loading and CLI argument parsing
  project.js                       ← repo/config/output paths
  collectors/                      ← raw collectors (per channel)
    media_rss.js
    github_trending.js
    x_twitter.js
  postprocessors/                  ← deterministic raw -> post (NO LLM)
    media.js
    github.js
    x.js
  schema/
    report_schema.js               ← report schema + prompt example shared by LLM/verify
  generators/
    llm_report.js                  ← LLM generation + repair of report JSON
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
    generate_verified_report.js    ← generate -> verify -> repair loop
  utils/
    io.js
    text.js
    time.js
    template.js

output/
  YYYY-MM-DD/<section>/            ← raw/post/report outputs
```

---

## Secrets Reference

| Variable | Where to set | Description |
|---|---|---|
| `OPENAI_API_KEY` | GitHub Secret | LLM API key (required) |
| `OPENAI_BASE_URL` | GitHub Secret | Overrides `llm.base_url` (optional) |
| `OPENAI_MODEL` | GitHub Secret | Overrides `llm.model` (optional) |
| `TWITTERAPI_IO_KEY` | GitHub Secret | TwitterAPI.io key (required for X section) |

For local runs, export these as environment variables. When `OPENAI_BASE_URL` / `OPENAI_MODEL` are unset, the corresponding values from `config/defaults.yaml` are used.

---

## FAQ

**Q: Can I use this without the X section?**
A: Yes. If `TWITTERAPI_IO_KEY` is not set, the X section is skipped gracefully. Run with `--section github` or `--section media` to skip X entirely.

**Q: Can I use Chinese RSS sources?**
A: Yes. Standard public RSS URLs work. For WeChat public accounts, services like [wechat2rss](https://wechat2rss.xlab.app) can generate RSS feeds.

**Q: PNG generation failed — is that a problem?**
A: No. PNG generation is optional. If Playwright's Chromium browser is not installed, the pipeline logs a warning and completes without PNG; the other outputs (JSON, Markdown, HTML) are still produced.

**Q: How does the LLM directive work?**
A: In `config/defaults.yaml`, each section has an `llm_directive` field. This text is injected into the LLM system prompt, telling it how to sort, filter, and summarize the post-processed data. This is the primary way to customize the report style without touching code.

---

## License

MIT
