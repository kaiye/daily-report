from __future__ import annotations

from typing import Any
from jinja2 import Template

TEMPLATE = Template("""
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ report.title }}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 16px; line-height: 1.6; }
    h1, h2, h3 { line-height: 1.25; }
    .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin: 16px 0; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <h1>{{ report.title }}</h1>
  <p>{{ report.summary }}</p>
  {% for section in report.sections %}
    <h2>{{ section.name }}</h2>
    <p>{{ section.summary }}</p>
    {% for item in section.items %}
      <div class="card">
        <h3><a href="{{ item.url }}">{{ item.repo }}</a></h3>
        <p>{{ item.why_it_matters }}</p>
        <ul>
          {% for h in item.highlights %}<li>{{ h }}</li>{% endfor %}
        </ul>
      </div>
    {% endfor %}
  {% endfor %}
</body>
</html>
""")


def render_html(report: dict[str, Any]) -> str:
    return TEMPLATE.render(report=report)
