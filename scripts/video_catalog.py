#!/usr/bin/env python3
"""Maintain the video catalog (backend/src/main/resources/videos/catalog.json), the albums of English
lessons on YouTube that the app shows by CLB level. Only the owner's assistant changes it.

    scripts/video_catalog.py check                               # re-verify every video
    scripts/video_catalog.py add ALBUM_ID VIDEO_ID [VIDEO_ID...]   # look videos up and append them to an album
    scripts/video_catalog.py playlist PLAYLIST_ID                # list a playlist (to choose from), writes nothing

A video is kept only if it is public and may be embedded. Titles, channels and lengths come from YouTube's
official Data API when `VOCABFLOW_YOUTUBE_API_KEY` is set (in the environment or in the repository's
`.env`; it is never printed); without a key, oEmbed and the public watch page are used one video at a time,
which only suits a few videos. Only videos of the official channel of their source are used, never
re-uploads, and nothing is downloaded. A title taken from YouTube is often long: shorten it by hand after `add`.
"""
import json
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOG = ROOT / "backend/src/main/resources/videos/catalog.json"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", "Accept-Language": "en-US,en;q=0.9"}


def api_key():
    if os.environ.get("VOCABFLOW_YOUTUBE_API_KEY"):
        return os.environ["VOCABFLOW_YOUTUBE_API_KEY"]
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("VOCABFLOW_YOUTUBE_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def api(path, **params):
    params["key"] = api_key()
    url = "https://www.googleapis.com/youtube/v3/" + path + "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise ValueError(f"YouTube API answered HTTP {error.code} for {path}")


def seconds(iso):
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso)
    d, h, mi, s = (int(x or 0) for x in m.groups())
    return d * 86400 + h * 3600 + mi * 60 + s


def lookup_many(video_ids):
    """{id: (title, channel, seconds)} for videos that are public and may be embedded; the others are missing."""
    found = {}
    if api_key():
        for i in range(0, len(video_ids), 50):
            reply = api("videos", part="snippet,contentDetails,status", id=",".join(video_ids[i:i + 50]))
            for v in reply["items"]:
                if v["status"]["privacyStatus"] == "public" and v["status"].get("embeddable"):
                    found[v["id"]] = (v["snippet"]["title"].strip(), v["snippet"]["channelTitle"].strip(), seconds(v["contentDetails"]["duration"]))
        return found
    for video_id in video_ids:
        query = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={video_id}", safe="")
        try:
            with urllib.request.urlopen(urllib.request.Request(query, headers=UA), timeout=30) as response:
                info = json.load(response)
            page = urllib.request.urlopen(urllib.request.Request(f"https://www.youtube.com/watch?v={video_id}", headers=UA), timeout=30).read().decode("utf-8", "replace")
        except urllib.error.HTTPError:
            continue
        length = re.search(r'"lengthSeconds":"(\d+)"', page)
        if length:
            found[video_id] = (info["title"].strip(), info["author_name"].strip(), int(length.group(1)))
        time.sleep(0.4)
    return found


def load():
    return json.loads(CATALOG.read_text())


def save(catalog):
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")


def check():
    catalog = load()
    ids = [v["id"] for a in catalog["albums"] for v in a["videos"]]
    found = lookup_many(sorted(set(ids)))
    bad = 0
    for album in catalog["albums"]:
        for video in album["videos"]:
            if video["id"] not in found:
                bad += 1
                print("PROBLEM", album["id"], video["id"], video["title"], "(not public, or embedding is off, or gone)")
            elif found[video["id"]][2] != video["durationSeconds"]:
                print("changed length", album["id"], video["id"], video["durationSeconds"], "->", found[video["id"]][2])
    print(f"{len(ids)} videos in {len(catalog['albums'])} albums:", "all fine" if bad == 0 else f"{bad} need attention")
    return 1 if bad else 0


def add(album_id, video_ids):
    catalog = load()
    album = next((a for a in catalog["albums"] if a["id"] == album_id), None)
    if album is None:
        print("no such album:", album_id, "| albums:", ", ".join(a["id"] for a in catalog["albums"]))
        return 1
    wanted = [v for v in video_ids if not any(x["id"] == v for x in album["videos"])]
    found = lookup_many(wanted)
    for video_id in wanted:
        if video_id not in found:
            print("not added (not public, or embedding is off, or gone):", video_id)
            continue
        title, channel, length = found[video_id]
        album["videos"].append({"id": video_id, "title": title, "channel": channel, "durationSeconds": length})
        print("added", video_id, "|", channel, "|", title, f"| {length} s")
    save(catalog)
    return 0


def playlist(playlist_id):
    ids, token = [], None
    while True:
        params = dict(part="contentDetails", playlistId=playlist_id, maxResults=50)
        if token:
            params["pageToken"] = token
        reply = api("playlistItems", **params)
        ids += [i["contentDetails"]["videoId"] for i in reply["items"]]
        token = reply.get("nextPageToken")
        if not token:
            break
    found = lookup_many(ids)
    for video_id in ids:
        if video_id in found:
            title, channel, length = found[video_id]
            print(f"{video_id} {length:5d}s {channel} | {title}")
        else:
            print(f"{video_id}  (not public, or embedding is off)")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    if args[:1] == ["check"]:
        sys.exit(check())
    if args[:1] == ["add"] and len(args) >= 3:
        sys.exit(add(args[1], args[2:]))
    if args[:1] == ["playlist"] and len(args) == 2:
        if not api_key():
            print("The playlist command needs VOCABFLOW_YOUTUBE_API_KEY.")
            sys.exit(1)
        sys.exit(playlist(args[1]))
    print(__doc__)
    sys.exit(2)
