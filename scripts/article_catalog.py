#!/usr/bin/env python3
"""Keeps the article catalog (backend/src/main/resources/articles/catalog.json).

The articles are VOA Learning English texts. VOA says the text it produces itself is public domain
(credit learningenglish.voanews.com); anything from a wire service (AP, Reuters, AFP ...) is not, so
such an article is skipped. Images are never taken, audio is only linked (never downloaded).

Politeness: one request every 1.5 seconds, a generic client name, pages cached on disk. Only the
sitemap, the RSS feeds, the program pages (/z/<id>) and the article pages are fetched. Never the
paginated archive (?p=) or /z/*/*/*/*, which robots.txt disallows (the script refuses those).

Usage (standard library only):
  scripts/article_catalog.py harvest --cache DIR [--per-program 45]   # crawl, filter, rewrite the catalog
  scripts/article_catalog.py check                                     # validate the catalog file

`harvest` finds articles from each program's RSS feed and page, then follows the "related" links on the
articles it has read, keeping only addresses that are also listed in the sitemap.
"""

import argparse
import gzip
import hashlib
import html
import json
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

HOST = "https://learningenglish.voanews.com"
USER_AGENT = "Mozilla/5.0 (compatible; VocabFlowCatalog/1.0; personal educational use)"
DELAY_SECONDS = 1.5
CATALOG = Path(__file__).resolve().parent.parent / "backend/src/main/resources/articles/catalog.json"

# Zone id (the number in /z/<id>) -> album. CLB ranges are a judgment from word and sentence length.
PROGRAMS = {
    "5535": {
        "id": "voa-ask-a-teacher",
        "title": "Ask a Teacher",
        "description": "Short answers to questions about everyday American English: words, grammar and usage.",
        "clbMin": 4,
        "clbMax": 6,
        "feed": "/api/zti_qvl-vomx-tpekgvqr",
    },
    "987": {
        "id": "voa-words-and-their-stories",
        "title": "Words & Their Stories",
        "description": "Where English words and sayings come from, and how Americans use them.",
        "clbMin": 4,
        "clbMax": 6,
        "feed": None,
    },
    "1581": {
        "id": "voa-american-stories",
        "title": "American Stories",
        "description": "Short stories by famous American authors, rewritten in simpler English.",
        "clbMin": 5,
        "clbMax": 7,
        "feed": "/api/zyg__l-vomx-tpetmty",
    },
}
SOURCE = "VOA Learning English"
WIRE = re.compile(r"\b(AP|Reuters|AFP|Associated Press|Agence France|Getty|Bloomberg)\b")
WORDS_PER_MINUTE = 150  # a learner's pace, not a native reader's
MIN_WORDS, MAX_WORDS = 150, 2600

last_request = 0.0


def fetch(url, cache):
    if "?p=" in url or re.search(r"/z/[^/]+/[^/]+/[^/]+/[^/]+", url):
        sys.exit(f"Refusing {url}: robots.txt disallows it")
    path = cache / (hashlib.sha1(url.encode()).hexdigest() + ".bin")
    if path.exists():
        return path.read_bytes()
    global last_request
    wait = DELAY_SECONDS - (time.time() - last_request)
    if wait > 0:
        time.sleep(wait)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            data = response.read()
    except Exception as exc:  # a page that cannot be read is skipped, not fatal
        print(f"  cannot read {url}: {exc}", file=sys.stderr)
        data = b""
    last_request = time.time()
    path.write_bytes(data)
    return data


def sitemap_ids(cache):
    index = fetch(HOST + "/sitemap.xml", cache).decode()
    ids = set()
    for loc in re.findall(r"<loc>([^<]+_\d+\.xml\.gz)</loc>", index):
        raw = fetch(loc, cache)
        text = gzip.decompress(raw).decode() if raw else ""
        ids.update(re.findall(r"/a/(?:[^/<]+/)?(\d+)\.html", text))
    return ids


class Article(HTMLParser):
    """Reads the text, glossary, audio and zone out of one article page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.zone = None
        self.title = None
        self.published = None
        self.audio = None
        self.paragraphs = []
        self.glossary = []
        self.has_image = False
        self.related = set()
        self._wsw_depth = 0
        self._embed_depth = 0
        self._div_stack = []
        self._text = None
        self._strong = None
        self._rest = None
        self._in_h2 = False
        self._glossary_mode = False
        self._body_done = False
        self._category = False
        self._h1 = False
        self._strong_done = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = a.get("class") or ""
        if tag == "meta" and a.get("property") == "article:published_time":
            self.published = a.get("content")
        if tag == "div" and "js-category" in cls:
            self._category = True
        if tag == "a" and self._category and self.zone is None:
            m = re.match(r"/z/(\d+)$", a.get("href") or "")
            if m:
                self.zone = m.group(1)
        if tag == "h1" and "pg-title" in cls:
            self._h1 = True
            self._buf_title = []
        if tag == "a":
            m = re.search(r"/a/(?:[^/]+/)?(\d+)\.html", a.get("href") or "")
            if m:
                self.related.add(m.group(1))
        if tag == "div":
            self._div_stack.append("wsw" if "wsw" in cls.split() else "embed" if "wsw__embed" in cls else "")
            if "wsw" in cls.split():
                self._wsw_depth += 1
            if "wsw__embed" in cls:
                self._embed_depth += 1
        if tag == "source" or tag == "a":
            for key in ("src", "href"):
                value = a.get(key) or ""
                if value.endswith(".mp3") and "_hq" not in value and self.audio is None:
                    self.audio = value
        if self._wsw_depth and not self._embed_depth:
            if tag == "img" or tag == "figure":
                self.has_image = True
            if tag == "h2":
                self._in_h2 = True
                self._text = []
            if tag == "p":
                self._text = []
                self._strong = None
                self._strong_done = False
                self._rest = []
            if tag == "strong" and self._glossary_mode and self._text is not None and self._strong is None:
                self._strong = []

    def handle_endtag(self, tag):
        if tag == "div" and self._div_stack:
            kind = self._div_stack.pop()
            if kind == "wsw":
                self._wsw_depth -= 1
            if kind == "embed":
                self._embed_depth -= 1
        if tag == "h1" and self._h1:
            self._h1 = False
            self.title = " ".join("".join(self._buf_title).split())
        if tag == "div":
            self._category = False
        if not (self._wsw_depth and not self._embed_depth):
            return
        if tag == "h2" and self._in_h2:
            self._in_h2 = False
            heading = "".join(self._text or []).strip()
            self._text = None
            if "Words in This Story" in heading:
                self._glossary_mode = True
                self._body_done = True
        if tag == "strong" and self._strong is not None and self._glossary_mode:
            self._strong_done = True
        if tag == "p" and self._text is not None:
            text = " ".join("".join(self._text).split())
            if self._glossary_mode:
                if self._strong is not None:
                    word = " ".join("".join(self._strong).split())
                    definition = " ".join("".join(self._rest or []).split()).lstrip("–-— ").strip()
                    if word and definition:
                        self.glossary.append({"word": word, "definition": definition})
            elif not self._body_done and text:
                if re.fullmatch(r"[_\-–—\s]{5,}", text):
                    self._body_done = True
                else:
                    self.paragraphs.append(text)
            self._text = None
            self._strong = None
            self._rest = None

    def handle_data(self, data):
        if self._h1:
            self._buf_title.append(data)
        if self._text is not None:
            self._text.append(data)
            if self._glossary_mode:
                if self._strong is not None and not self._strong_done:
                    self._strong.append(data)
                elif self._rest is not None:
                    self._rest.append(data)


NOISE = re.compile(
    r"learningenglish@voanews\.com|We want to hear from you|wrote this lesson|wrote this story|"
    r"^And that.s (Ask a Teacher|Words|American|all the time|the end)|^And that brings us to the end|^Until next time|"
    r"^(And )?now,? (the VOA Learning English program )?Words and Their Stories|^Now it.s your turn|^This lesson plan|"
    r"^Download activities|^Don.t forget to tune in|^You have heard the story|^The End$|^Editor.s Note: We are pleased|"
    r"^Quiz\b|Start the quiz|^I.m [A-Z][\w. ]+\.?$|^[A-Z][\w. ]+ (adapted|wrote|reported|edited)\b",
    re.I,
)


def parse_article(raw):
    parser = Article()
    parser.feed(raw)
    if parser.published is None:
        m = re.search(r'"datePublished":"(\d{4}-\d\d-\d\d)', raw)
        parser.published = m.group(1) if m else None
    paragraphs = [p for p in parser.paragraphs if not NOISE.search(p)]
    parser.paragraphs = paragraphs
    return parser


def stats(paragraphs):
    words = re.findall(r"[A-Za-z']+", " ".join(paragraphs))
    sentences = max(1, len(re.findall(r"[.!?]+(?:\s|$)", " ".join(paragraphs))))
    if not words:
        return 0, 0.0, 0.0
    return len(words), sum(len(w) for w in words) / len(words), len(words) / sentences


def harvest(args):
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    known = sitemap_ids(cache)
    print(f"sitemap lists {len(known)} articles")

    queue, seen = [], set()
    for zone, program in PROGRAMS.items():
        urls = [HOST + program["feed"]] if program["feed"] else []
        urls.append(f"{HOST}/z/{zone}")
        for url in urls:
            text = fetch(url, cache).decode(errors="ignore")
            for found in re.findall(r"/a/(?:[^/\"<]+/)?(\d+)\.html", text):
                if found in known and found not in seen:
                    seen.add(found)
                    queue.append(found)

    kept = {zone: [] for zone in PROGRAMS}
    skipped = []
    fetches = 0
    while queue and fetches < args.max_fetches and any(len(v) < args.per_program for v in kept.values()):
        article_id = queue.pop(0)
        url = f"{HOST}/a/{article_id}.html"
        raw = fetch(url, cache).decode(errors="ignore")
        fetches += 1
        if not raw:
            continue
        article = parse_article(raw)
        for found in article.related:
            if found in known and found not in seen:
                seen.add(found)
                queue.append(found)
        if article.zone not in PROGRAMS:
            continue
        if len(kept[article.zone]) >= args.per_program:
            continue
        words, letters, per_sentence = stats(article.paragraphs)
        text = " ".join(article.paragraphs)
        reason = None
        if not article.title or not article.published:
            reason = "no title or date"
        elif WIRE.search(text) or WIRE.search(" ".join(g["definition"] for g in article.glossary)):
            reason = "credits or quotes a wire service"
        elif len(article.paragraphs) < 3:
            reason = "text is not split into paragraphs"
        elif words < MIN_WORDS:
            reason = f"too short ({words} words)"
        elif words > MAX_WORDS:
            reason = f"too long ({words} words)"
        elif letters > 5.0 or per_sentence > 24:
            reason = f"too hard ({letters:.1f} letters per word, {per_sentence:.0f} words per sentence)"
        if reason:
            skipped.append((article_id, article.title, reason))
            continue
        kept[article.zone].append(
            {
                "id": article_id,
                "title": article.title,
                "publishedOn": article.published[:10],
                "readingMinutes": max(1, round(words / WORDS_PER_MINUTE)),
                "sourceUrl": f"{HOST}/a/{article_id}.html",
                "audioUrl": article.audio,
                "paragraphs": article.paragraphs,
                "glossary": article.glossary,
            }
        )
        print(f"  {PROGRAMS[article.zone]['title']}: {len(kept[article.zone])} {article.title} ({words} words)")

    albums = []
    for zone, program in PROGRAMS.items():
        articles = sorted(kept[zone], key=lambda a: a["publishedOn"], reverse=True)
        if articles:
            albums.append(
                {
                    "id": program["id"],
                    "title": program["title"],
                    "source": SOURCE,
                    "description": program["description"],
                    "clbMin": program["clbMin"],
                    "clbMax": program["clbMax"],
                    "articles": articles,
                }
            )
    CATALOG.parent.mkdir(parents=True, exist_ok=True)
    CATALOG.write_text(json.dumps({"albums": albums}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {sum(len(a['articles']) for a in albums)} articles in {len(albums)} albums; {fetches} pages read")
    print("skipped:")
    for item in skipped:
        print("  ", *item)
    check(args)


def check(_args):
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    problems, ids = [], set()
    for album in data["albums"]:
        if not (1 <= album["clbMin"] <= album["clbMax"] <= 12):
            problems.append(f"{album['id']}: impossible CLB range")
        for article in album["articles"]:
            key = article["id"]
            if key in ids:
                problems.append(f"{key}: listed twice")
            ids.add(key)
            if not article["paragraphs"]:
                problems.append(f"{key}: no text")
            if WIRE.search(" ".join(article["paragraphs"])):
                problems.append(f"{key}: mentions a wire service")
            if not article["sourceUrl"].startswith(HOST + "/a/"):
                problems.append(f"{key}: odd source address")
    print(f"{len(ids)} articles in {len(data['albums'])} albums; {len(problems)} problems")
    for problem in problems:
        print("  ", problem)
    if problems:
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    h = sub.add_parser("harvest")
    h.add_argument("--cache", required=True)
    h.add_argument("--per-program", type=int, default=45)
    h.add_argument("--max-fetches", type=int, default=400)
    h.set_defaults(run=harvest)
    c = sub.add_parser("check")
    c.set_defaults(run=check)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()
