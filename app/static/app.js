const form = document.getElementById("playlist-form");
const urlInput = document.getElementById("playlist-url");
const loadBtn = document.getElementById("load-btn");
const messageEl = document.getElementById("message");
const sectionVideos = document.getElementById("section-videos");
const playlistTitleEl = document.getElementById("playlist-title");
const playlistMetaEl = document.getElementById("playlist-meta");
const videoListEl = document.getElementById("video-list");
const downloadAllBtn = document.getElementById("download-all-btn");
const formatCards = document.querySelectorAll(".format-card");
const rowTemplate = document.getElementById("video-row-template");

const stepLabels = [
  document.getElementById("step-1-label"),
  document.getElementById("step-2-label"),
  document.getElementById("step-3-label"),
];

let selectedFormat = "mp3";
let currentVideos = [];

function setStep(activeIndex) {
  stepLabels.forEach((el, i) => {
    el.classList.remove("step-active", "step-done");
    if (i < activeIndex) el.classList.add("step-done");
    if (i === activeIndex) el.classList.add("step-active");
  });
}

function showMessage(text, type = "info") {
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function hideMessage() {
  messageEl.hidden = true;
}

function triggerFileDownload(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

formatCards.forEach((card) => {
  card.addEventListener("click", () => {
    selectedFormat = card.dataset.format;
    formatCards.forEach((c) => c.classList.toggle("active", c === card));
    setStep(1);
  });
});

function createVideoRow(video, index) {
  const node = rowTemplate.content.cloneNode(true);
  const row = node.querySelector(".video-row");
  const number = node.querySelector(".video-number");
  const thumb = node.querySelector(".thumb");
  const title = node.querySelector(".video-title");
  const status = node.querySelector(".video-status");
  const saveBtn = node.querySelector(".save-btn");

  number.textContent = index + 1;
  thumb.src = video.thumbnail;
  thumb.alt = video.title;
  title.textContent = video.title;
  row.dataset.videoId = video.id;

  saveBtn.addEventListener("click", () => saveOne(video, saveBtn, status));

  return node;
}

async function saveOne(video, button, statusNode) {
  if (button.classList.contains("done")) return;

  button.disabled = true;
  button.textContent = "Please wait...";
  statusNode.textContent = "Getting your file ready...";
  statusNode.className = "video-status working";

  try {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: video.id,
        video_url: video.url,
        title: video.title,
        format: selectedFormat,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "Something went wrong. Try again.");
    }

    const fileUrl = `/api/files/${encodeURIComponent(data.filename)}`;
    triggerFileDownload(fileUrl, data.filename);

    button.textContent = "Saved!";
    button.classList.add("done");
    statusNode.textContent = "Saved to your computer";
    statusNode.className = "video-status done";
  } catch (error) {
    button.disabled = false;
    button.textContent = "Try again";
    statusNode.textContent = error.message;
    statusNode.className = "video-status error";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  loadBtn.disabled = true;
  loadBtn.textContent = "Looking for videos...";
  sectionVideos.hidden = true;
  videoListEl.innerHTML = "";
  showMessage("Hang on — we're reading your playlist...", "info");
  setStep(0);

  try {
    const response = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.detail ||
          "We couldn't find that playlist. Make sure you copied the full link from YouTube."
      );
    }

    currentVideos = data.videos;
    playlistTitleEl.textContent = data.playlist_title;
    playlistMetaEl.textContent = `${data.video_count} videos ready to save`;

    data.videos.forEach((video, i) => {
      videoListEl.appendChild(createVideoRow(video, i));
    });

    sectionVideos.hidden = false;
    hideMessage();
    setStep(2);

    sectionVideos.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showMessage(error.message, "error");
    setStep(0);
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "Find my videos";
  }
});

downloadAllBtn.addEventListener("click", async () => {
  const rows = [...videoListEl.querySelectorAll(".video-row")];
  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = "Saving all videos...";
  showMessage("Saving each video one at a time. Please don't close this page.", "info");

  let saved = 0;
  for (const row of rows) {
    const videoId = row.dataset.videoId;
    const video = currentVideos.find((item) => item.id === videoId);
    if (!video) continue;

    const saveBtn = row.querySelector(".save-btn");
    const statusNode = row.querySelector(".video-status");

    if (saveBtn.classList.contains("done")) {
      saved++;
      continue;
    }

    await saveOne(video, saveBtn, statusNode);
    if (saveBtn.classList.contains("done")) saved++;
  }

  downloadAllBtn.disabled = false;
  downloadAllBtn.textContent = "Save all videos to my computer";

  if (saved === rows.length) {
    showMessage("All done! Every video has been saved to your computer.", "success");
  } else {
    showMessage(
      `Saved ${saved} of ${rows.length} videos. Click "Try again" on any that failed.`,
      "info"
    );
  }
});

// Start on step 2 (format choice) once user focuses the link box
urlInput.addEventListener("focus", () => setStep(0));
formatCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (urlInput.value.trim()) setStep(1);
  });
});
