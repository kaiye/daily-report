"""
X/Twitter collector — fetches trending AI tweets via TwitterAPI.io advanced search.

Requires: TWITTERAPI_IO_KEY environment variable.
"""
from __future__ import annotations

import hashlib
import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, date, timedelta, timezone
from typing import Any


BASE_URL = "https://api.twitterapi.io"


def _get_utc_window(utc_date: date) -> tuple[int, int]:
    """Return (since_ts, until_ts) unix timestamps for a UTC date (full 24h)."""
    midnight = datetime.combine(utc_date, datetime.min.time(), tzinfo=timezone.utc)
    end_of_day = midnight + timedelta(days=1) - timedelta(seconds=1)
    return int(midnight.timestamp()), int(end_of_day.timestamp())


def _build_query(keywords: list[str], since_ts: int, until_ts: int, min_faves: int) -> str:
    kw_str = " OR ".join(keywords)
    return (
        f"({kw_str}) "
        f"lang:en "
        f"since_time:{since_ts} "
        f"until_time:{until_ts} "
        f"min_faves:{min_faves} "
        f"filter:safe "
        f"-filter:nativeretweets"
    )


def _fetch_raw(api_key: str, query: str) -> list[dict[str, Any]]:
    params = {"query": query, "queryType": "Top"}
    url = f"{BASE_URL}/twitter/tweet/advanced_search?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url)
    req.add_header("X-API-Key", api_key)
    req.add_header("User-Agent", "Mozilla/5.0")
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    return data.get("tweets", [])


def _post_process(
    tweets: list[dict[str, Any]],
    since_ts: int,
    until_ts: int,
    min_text_length: int,
    top_n: int,
) -> list[dict[str, Any]]:
    utc_start = datetime.fromtimestamp(since_ts, tz=timezone.utc)
    utc_end = datetime.fromtimestamp(until_ts, tz=timezone.utc)

    time_filtered = []
    for t in tweets:
        try:
            dt = datetime.strptime(t.get("createdAt", ""), "%a %b %d %H:%M:%S %z %Y")
            if utc_start <= dt <= utc_end:
                time_filtered.append(t)
        except Exception:
            pass

    filtered = [
        t for t in time_filtered
        if len(t.get("text", "").strip()) >= min_text_length
    ]

    filtered.sort(key=lambda x: x.get("viewCount", 0), reverse=True)

    result = []
    for t in filtered[:top_n]:
        author = t.get("author", {})
        result.append({
            "id": t.get("id"),
            "text": t.get("text"),
            "createdAt": t.get("createdAt"),
            "viewCount": t.get("viewCount", 0),
            "likeCount": t.get("likeCount", 0),
            "retweetCount": t.get("retweetCount", 0),
            "author": {
                "userName": author.get("userName", author.get("username", "")),
                "name": author.get("name", ""),
            },
            "url": t.get("twitterUrl", t.get("url", "")),
        })
    return result


def collect(
    keywords: list[str],
    hours: int = 24,
    min_faves: int = 1000,
    top_n: int = 10,
    utc_date: date | None = None,
) -> dict[str, Any]:
    api_key = os.environ.get("TWITTERAPI_IO_KEY", "")
    if not api_key:
        raise RuntimeError("TWITTERAPI_IO_KEY environment variable is not set")

    if utc_date is None:
        # Default: yesterday in Beijing time
        bj_now = datetime.now(timezone.utc) + timedelta(hours=8)
        utc_date = (bj_now - timedelta(days=1)).date()

    since_ts, until_ts = _get_utc_window(utc_date)
    query = _build_query(keywords, since_ts, until_ts, min_faves)

    print(f"  🔍 Query window: UTC {utc_date} 00:00 – 23:59 (min_faves={min_faves})")
    raw_tweets = _fetch_raw(api_key, query)
    print(f"  📥 Fetched {len(raw_tweets)} raw tweets")

    processed = _post_process(raw_tweets, since_ts, until_ts, min_text_length=30, top_n=top_n)
    print(f"  ✅ Post-processed → {len(processed)} tweets")

    return {
        "source": "x_twitter",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "utc_date": utc_date.isoformat(),
        "query": query,
        "query_hash": hashlib.md5(query.encode()).hexdigest()[:8],
        "raw_count": len(raw_tweets),
        "item_count": len(processed),
        "items": processed,
    }
