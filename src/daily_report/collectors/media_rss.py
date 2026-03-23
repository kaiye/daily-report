"""
Media RSS collector — fetches news from public RSS feeds.

Only public RSS URLs are supported. For sites without native RSS, use RSSHub:
  https://rsshub.app/anthropic/news
Local/private RSS addresses (e.g. 127.0.0.1) are not supported.
"""
from __future__ import annotations

import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import Any


def _parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    for fmt in [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S GMT",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%f%z",
    ]:
        try:
            d = datetime.strptime(s, fmt)
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            return d
        except ValueError:
            pass
    return None


def _clean(s: str) -> str:
    s = re.sub(r"&amp;", "&", s)
    s = re.sub(r"&lt;", "<", s)
    s = re.sub(r"&gt;", ">", s)
    s = re.sub(r"&quot;", '"', s)
    s = re.sub(r"&#39;", "'", s)
    s = re.sub(r"&#\d+;", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    return s.strip()


def _et_text(node: ET.Element, *tags: str) -> str:
    for tag in tags:
        # try without and with namespace wildcard
        for t in (tag, f".//{tag}"):
            el = node.find(t)
            if el is not None and el.text:
                return el.text.strip()
    return ""


def _fetch_rss(name: str, url: str, cutoff: datetime | None) -> list[dict[str, Any]]:
    # Reject local addresses
    if re.search(r"127\.0\.0\.1|localhost", url):
        print(f"  ⚠  {name}: local RSS URLs not supported — skipping")
        return []

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; DailyReport/1.0)"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
    except Exception as exc:
        print(f"  ❌ {name}: {exc}")
        return []

    # Strip namespaces for easier parsing
    raw_stripped = re.sub(r" xmlns[^\"']*[\"'][^\"']*[\"']", "", raw)
    raw_stripped = re.sub(r"<([a-z]+):([a-zA-Z]+)", r"<\1_\2", raw_stripped)
    raw_stripped = re.sub(r"</([a-z]+):([a-zA-Z]+)", r"</\1_\2", raw_stripped)

    try:
        root = ET.fromstring(raw_stripped)
    except ET.ParseError:
        root = None

    items: list[dict[str, Any]] = []

    if root is not None:
        nodes = root.findall(".//item") or root.findall(".//entry")
        for node in nodes:
            title = _et_text(node, "title")
            link = _et_text(node, "link")
            if not link:
                link_el = node.find("link")
                if link_el is not None:
                    link = link_el.get("href", "")
            pub_str = _et_text(node, "pubDate", "published", "updated")
            pub_dt = _parse_date(pub_str)

            if not title or len(title) < 4:
                continue
            if cutoff and pub_dt and pub_dt < cutoff:
                continue

            # description: prefer content_encoded, then description, then summary
            desc = ""
            for tag in ("content_encoded", "description", "summary"):
                el = node.find(tag)
                if el is not None and el.text and len(el.text.strip()) > 20:
                    desc = _clean(el.text)[:400]
                    break

            items.append({
                "source": name,
                "source_url": url,
                "title": title,
                "link": link,
                "published_at": pub_dt.isoformat() if pub_dt else None,
                "description": desc,
            })
    else:
        # Regex fallback
        blocks = re.findall(r"<item[^>]*>(.*?)</item>", raw, re.DOTALL)
        if not blocks:
            blocks = re.findall(r"<entry[^>]*>(.*?)</entry>", raw, re.DOTALL)
        for block in blocks:
            title_m = re.search(r"<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</title>", block, re.DOTALL)
            link_m = re.search(r"<link[^>]*>(?:<!\[CDATA\[)?(https?://[^<]+?)(?:\]\]>)?</link>", block) or \
                     re.search(r'<link[^>]+href=["\']([^"\']+)["\']', block)
            date_m = re.search(r"<pubDate[^>]*>(.*?)</pubDate>", block) or \
                     re.search(r"<published[^>]*>(.*?)</published>", block) or \
                     re.search(r"<updated[^>]*>(.*?)</updated>", block)
            title = _clean(title_m.group(1)) if title_m else ""
            link = link_m.group(1).strip() if link_m else ""
            pub_dt = _parse_date(date_m.group(1)) if date_m else None

            if not title or len(title) < 4:
                continue
            if cutoff and pub_dt and pub_dt < cutoff:
                continue

            desc_m = re.search(r"<description[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</description>", block, re.DOTALL)
            desc = _clean(desc_m.group(1))[:400] if desc_m else ""

            items.append({
                "source": name,
                "source_url": url,
                "title": title,
                "link": link,
                "published_at": pub_dt.isoformat() if pub_dt else None,
                "description": desc,
            })

    return items


def collect(sources: list[dict[str, str]], hours: int = 24) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=hours)

    all_items: list[dict[str, Any]] = []
    for src in sources:
        name = src.get("name", src.get("url", "unknown"))
        url = src.get("url", "")
        items = _fetch_rss(name, url, cutoff)
        print(f"  ✅ {name:<30} {len(items):>3} items")
        all_items.extend(items)
        time.sleep(0.1)

    all_items.sort(
        key=lambda x: x.get("published_at") or "0000",
        reverse=True,
    )

    return {
        "source": "media_rss",
        "collected_at": now.isoformat(),
        "hours": hours,
        "sources_count": len(sources),
        "item_count": len(all_items),
        "items": all_items,
    }
