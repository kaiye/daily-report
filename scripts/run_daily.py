#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from daily_report.collectors.github_trending import collect
from daily_report.generators.llm_yaml import generate_yaml
from daily_report.renderers.markdown import render_markdown
from daily_report.renderers.html import render_html
from daily_report.utils.io import write_json, write_yaml, write_text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", default=datetime.utcnow().date().isoformat())
    args = parser.parse_args()

    out_dir = ROOT / "output" / args.date
    raw_dir = out_dir / "raw"

    raw = collect()
    write_json(raw_dir / "github_trending.json", raw)

    report = generate_yaml(raw, args.date)
    write_yaml(out_dir / "report.yaml", report)
    write_text(out_dir / "report.md", render_markdown(report))
    write_text(out_dir / "report.html", render_html(report))

    print(f"Generated daily report at {out_dir}")


if __name__ == "__main__":
    main()
