#!/usr/bin/env python3
"""Maintain the video catalog (backend/src/main/resources/videos/catalog.json), the albums of English
lessons on YouTube that the app shows by CLB level. Only the owner's assistant changes it.

    scripts/video_catalog.py check                              # re-verify every video (needs network)
    scripts/video_catalog.py add ALBUM_ID VIDEO_ID [VIDEO_ID...]  # look up videos and append them to an album

A video is kept only if YouTube's oEmbed answers 200 (embedding allowed; 401 or 404 means no). The title
and channel come from oEmbed and the length from the public watch page (`lengthSeconds`). Only
videos on the official channel of their source are used, never re-uploads. Nothing is downloaded.
"""
import json
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

CATALOG = pathlib.Path(__file__).resolve().parent.parent / "backend/src/main/resources/videos/catalog.json"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", "Accept-Language": "en-US,en;q=0.9"}


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as response:
        return response.read().decode("utf-8", "replace")


def lookup(video_id):
    """(title, channel, seconds) for a video that may be embedded; raises ValueError otherwise."""
    query = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={video_id}", safe="")
    try:
        info = json.loads(fetch(query))
    except urllib.error.HTTPError as error:
        raise ValueError(f"{video_id}: embedding not allowed or video gone (HTTP {error.code})")
    length = re.search(r'"lengthSeconds":"(\d+)"', fetch(f"https://www.youtube.com/watch?v={video_id}"))
    if not length:
        raise ValueError(f"{video_id}: could not read the length")
    return info["title"].strip(), info["author_name"].strip(), int(length.group(1))


def load():
    return json.loads(CATALOG.read_text())


def save(catalog):
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")


def check():
    catalog = load()
    bad = 0
    for album in catalog["albums"]:
        for video in album["videos"]:
            try:
                title, channel, seconds = lookup(video["id"])
            except ValueError as error:
                bad += 1
                print("PROBLEM", album["id"], error)
                continue
            if seconds != video["durationSeconds"]:
                print("changed length", album["id"], video["id"], video["durationSeconds"], "->", seconds)
            time.sleep(0.4)
    print("all videos fine" if bad == 0 else f"{bad} video(s) need attention")
    return 1 if bad else 0


def add(album_id, video_ids):
    catalog = load()
    album = next((a for a in catalog["albums"] if a["id"] == album_id), None)
    if album is None:
        print("no such album:", album_id, "| albums:", ", ".join(a["id"] for a in catalog["albums"]))
        return 1
    for video_id in video_ids:
        if any(v["id"] == video_id for v in album["videos"]):
            print("already in the album:", video_id)
            continue
        title, channel, seconds = lookup(video_id)
        album["videos"].append({"id": video_id, "title": title, "channel": channel, "durationSeconds": seconds})
        print("added", video_id, "|", channel, "|", title, f"| {seconds} s")
        time.sleep(0.4)
    save(catalog)
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["check"]:
        sys.exit(check())
    if args[:1] == ["add"] and len(args) >= 3:
        sys.exit(add(args[1], args[2:]))
    print(__doc__)
    sys.exit(2)
