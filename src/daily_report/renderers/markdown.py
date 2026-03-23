"""
Markdown renderer — converts section YAML into a Markdown report.
"""
from __future__ import annotations

from typing import Any


def _render_media(report: dict[str, Any]) -> str:
    lines = [
        f"# {report.get('title', 'Media Report')}",
        "",
        report.get("summary", ""),
        "",
    ]
    for item in report.get("items", []):
        title = item.get("title", "")
        url = item.get("url", "")
        source = item.get("source", "")
        pub = item.get("published_at", "")[:10] if item.get("published_at") else ""
        why = item.get("why_it_matters", "")

        lines.append(f"### [{title}]({url})")
        lines.append(f"*{source}* · {pub}")
        lines.append("")
        lines.append(why)
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _render_github(report: dict[str, Any]) -> str:
    lines = [
        f"# {report.get('title', 'GitHub Trending')}",
        "",
        report.get("summary", ""),
        "",
    ]
    for item in report.get("items", []):
        repo = item.get("repo", "")
        url = item.get("url", "")
        desc = item.get("description", "")
        lang = item.get("language", "")
        stars_today = item.get("stars_today", 0)
        stars_total = item.get("stars_total", 0)
        why = item.get("why_it_matters", "")

        lines.append(f"### [{repo}]({url})")
        meta_parts = []
        if lang:
            meta_parts.append(lang)
        if stars_today:
            meta_parts.append(f"⭐ +{stars_today:,} today")
        if stars_total:
            meta_parts.append(f"{stars_total:,} total")
        if meta_parts:
            lines.append("*" + " · ".join(meta_parts) + "*")
        lines.append("")
        if desc:
            lines.append(desc)
            lines.append("")
        lines.append(why)
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def _render_x(report: dict[str, Any]) -> str:
    lines = [
        f"# {report.get('title', 'X Trending')}",
        "",
        report.get("summary", ""),
        "",
    ]
    for item in report.get("items", []):
        handle = item.get("author_handle", "")
        name = item.get("author_name", "")
        url = item.get("url", "")
        text = item.get("text", "")
        views = item.get("view_count", 0)
        likes = item.get("like_count", 0)
        why = item.get("why_it_matters", "")

        author_str = f"@{handle}" if handle else name
        lines.append(f"### [{author_str}]({url})")
        if views or likes:
            lines.append(f"*👁 {views:,} · ❤️ {likes:,}*")
        lines.append("")
        lines.append(f"> {text}")
        lines.append("")
        lines.append(why)
        lines.append("")
    return "\n".join(lines).strip() + "\n"


SECTION_RENDERERS = {
    "media": _render_media,
    "github": _render_github,
    "x": _render_x,
}


def render_markdown(report: dict[str, Any]) -> str:
    """Auto-dispatch to the right renderer based on report['section']."""
    section = report.get("section", "github")
    renderer = SECTION_RENDERERS.get(section, _render_github)
    return renderer(report)
