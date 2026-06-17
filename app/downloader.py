"""YouTube playlist parsing and media download via yt-dlp."""

from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import Any

import yt_dlp

DOWNLOADS_DIR = Path(__file__).resolve().parent.parent / "downloads"
DOWNLOADS_DIR.mkdir(exist_ok=True)

PLAYLIST_PATTERNS = (
    r"(?:https?://)?(?:www\.)?youtube\.com/playlist\?list=[\w-]+",
    r"(?:https?://)?(?:www\.)?youtube\.com/watch\?.*list=[\w-]+",
    r"(?:https?://)?youtu\.be/[\w-]+\?list=[\w-]+",
)

VIDEO_URL = "https://www.youtube.com/watch?v={video_id}"


def is_playlist_url(url: str) -> bool:
    return any(re.search(pattern, url.strip()) for pattern in PLAYLIST_PATTERNS)


def _sanitize_filename(name: str, max_len: int = 120) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*]', "", name).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return (cleaned[:max_len] or "download").rstrip(".")


def get_playlist_info(url: str) -> dict[str, Any]:
    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "skip_download": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    if info is None:
        raise ValueError("Could not read playlist. Check the URL and try again.")

    entries = info.get("entries") or []
    videos = []
    for entry in entries:
        if not entry:
            continue
        video_id = entry.get("id")
        if not video_id:
            continue
        videos.append(
            {
                "id": video_id,
                "title": entry.get("title") or "Untitled",
                "duration": entry.get("duration"),
                "thumbnail": entry.get("thumbnail")
                or f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
                "url": entry.get("url") or VIDEO_URL.format(video_id=video_id),
            }
        )

    if not videos:
        raise ValueError("No videos found in this playlist.")

    return {
        "playlist_id": info.get("id"),
        "playlist_title": info.get("title") or "YouTube Playlist",
        "video_count": len(videos),
        "videos": videos,
    }


def download_video(
    video_url: str,
    video_id: str,
    title: str,
    fmt: str,
) -> dict[str, str]:
    """Download a single video as mp3 or mp4. Returns file metadata."""
    if fmt not in ("mp3", "mp4"):
        raise ValueError("Format must be mp3 or mp4.")

    safe_title = _sanitize_filename(title)
    job_id = uuid.uuid4().hex[:12]
    base_name = f"{safe_title}_{job_id}"

    if fmt == "mp3":
        outtmpl = str(DOWNLOADS_DIR / f"{base_name}.%(ext)s")
        opts: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "format": "bestaudio/best",
            "outtmpl": outtmpl,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
            "writethumbnail": False,
        }
        expected_ext = "mp3"
    else:
        outtmpl = str(DOWNLOADS_DIR / f"{base_name}.%(ext)s")
        opts = {
            "quiet": True,
            "no_warnings": True,
            "format": (
                "bestvideo[ext=mp4]+bestaudio[ext=m4a]/"
                "bestvideo+bestaudio/best[ext=mp4]/best"
            ),
            "outtmpl": outtmpl,
            "merge_output_format": "mp4",
        }
        expected_ext = "mp4"

    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([video_url])

    matches = list(DOWNLOADS_DIR.glob(f"{base_name}.{expected_ext}"))
    if not matches:
        # Fallback: find any file with this job prefix
        matches = sorted(
            DOWNLOADS_DIR.glob(f"{base_name}.*"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )

    if not matches:
        raise RuntimeError("Download finished but output file was not found.")

    file_path = matches[0]
    return {
        "job_id": job_id,
        "filename": file_path.name,
        "title": safe_title,
        "format": file_path.suffix.lstrip(".").lower(),
    }
