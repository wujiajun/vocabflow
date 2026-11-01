#!/usr/bin/env python3
"""Try the reading-passage prompt on some words and print what the model writes.

Touches no database or application code. Each run costs one model call. The prompt is read from
ClaudeReadingAdapter.java, so it cannot drift from what the app sends; the level wording and the
length rule below mirror that class and must be kept in step with it.

    scripts/try_reading_prompt.py                      # the default 12 words, level CLB 4
    scripts/try_reading_prompt.py --level 7            # the level of the passage (the learner's CLB minus one)
    scripts/try_reading_prompt.py lease=A\ contract word2="some meaning"   # your own words (10 to 15)
    scripts/try_reading_prompt.py --dry-run            # show the request; no key, no call

The key comes from VOCABFLOW_ANTHROPIC_API_KEY, or from .env in the repository root.
"""

import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
ADAPTER = ROOT / "backend/src/main/java/com/vocabflow/reading/infrastructure/ClaudeReadingAdapter.java"
MODEL = os.environ.get("VOCABFLOW_READING_MODEL", os.environ.get("VOCABFLOW_ENRICHMENT_MODEL", "claude-haiku-5-5"))

DEFAULT_WORDS = {
    "orthogonal": "adjective: Meeting at right angles, or independent of each other.",
    "determinant": "noun: A factor that decides what will happen.",
    "reproduce": "verb: To produce again, or to have offspring.",
    "distribution": "noun: The way something is shared out or spread among people or places.",
    "sleeve": "noun: The part of a garment that covers the arm.",
    "rectangular": "adjective: Shaped like a rectangle.",
    "lease": "noun: A contract to rent a property for a set time.",
    "landlord": "noun: A person who rents out a home to others.",
    "overwhelmed": "adjective: Feeling unable to cope because there is too much to deal with.",
    "figure out": "phrasal verb: To understand or solve something.",
    "resume": "verb: To begin again after stopping.",
    "deposit": "noun: A sum of money paid in advance and returned later.",
}


def system_prompt():
    """The SYSTEM_PROMPT text block of the adapter, as Java reads it."""
    source = ADAPTER.read_text(encoding="utf-8")
    match = re.search(r'SYSTEM_PROMPT =\s*"""\n(.*?)""";', source, re.S)
    if not match:
        sys.exit("Could not find SYSTEM_PROMPT in ClaudeReadingAdapter.java")
    lines = [line[6:] if line.startswith("      ") else line.strip() for line in match.group(1).split("\n")]
    return "\n".join(lines).replace("\\\n", "")


def level_description(level):
    if level <= 2:
        return f"CLB {level}, beginner: very short sentences of about 8 words, the most common words, mostly the present tense"
    if level <= 4:
        return f"CLB {level}, elementary: sentences of up to about 12 words, everyday vocabulary, simple past and future"
    if level <= 6:
        return (f"CLB {level}, intermediate: clear sentences of up to about 18 words, common connecting words such as "
                "because and although, everyday and workplace vocabulary")
    if level <= 8:
        return f"CLB {level}, upper intermediate: varied sentences with some complex structures, a wider vocabulary, light use of idioms"
    return f"CLB {level}, advanced: fluent, natural prose like a newspaper feature, with varied structures and vocabulary"


def length(level, count):
    bands = [(80, 120), (120, 180), (180, 260), (250, 330), (300, 400)]
    band = bands[0 if level <= 2 else 1 if level <= 4 else 2 if level <= 6 else 3 if level <= 8 else 4]
    low = max(band[0], count * 16)
    return low, max(band[1], low + 80)


def escape(value):
    return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def user_message(level, words):
    low, high = length(level, len(words))
    parts = [f"<level>{level_description(level)}</level>", f"<length>about {low} to {high} words</length>", "<targets>"]
    for term, meaning in words.items():
        parts.append(f"<target><term>{escape(term)}</term><meaning>{escape(meaning)}</meaning></target>")
    parts.append("</targets>")
    return "\n".join(parts)


SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "text": {"type": "string"},
        "used": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"term": {"type": "string"}, "form": {"type": "string"}},
                "required": ["term", "form"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "text", "used"],
    "additionalProperties": False,
}


def request_body(level, words):
    return {
        "model": MODEL,
        "max_tokens": 4096,
        "thinking": {"type": "disabled"},
        "system": system_prompt(),
        "messages": [{"role": "user", "content": user_message(level, words)}],
        "output_config": {"format": {"type": "json_schema", "schema": SCHEMA}},
    }


def api_key():
    key = os.environ.get("VOCABFLOW_ANTHROPIC_API_KEY", "").strip()
    if key:
        return key
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("VOCABFLOW_ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return ""


def call(level, words, key):
    request = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(request_body(level, words)).encode("utf-8"),
        headers={"content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return json.load(response)


def norm(value):
    return " ".join(value.split()).lower()


def mark(text, forms):
    """Wraps every whole-word, case-insensitive use of each form in [[ ]], as the app does.

    Returns the marked text and the forms that are not in the text.
    """
    spans, missing = [], []
    for form in sorted({" ".join(f.split()) for f in forms if f.strip()}, key=len, reverse=True):
        pattern = r"(?<![^\W_])(?<!-)" + r"\s+".join(re.escape(part) for part in form.split(" ")) + r"(?![^\W_])(?!-)"
        found = False
        for match in re.finditer(pattern, text, re.I):
            found = True
            if not any(match.start() < end and match.end() > start for start, end in spans):
                spans.append((match.start(), match.end()))
        if not found:
            missing.append(form)
    out, position = [], 0
    for start, end in sorted(spans):
        out.append(text[position:start] + "[[" + text[start:end] + "]]")
        position = end
    out.append(text[position:])
    return "".join(out), missing


def show(words, reply):
    if reply.get("stop_reason") != "end_turn":
        print(f"stopped with {reply.get('stop_reason')}")
        return
    entry = json.loads(next(block["text"] for block in reply["content"] if block["type"] == "text"))
    text = entry["text"]
    covered = {norm(item["term"]) for item in entry["used"]}
    absent = [term for term in words if norm(term) not in covered]
    marked, missing = mark(text, [item["form"] for item in entry["used"]])
    print(f"# {entry['title']}\n")
    print(marked)
    print(f"\n({len(text.split())} words)")
    for item in entry["used"]:
        print(f"  {item['term']} -> {item['form']}")
    if "[[" in text or "]]" in text:
        print("THE APP WOULD REFUSE THIS: the text has square brackets of its own")
    if absent:
        print(f"THE APP WOULD REFUSE THIS: no entry in 'used' for {absent}")
    if missing:
        print(f"THE APP WOULD REFUSE THIS: these forms are not in the text: {missing}")


def main():
    args = sys.argv[1:]
    level = 4
    if "--level" in args:
        index = args.index("--level")
        level = int(args[index + 1])
        del args[index : index + 2]
    dry_run = "--dry-run" in args
    args = [arg for arg in args if arg != "--dry-run"]
    words = dict(arg.split("=", 1) for arg in args) if args else DEFAULT_WORDS
    if not 10 <= len(words) <= 15:
        sys.exit(f"The app writes from 10 to 15 words; this has {len(words)}.")
    if dry_run:
        print(json.dumps(request_body(level, words), indent=2))
        return 0
    key = api_key()
    if not key:
        print("No key: set VOCABFLOW_ANTHROPIC_API_KEY or put it in .env", file=sys.stderr)
        return 1
    try:
        reply = call(level, words, key)
        show(words, reply)
        print(f"\nModel {MODEL}: {reply['usage']['input_tokens']} input tokens, {reply['usage']['output_tokens']} output tokens.")
    except urllib.error.HTTPError as error:
        # The status only: an error body is not needed here and could echo the request.
        print(f"failed with HTTP {error.code}")
        return 1
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError, StopIteration) as error:
        print(f"failed ({type(error).__name__})")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
