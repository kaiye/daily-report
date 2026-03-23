"""
PNG renderer — screenshots an HTML file to a PNG.

Strategy:
  1. Try Playwright (headless Chromium) — best quality
  2. Fallback: warn and skip (wkhtmltoimage is fragile in CI)

Usage in CI: install playwright with `playwright install chromium --with-deps`
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


def render_png(html_content: str, output_path: Path, width: int = 900) -> bool:
    """
    Render HTML string to PNG.

    Args:
        html_content: Full HTML as string
        output_path: Where to write the PNG file
        width: Viewport width in pixels

    Returns:
        True if successful, False if skipped.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write HTML to a temp file
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", encoding="utf-8", delete=False) as f:
        f.write(html_content)
        tmp_html = Path(f.name)

    try:
        return _try_playwright(tmp_html, output_path, width)
    finally:
        tmp_html.unlink(missing_ok=True)


def _try_playwright(html_path: Path, output_path: Path, width: int) -> bool:
    """Use Playwright headless Chromium to screenshot the HTML page."""
    script = f"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={{"width": {width}, "height": 1200}})
        await page.goto("file://{html_path.resolve()}")
        await page.wait_for_load_state("networkidle")
        # Get full page height
        height = await page.evaluate("document.body.scrollHeight")
        await page.set_viewport_size({{"width": {width}, "height": max(height, 800)}})
        await page.screenshot(path="{output_path.resolve()}", full_page=True)
        await browser.close()

asyncio.run(main())
"""
    try:
        result = subprocess.run(
            [sys.executable, "-c", script],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            print(f"  ✅ PNG saved: {output_path}")
            return True
        else:
            print(f"  ⚠  Playwright failed: {result.stderr[:300]}", file=sys.stderr)
            print("     Install with: pip install playwright && playwright install chromium --with-deps",
                  file=sys.stderr)
            return False
    except FileNotFoundError:
        print("  ⚠  Playwright not installed. Skip PNG rendering.", file=sys.stderr)
        return False
    except subprocess.TimeoutExpired:
        print("  ⚠  Playwright timed out.", file=sys.stderr)
        return False
