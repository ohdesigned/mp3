# Playlist Converter

A simple local web app that reads a YouTube playlist link and lets you download each video separately as **MP3** or **MP4**.

## What it does

1. Paste a YouTube playlist URL (must include `list=...`)
2. Click **Load playlist** to fetch all videos in the list
3. Choose **MP3** (audio) or **MP4** (video)
4. Download videos one by one, or use **Download all**

## Requirements

- Python 3.10+
- [FFmpeg](https://ffmpeg.org/download.html) installed and available on your `PATH` (required for MP3 conversion and MP4 merging)

## Setup

```bash
# Create a virtual environment (recommended)
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## Example playlist URL

```
https://www.youtube.com/playlist?list=PLrAXtmRdnEQy6nuLMH7P1k9Q4Bw8VqJxX
```

## Notes

- Downloads are saved temporarily in the `downloads/` folder and served back to your browser.
- Large playlists take time — each video is processed sequentially when using **Download all**.
- Use only for content you have the right to download. Respect copyright and YouTube's terms of service.
