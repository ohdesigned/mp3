const form = document.getElementById("playlist-form");
const urlInput = document.getElementById("playlist-url");
const loadBtn = document.getElementById("load-btn");
const messageEl = document.getElementById("message");
const sectionVideos = document.getElementById("section-videos");
const playlistTitleEl = document.getElementById("playlist-title");
const playlistMetaEl = document.getElementById("playlist-meta");
const videoListEl = document.getElementById("video-list");
const downloadAllBtn = document.getElementById("download-all-btn");
const formatButtons = document.querySelectorAll(".format-btn");
const pickFolderBtn = document.getElementById("pick-folder-btn");
const folderLabel = document.getElementById("folder-label");
const rowTemplate = document.getElementById("video-row-template");

let selectedFormat = "mp3";
let currentVideos = [];
let saveDirectory = null;
const folderSupported = "showDirectoryPicker" in window;

function showMessage(text, type = "info") {
  messageEl.hidden = false;
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function hideMessage() {
  messageEl.hidden = true;
}

function updateFolderUI() {
  if (saveDirectory) {
    folderLabel.textContent = `📁 ${saveDirectory.name}`;
    folderLabel.classList.add("chosen");
  } else if (folderSupported) {
    folderLabel.textContent = "not chosen yet";
    folderLabel.classList.remove("chosen");
  } else {
    folderLabel.textContent = "browser will ask each time";
    folderLabel.classList.add("chosen");
  }
}

async function pickFolder() {
  if (!folderSupported) {
    showMessage(
      "Your browser will ask where to save each file when you click save.",
      "info"
    );
    return;
  }

  try {
    saveDirectory = await window.showDirectoryPicker({ mode: "readwrite" });
    updateFolderUI();
    hideMessage();
  } catch (err) {
    if (err.name !== "AbortError") {
      showMessage("Could not open that folder. Try again.", "error");
    }
  }
}

async function saveFileToFolder(filename, blob) {
  if (saveDirectory && folderSupported) {
    const handle = await saveDirectory.getFileHandle(filename, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return `saved to ${saveDirectory.name}`;
  }

  if ("showSaveFilePicker" in window) {
    const ext = filename.split(".").pop();
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: ext.toUpperCase(),
          accept: { [`audio/${ext}`]: [`.${ext}`], [`video/${ext}`]: [`.${ext}`] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "saved to your computer";
  }

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return "saved to downloads folder";
}

formatButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedFormat = btn.dataset.format;
    formatButtons.forEach((b) => b.classList.toggle("active", b === btn));
  });
});

pickFolderBtn.addEventListener("click", pickFolder);

function createVideoRow(video, index) {
  const node = rowTemplate.content.cloneNode(true);
  const row = node.querySelector(".video-row");
  const num = node.querySelector(".video-num");
  const thumb = node.querySelector(".thumb");
  const title = node.querySelector(".video-title");
  const status = node.querySelector(".video-status");
  const saveBtn = node.querySelector(".save-btn");

  num.textContent = index + 1;
  thumb.src = video.thumbnail;
  thumb.alt = video.title;
  title.textContent = video.title;
  row.dataset.videoId = video.id;

  saveBtn.addEventListener("click", () => saveOne(video, saveBtn, status));

  return node;
}

async function saveOne(video, button, statusNode) {
  if (button.classList.contains("done")) return;

  if (folderSupported && !saveDirectory) {
    showMessage("Choose a folder first (left sidebar), then click save.", "info");
    return;
  }

  button.disabled = true;
  button.textContent = "wait...";
  statusNode.textContent = "getting file ready...";
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
      throw new Error(data.detail || "something went wrong");
    }

    const fileResponse = await fetch(`/api/files/${encodeURIComponent(data.filename)}`);
    if (!fileResponse.ok) throw new Error("could not fetch file");

    const blob = await fileResponse.blob();
    const where = await saveFileToFolder(data.filename, blob);

    button.textContent = "done ~";
    button.classList.add("done");
    statusNode.textContent = where;
    statusNode.className = "video-status done";
  } catch (error) {
    if (error.name === "AbortError") {
      button.disabled = false;
      button.textContent = "save ~";
      statusNode.textContent = "cancelled";
      statusNode.className = "video-status";
      return;
    }
    button.disabled = false;
    button.textContent = "try again";
    statusNode.textContent = error.message;
    statusNode.className = "video-status error";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  loadBtn.disabled = true;
  loadBtn.textContent = "looking...";
  sectionVideos.hidden = true;
  videoListEl.innerHTML = "";
  showMessage("reading your playlist...", "info");

  try {
    const response = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.detail || "couldn't find that playlist — check your link"
      );
    }

    currentVideos = data.videos;
    playlistTitleEl.textContent = data.playlist_title;
    playlistMetaEl.textContent = `${data.video_count} videos found`;

    data.videos.forEach((video, i) => {
      videoListEl.appendChild(createVideoRow(video, i));
    });

    sectionVideos.hidden = false;
    hideMessage();
    sectionVideos.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = "find videos ~";
  }
});

downloadAllBtn.addEventListener("click", async () => {
  if (folderSupported && !saveDirectory) {
    showMessage("Choose a folder first (left sidebar), then click save all.", "info");
    return;
  }

  const rows = [...videoListEl.querySelectorAll(".video-row")];
  downloadAllBtn.disabled = true;
  downloadAllBtn.textContent = "saving all...";
  showMessage("saving each video — please wait...", "info");

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
  downloadAllBtn.textContent = "save all ~";

  if (saved === rows.length) {
    showMessage(`all done! ${saved} files saved.`, "success");
  } else {
    showMessage(`saved ${saved} of ${rows.length}. try again on any that failed.`, "info");
  }
});

updateFolderUI();
