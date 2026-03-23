"""
GitHub Trending collector — scrapes the public GitHub Trending page.

Note: GitHub does not provide an official Trending API.
This module parses the public HTML page. If GitHub changes the page
structure, the parser may need updates.
"""
from __future__ import annotations

import re
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Any


_TRENDING_URL = "https://github.com/trending"


def _fetch_page(since: str = "daily", lang: str = "") -> str:
    url = _TRENDING_URL
    if lang:
        url += f"/{lang}"
    url += f"?since={since}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def _parse(html: str) -> list[dict[str, Any]]:
    articles = re.findall(r'<article class="Box-row">(.*?)</article>', html, re.DOTALL)
    items: list[dict[str, Any]] = []
    for rank, block in enumerate(articles, start=1):
        name_m = re.search(r'<h2[^>]*>\s*<a[^>]+href="/([^"]+)"', block)
        desc_m = re.search(r'<p[^>]*class="[^"]*col-9[^"]*"[^>]*>(.*?)</p>', block, re.DOTALL)
        lang_m = re.search(r'itemprop="programmingLanguage"[^>]*>(.*?)</span>', block)
        stars_total_m = re.search(
            r'href="/[^/]+/[^/]+/stargazers"[^>]*>.*?</svg>\s*([\d,]+)',
            block, re.DOTALL,
        )
        forks_m = re.search(
            r'href="/[^/]+/[^/]+/forks"[^>]*>.*?</svg>\s*([\d,]+)',
            block, re.DOTALL,
        )
        today_m = re.search(r"([\d,]+)\s*stars today", block)

        if not name_m:
            continue

        repo = name_m.group(1).strip()
        desc = ""
        if desc_m:
            desc = re.sub(r"<[^>]+>", "", desc_m.group(1))
            desc = re.sub(r"\s+", " ", desc).strip()

        items.append({
            "rank": rank,
            "repo": repo,
            "url": f"https://github.com/{repo}",
            "description": desc,
            "language": lang_m.group(1).strip() if lang_m else "",
            "stars_total": int(stars_total_m.group(1).replace(",", "")) if stars_total_m else 0,
            "forks": int(forks_m.group(1).replace(",", "")) if forks_m else 0,
            "stars_today": int(today_m.group(1).replace(",", "")) if today_m else 0,
        })
    return items


def collect(since: str = "daily", lang: str = "") -> dict[str, Any]:
    """
    Fetch GitHub Trending and return raw data dict.

    Args:
        since: "daily" | "weekly" | "monthly"
        lang: filter by programming language (e.g. "python"), empty = all
    """
    bj_now = datetime.now(timezone.utc) + timedelta(hours=8)
    html = _fetch_page(since=since, lang=lang)
    items = _parse(html)
    return {
        "source": "github_trending",
        "collected_at": bj_now.isoformat(),
        "since": since,
        "lang_filter": lang or "all",
        "count": len(items),
        "items": items,
    }
