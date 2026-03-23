#!/usr/bin/env python3
"""
Daily Report Pipeline — main entry point.

Generates three independent sections: media / github / x
Each section produces:
  output/YYYY-MM-DD/<section>/raw.json
  output/YYYY-MM-DD/<section>/report.yaml
  output/YYYY-MM-DD/<section>/report.md
  output/YYYY-MM-DD/<section>/report.html
  output/YYYY-MM-DD/<section>/report.png   (if Playwright available)

Usage:
  python scripts/run_daily.py [--date YYYY-MM-DD] [--section media|github|x]
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import yaml as _yaml

from daily_report.collectors.github_trending import collect as collect_github
from daily_report.collectors.media_rss import collect as collect_media
from daily_report.collectors.x_twitter import collect as collect_x
from daily_report.generators.llm_yaml import generate_section_yaml
from daily_report.renderers.html import render_html
from daily_report.renderers.markdown import render_markdown
from daily_report.renderers.png import render_png
from daily_report.utils.io import read_yaml, write_json, write_text, write_yaml

CONFIG_FILE = ROOT / "config" / "defaults.yaml"
RSS_SOURCES_FILE = ROOT / "config" / "rss_sources.yaml"
X_KEYWORDS_FILE = ROOT / "config" / "x_keywords.yaml"


def load_config() -> dict:
    if CONFIG_FILE.exists():
        return read_yaml(CONFIG_FILE)
    return {}


def load_rss_sources() -> list[dict]:
    if RSS_SOURCES_FILE.exists():
        data = read_yaml(RSS_SOURCES_FILE)
        return data.get("sources", [])
    return []


def load_x_keywords() -> list[str]:
    if X_KEYWORDS_FILE.exists():
        data = read_yaml(X_KEYWORDS_FILE)
        return data.get("keywords", [])
    # sensible defaults
    return ["OpenAI", "Anthropic", "Claude", "ChatGPT", "LLM", "AGI"]


def run_media(out_dir: Path, config: dict, report_date: str) -> None:
    print("\n📰 [MEDIA] Fetching RSS feeds...")
    sources = load_rss_sources()
    if not sources:
        print("  ⚠  No RSS sources configured in config/rss_sources.yaml — skipping media")
        return

    sec_cfg = config.get("media", {})
    hours = sec_cfg.get("hours", 24)
    directive = sec_cfg.get("llm_directive", "")
    llm_cfg = config.get("llm", {})

    raw = collect_media(sources, hours=hours)
    write_json(out_dir / "raw.json", raw)
    print(f"  💾 raw.json: {raw['item_count']} items")

    if raw["item_count"] == 0:
        print("  ⚠  No media items collected — skipping LLM generation")
        return

    print("  🤖 Generating report YAML via LLM...")
    report = generate_section_yaml(
        "media", raw, report_date,
        directive=directive,
        model=llm_cfg.get("model"),
        base_url=llm_cfg.get("base_url"),
        temperature=llm_cfg.get("temperature", 0.2),
    )
    write_yaml(out_dir / "report.yaml", report)
    md = render_markdown(report)
    write_text(out_dir / "report.md", md)
    html = render_html(report)
    write_text(out_dir / "report.html", html)
    render_png(html, out_dir / "report.png")
    print(f"  ✅ Media report done → {out_dir}")


def run_github(out_dir: Path, config: dict, report_date: str) -> None:
    print("\n🐙 [GITHUB] Fetching trending...")
    sec_cfg = config.get("github", {})
    since = sec_cfg.get("since", "daily")
    max_results = sec_cfg.get("max_results", 10)
    directive = sec_cfg.get("llm_directive", "")
    llm_cfg = config.get("llm", {})

    raw = collect_github(since=since)
    write_json(out_dir / "raw.json", raw)
    print(f"  💾 raw.json: {raw['count']} repos")

    print("  🤖 Generating report YAML via LLM...")
    # Limit items sent to LLM to avoid token waste
    trimmed_raw = dict(raw)
    trimmed_raw["items"] = raw.get("items", [])[:max_results]
    report = generate_section_yaml(
        "github", trimmed_raw, report_date,
        directive=directive,
        model=llm_cfg.get("model"),
        base_url=llm_cfg.get("base_url"),
        temperature=llm_cfg.get("temperature", 0.2),
    )
    write_yaml(out_dir / "report.yaml", report)
    md = render_markdown(report)
    write_text(out_dir / "report.md", md)
    html = render_html(report)
    write_text(out_dir / "report.html", html)
    render_png(html, out_dir / "report.png")
    print(f"  ✅ GitHub report done → {out_dir}")


def run_x(out_dir: Path, config: dict, report_date: str) -> None:
    print("\n🐦 [X] Fetching tweets via TwitterAPI.io...")
    sec_cfg = config.get("x", {})
    hours = sec_cfg.get("hours", 24)
    min_faves = sec_cfg.get("min_faves", 1000)
    top_n = sec_cfg.get("top_n", 10)
    directive = sec_cfg.get("llm_directive", "")
    llm_cfg = config.get("llm", {})
    keywords = load_x_keywords()

    try:
        raw = collect_x(keywords, hours=hours, min_faves=min_faves, top_n=top_n)
    except RuntimeError as exc:
        print(f"  ⚠  {exc} — skipping X section")
        return

    write_json(out_dir / "raw.json", raw)
    print(f"  💾 raw.json: {raw['item_count']} tweets")

    if raw["item_count"] == 0:
        print("  ⚠  No tweets collected — skipping LLM generation")
        return

    print("  🤖 Generating report YAML via LLM...")
    report = generate_section_yaml(
        "x", raw, report_date,
        directive=directive,
        model=llm_cfg.get("model"),
        base_url=llm_cfg.get("base_url"),
        temperature=llm_cfg.get("temperature", 0.2),
    )
    write_yaml(out_dir / "report.yaml", report)
    md = render_markdown(report)
    write_text(out_dir / "report.md", md)
    html = render_html(report)
    write_text(out_dir / "report.html", html)
    render_png(html, out_dir / "report.png")
    print(f"  ✅ X report done → {out_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the daily AI report pipeline")
    parser.add_argument(
        "--date",
        default=None,
        help="Report date YYYY-MM-DD (default: today in Beijing time)",
    )
    parser.add_argument(
        "--section",
        choices=["media", "github", "x", "all"],
        default="all",
        help="Which section to generate (default: all)",
    )
    args = parser.parse_args()

    # Determine report date in Beijing time
    if args.date:
        report_date = args.date
    else:
        bj_now = datetime.now(timezone.utc) + timedelta(hours=8)
        report_date = bj_now.strftime("%Y-%m-%d")

    config = load_config()
    base_out = ROOT / "output" / report_date
    print(f"📅 Report date: {report_date}")
    print(f"📁 Output dir:  {base_out}")

    sections = ["media", "github", "x"] if args.section == "all" else [args.section]

    for section in sections:
        out_dir = base_out / section
        out_dir.mkdir(parents=True, exist_ok=True)
        if section == "media":
            run_media(out_dir, config, report_date)
        elif section == "github":
            run_github(out_dir, config, report_date)
        elif section == "x":
            run_x(out_dir, config, report_date)

    print(f"\n🎉 All done! Output: {base_out}")


if __name__ == "__main__":
    main()
