"""YouTube playlist to MP3/MP4 converter API."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, HttpUrl

from app.downloader import DOWNLOADS_DIR, download_video, get_playlist_info, is_playlist_url

STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(title="Playlist Converter", version="1.0.0")


class PlaylistRequest(BaseModel):
    url: str = Field(..., min_length=10, description="YouTube playlist URL")


class DownloadRequest(BaseModel):
    video_id: str = Field(..., min_length=6)
    video_url: HttpUrl
    title: str = Field(default="video", max_length=200)
    format: str = Field(default="mp3", pattern="^(mp3|mp4)$")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/playlist")
def fetch_playlist(body: PlaylistRequest):
    url = body.url.strip()
    if not is_playlist_url(url):
        raise HTTPException(
            status_code=400,
            detail="Please paste a valid YouTube playlist link (must include list=...).",
        )
    try:
        return get_playlist_info(url)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/download")
def start_download(body: DownloadRequest):
    try:
        result = download_video(
            video_url=str(body.video_url),
            video_id=body.video_id,
            title=body.title,
            fmt=body.format,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/files/{filename}")
def get_file(filename: str):
    safe_name = Path(filename).name
    file_path = DOWNLOADS_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    media_type = "audio/mpeg" if safe_name.endswith(".mp3") else "video/mp4"
    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=safe_name,
    )


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
