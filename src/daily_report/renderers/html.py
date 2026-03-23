"""
HTML renderer — converts section YAML into a styled HTML page.
Also used as the basis for PNG screenshot rendering.

Note: Templates use subscript access (r['key']) instead of attribute access (r.key)
to avoid conflicts with Python dict built-in methods (e.g. dict.items()).
"""
from __future__ import annotations

from typing import Any
from jinja2 import Environment

_BASE_STYLES = """
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    max-width: 860px;
    margin: 40px auto;
    padding: 0 20px 60px;
    line-height: 1.65;
    color: #1a1a2e;
    background: #f8f9fc;
  }
  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 16px;
    padding: 28px 32px;
    margin-bottom: 32px;
  }
  .header h1 { font-size: 1.8rem; font-weight: 700; margin-bottom: 8px; }
  .header .meta { opacity: 0.85; font-size: 0.9rem; }
  .summary {
    background: white;
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 24px;
    color: #444;
    font-size: 1rem;
    border-left: 4px solid #667eea;
  }
  .card {
    background: white;
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07);
  }
  .card h3 { font-size: 1.05rem; margin-bottom: 6px; }
  .card h3 a { color: #2563eb; text-decoration: none; }
  .card h3 a:hover { text-decoration: underline; }
  .card .meta { font-size: 0.82rem; color: #888; margin-bottom: 10px; }
  .card .why { color: #333; font-size: 0.95rem; }
  .card .tweet-text {
    background: #f3f4f6;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 0.93rem;
    color: #222;
    margin-bottom: 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .tag {
    display: inline-block;
    background: #ede9fe;
    color: #5b21b6;
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 0.78rem;
    margin-right: 6px;
  }
  .stars { color: #f59e0b; }
"""

# Use r['key'] subscript access to avoid Python dict built-in method conflicts
_MEDIA_SRC = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ r['title'] }}</title>
  <style>{{ styles }}</style>
</head>
<body>
  <div class="header">
    <h1>📰 {{ r['title'] }}</h1>
    <div class="meta">{{ r['report_date'] }} · Media &amp; News</div>
  </div>
  <div class="summary">{{ r['summary'] }}</div>
  {% for item in r['items'] %}
  <div class="card">
    <h3><a href="{{ item['url'] }}">{{ item['title'] }}</a></h3>
    <div class="meta">
      <span class="tag">{{ item['source'] }}</span>
      {% if item.get('published_at') %} {{ item['published_at'][:10] }}{% endif %}
    </div>
    <div class="why">{{ item.get('why_it_matters', '') }}</div>
  </div>
  {% endfor %}
</body>
</html>"""

_GITHUB_SRC = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ r['title'] }}</title>
  <style>{{ styles }}</style>
</head>
<body>
  <div class="header">
    <h1>🐙 {{ r['title'] }}</h1>
    <div class="meta">{{ r['report_date'] }} · GitHub Trending</div>
  </div>
  <div class="summary">{{ r['summary'] }}</div>
  {% for item in r['items'] %}
  <div class="card">
    <h3><a href="{{ item['url'] }}">{{ item['repo'] }}</a></h3>
    <div class="meta">
      {% if item.get('language') %}<span class="tag">{{ item['language'] }}</span>{% endif %}
      {% if item.get('stars_today') %}<span class="stars">⭐ +{{ item['stars_today'] | format_num }} today</span>{% endif %}
      {% if item.get('stars_total') %} · {{ item['stars_total'] | format_num }} total{% endif %}
    </div>
    {% if item.get('description') %}<div class="why" style="color:#666;margin-bottom:6px;">{{ item['description'] }}</div>{% endif %}
    <div class="why">{{ item.get('why_it_matters', '') }}</div>
  </div>
  {% endfor %}
</body>
</html>"""

_X_SRC = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ r['title'] }}</title>
  <style>{{ styles }}</style>
</head>
<body>
  <div class="header">
    <h1>🐦 {{ r['title'] }}</h1>
    <div class="meta">{{ r['report_date'] }} · X / Twitter Trending</div>
  </div>
  <div class="summary">{{ r['summary'] }}</div>
  {% for item in r['items'] %}
  <div class="card">
    <h3><a href="{{ item['url'] }}">@{{ item.get('author_handle', '') }}{% if item.get('author_name') %} · {{ item['author_name'] }}{% endif %}</a></h3>
    <div class="meta">
      {% if item.get('view_count') %}👁 {{ item['view_count'] | format_num }}{% endif %}
      {% if item.get('like_count') %} · ❤️ {{ item['like_count'] | format_num }}{% endif %}
    </div>
    <div class="tweet-text">{{ item.get('text', '') }}</div>
    <div class="why">{{ item.get('why_it_matters', '') }}</div>
  </div>
  {% endfor %}
</body>
</html>"""


def _format_num(value) -> str:
    try:
        v = int(value)
    except (TypeError, ValueError):
        return str(value)
    if v >= 1_000_000:
        return f"{v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"{v/1_000:.1f}K"
    return str(v)


def _make_env() -> Environment:
    env = Environment(autoescape=False)
    env.filters["format_num"] = _format_num
    return env


_ENV = _make_env()

_SECTION_TEMPLATES = {
    "media": _ENV.from_string(_MEDIA_SRC),
    "github": _ENV.from_string(_GITHUB_SRC),
    "x": _ENV.from_string(_X_SRC),
}


def render_html(report: dict[str, Any]) -> str:
    """Render a section YAML dict into an HTML page string."""
    section = report.get("section", "github")
    tmpl = _SECTION_TEMPLATES.get(section, _SECTION_TEMPLATES["github"])
    # Pass as 'r' to avoid dict.items() method conflict
    return tmpl.render(r=report, styles=_BASE_STYLES)
