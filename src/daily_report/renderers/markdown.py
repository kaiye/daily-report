from __future__ import annotations

from typing import Any


def render_markdown(report: dict[str, Any]) -> str:
    lines = [f"# {report['title']}", "", report.get("summary", ""), ""]
    for section in report.get("sections", []):
        lines += [f"## {section['name']}", "", section.get("summary", ""), ""]
        for item in section.get("items", []):
            lines.append(f"### [{item['repo']}]({item['url']})")
            lines.append("")
            lines.append(item.get("why_it_matters", ""))
            lines.append("")
            highlights = item.get("highlights", [])
            for h in highlights:
                lines.append(f"- {h}")
            lines.append("")
    return "\n".join(lines).strip() + "\n"
