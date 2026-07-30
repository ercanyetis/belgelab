#!/usr/bin/env python3
"""Validate generated pages against Tool Page Standard v1.0."""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser

from generate_tool_pages import ROOT, TOOLS, words

REGISTRY = {
    "pdf-editor", "pdf-compress", "create-word", "create-excel", "create-powerpoint",
    "pdf-to-word", "pdf-to-powerpoint", "pdf-to-excel", "word-to-pdf", "dwg-to-pdf",
    "powerpoint-to-pdf", "excel-to-pdf", "pdf-to-jpg", "jpg-to-pdf", "pdf-sign",
    "pdf-watermark", "pdf-rotate", "pdf-unlock", "pdf-protect", "pdf-page-numbers",
    "pdf-repair", "pdf-crop", "pdf-compare", "pdf-to-markdown",
}
REQUIRED_IDS = {
    "tool-title", "arac-hakkinda", "nasil-kullanilir", "neden-belgelab",
    "avantajlar", "guvenlik", "ipuclari", "sss", "ilgili-araclar", "yardim",
}
HELP_LINKS = {"/hakkimizda.html", "/iletisim.html", "/privacy.html", "/terms.html"}


class PageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.ids: list[str] = []
        self.h1_count = 0
        self.details_count = 0
        self.hrefs: list[str] = []
        self.meta_description = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if values.get("id"):
            self.ids.append(values["id"] or "")
        if tag == "h1":
            self.h1_count += 1
        elif tag == "details":
            self.details_count += 1
        elif tag == "a" and values.get("href"):
            self.hrefs.append(values["href"] or "")
        elif tag == "meta" and values.get("name") == "description":
            self.meta_description = values.get("content") or ""


def main() -> int:
    errors: list[str] = []
    for filename, config in TOOLS.items():
        source = (ROOT / filename).read_text(encoding="utf-8")
        parser = PageParser()
        parser.feed(source)
        if parser.h1_count != 1:
            errors.append(f"{filename}: H1 sayısı {parser.h1_count}")
        if len(parser.ids) != len(set(parser.ids)):
            errors.append(f"{filename}: yinelenen id var")
        missing_ids = REQUIRED_IDS.difference(parser.ids)
        if missing_ids:
            errors.append(f"{filename}: eksik bölümler {sorted(missing_ids)}")
        if parser.details_count < 6:
            errors.append(f"{filename}: yalnızca {parser.details_count} SSS var")
        if not HELP_LINKS.issubset(parser.hrefs):
            errors.append(f"{filename}: yardım bağlantıları eksik")
        tool_links = [href for href in parser.hrefs if href.startswith("/?tool=")]
        if tool_links != [f"/?tool={config[1]}", f"/?tool={config[1]}"]:
            errors.append(f"{filename}: CTA araç kimliği hatalı")
        if config[1] not in REGISTRY:
            errors.append(f"{filename}: registry dışında araç kimliği {config[1]}")
        if not 80 <= len(parser.meta_description) <= 165:
            errors.append(f"{filename}: meta description uzunluğu {len(parser.meta_description)}")
        about_match = re.search(
            r'<h2 id="arac-hakkinda">.*?</h2><p>(.*?)</p></section>', source, re.S
        )
        about_count = words(re.sub(r"<[^>]+>", "", about_match.group(1))) if about_match else 0
        if not 120 <= about_count <= 180:
            errors.append(f"{filename}: Araç Hakkında {about_count} kelime")
        schema_match = re.search(
            r'<script type="application/ld\+json">(.*?)</script>', source, re.S
        )
        try:
            schema = json.loads(schema_match.group(1)) if schema_match else {}
            entities = schema.get("@graph", [])[1].get("mainEntity", [])
            if len(entities) != parser.details_count:
                errors.append(f"{filename}: görünür SSS ve JSON-LD eşleşmiyor")
        except (json.JSONDecodeError, IndexError, AttributeError):
            errors.append(f"{filename}: geçersiz JSON-LD")
        for href in parser.hrefs:
            if href.startswith("/") and href.endswith(".html") and not (ROOT / href[1:]).is_file():
                errors.append(f"{filename}: kırık dahili bağlantı {href}")
    if errors:
        print("\n".join(errors))
        return 1
    print(f"{len(TOOLS)} araç sayfası standarda uygun.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
