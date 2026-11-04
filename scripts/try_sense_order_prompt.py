#!/usr/bin/env python3
"""Measure whether the model lists a word's most common meaning first.

Touches no database or application code. Each word costs one model call per run.

    scripts/try_sense_order_prompt.py                      # the app's prompt (kept in step with the adapter), 2 runs
    scripts/try_sense_order_prompt.py --runs 3
    scripts/try_sense_order_prompt.py --dry-run            # show the request; no key, no call

Each word below has a check on its FIRST listed meaning: the part of speech and/or a pattern the
definition must match. The checks are my reading of which meaning an adult learner living and
studying in Canada meets most often, so a miss is printed with the senses for a human to judge
(the pattern may be too narrow). The words avoid those the app's prompt uses as examples.

The key comes from VOCABFLOW_ANTHROPIC_API_KEY, or from .env in the repository root.
"""

import json
import pathlib
import re
import sys
import urllib.error

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import try_senses_prompt as senses  # the app's real enrichment prompt and schema

# Measured with earlier wordings (first meaning right in 72 replies of 24 words, 3 runs): "most common first"
# 61 and 64; "ordered by how often people meet each one" 66; "random sentence" 63; this prompt with a
# 1-5 frequency per meaning, sorted by it, 67.

# word -> (accepted parts of speech or None, regex the first definition must match or None)
CHECKS = {
    "manifest": ({"verb", "adjective"}, None),
    "file": (None, r"document|computer|record|folder|data|stored"),
    "charge": (None, r"fee|price|cost|money|pay|amount"),
    "bill": (None, r"invoice|payment|pay|money|amount|owe|cost"),
    "fine": ({"adjective"}, None),
    "subject": (None, r"topic|school|study|matter|course|area"),
    "issue": (None, r"problem|topic|matter|subject|concern|question"),
    "party": (None, r"celebration|social|gathering|event|enjoy"),
    "interest": (None, r"curious|attention|hobby|want(ing)? to (know|learn)|enjoy|liking|money|borrow"),
    "lead": ({"verb"}, None),
    "object": ({"noun"}, r"thing"),
    "content": ({"noun"}, None),
    "minute": ({"noun"}, r"time|60|sixty|second"),
    "novel": ({"noun"}, r"book|story|fiction"),
    "express": ({"verb"}, None),
    "sentence": (None, r"words|grammar|written|spoken"),
    "spring": (None, r"season|warm|march|after winter"),
    "season": (None, r"year|weather|time|period|winter|summer|spring"),
    "mean": ({"verb"}, r"signify|express|represent|intend|refer|show|indicate|stand for|to be"),
    "date": (None, r"day|calendar|month|time|year"),
    "plant": (None, r"tree|grow|living|flower|vegetable|organism"),
    "pound": (None, r"weight|unit|mass|currency|money|454"),
    "refuse": ({"verb"}, None),
    "address": (None, r"live|location|place|where|street|speak|deal|problem|issue|talk"),
}


def first_sense_ok(word, entry):
    senses_list = entry["senses"]
    if not senses_list:
        return False
    first = senses_list[0]
    pos, pattern = CHECKS[word]
    if pos is not None and first["partOfSpeech"].strip().lower() not in pos:
        return False
    if pattern is not None and not re.search(pattern, first["definition"], re.IGNORECASE):
        return False
    return True


def run(word, key):
    reply = senses.call(word, key)
    if reply.get("stop_reason") != "end_turn":
        raise ValueError("stopped")
    text = next(block["text"] for block in reply["content"] if block["type"] == "text")
    return json.loads(text), reply["usage"]


def main():
    args = sys.argv[1:]
    runs = int(args[args.index("--runs") + 1]) if "--runs" in args else 2
    if "--dry-run" in args:
        print(json.dumps(senses.request_body("manifest"), indent=2))
        return 0

    key = senses.api_key()
    if not key:
        print("Set VOCABFLOW_ANTHROPIC_API_KEY, or put it in .env.", file=sys.stderr)
        return 1

    right = total = failures = tokens_in = tokens_out = 0
    for word in CHECKS:
        for number in range(1, runs + 1):
            try:
                entry, usage = run(word, key)
            except urllib.error.HTTPError as error:
                failures += 1
                print(f"{word} (run {number}): failed with HTTP {error.code}")
                continue
            except (urllib.error.URLError, TimeoutError, ValueError, KeyError, StopIteration) as error:
                failures += 1
                print(f"{word} (run {number}): failed ({type(error).__name__})")
                continue
            tokens_in += usage["input_tokens"]
            tokens_out += usage["output_tokens"]
            total += 1
            # What the app does with the reply: most frequent first (a tie keeps the order), 1s dropped.
            ranked = sorted(entry["senses"], key=lambda sense: -sense["frequency"])
            entry["senses"] = [sense for sense in ranked if sense["frequency"] > 1] or ranked[:1]
            ok = first_sense_ok(word, entry)
            right += ok
            order = "; ".join(
                f"({sense['frequency']}) {sense['partOfSpeech']}: {sense['definition'][:48]}"
                for sense in entry["senses"]
            )
            print(f"{'ok  ' if ok else 'MISS'} {word} (run {number}): {order}")

    print(f"\nThe app's prompt: first meaning right in {right} of {total} replies, {failures} failed.")
    print(f"Model {senses.MODEL}: {tokens_in} input tokens, {tokens_out} output tokens.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
