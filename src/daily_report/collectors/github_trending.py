from __future__ import annotations

import re
from datetime import date
from typing import Any
import httpx

TRENDING_URL = "https://github.com/trending?since=daily"


def fetch_trending_html() -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    with httpx.Client(timeout=20, follow_redirects=True, headers=headers) as client:
        resp = client.get(TRENDING_URL)
        resp.raise_for_status()
        return resp.text


def parse_trending(html: str) -> list[dict[str, Any]]:
    articles = re.findall(r'<article class="Box-row">(.*?)</article>', html, re.DOTALL)
    items: list[dict[str, Any]] = []
    for rank, block in enumerate(articles, start=1):
        name_m = re.search(r'<h2[^>]*>\s*<a[^>]+href="/([^"]+)"', block)
        desc_m = re.search(r'<p[^>]*class="col-9 color-fg-muted my-1 pr-4">(.*?)</p>', block, re.DOTALL)
        lang_m = re.search(r'programmingLanguage">(.*?)</span>', block, re.DOTALL)
        stars_m = re.search(r'href="/[^"]+/stargazers"[^>]*>\s*([\d,]+)\s*</a>', block)
        today_m = re.search(r'([\d,]+)\s+stars today', block)
        if not name_m:
            continue
        desc = re.sub(r'<.*?>', '', desc_m.group(1)).strip() if desc_m else ''
        lang = re.sub(r'<.*?>', '', lang_m.group(1)).strip() if lang_m else ''
        items.append({
            "rank": rank,
            "repo": name_m.group(1).strip(),
            "description": re.sub(r'\s+', ' ', desc),
            "language": lang,
            "stars": int((stars_m.group(1) if stars_m else '0').replace(',', '')),
            "stars_today": int((today_m.group(1) if today_m else '0').replace(',', '')),
            "url": f"https://github.com/{name_m.group(1).strip()}",
        })
    return items


def collect() -> dict[str, Any]:
    html = fetch_trending_html()
    items = parse_trending(html)
    return {
        "source": "github_trending",
        "collected_at": date.today().isoformat(),
        "count": len(items),
        "items": items,
    }
