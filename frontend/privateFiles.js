// privateFiles.js — invite-only private file browser

let amplifyConfigured = false;
let currentPrefix = "";

// ── Audio player state ────────────────────────────────────────────────────────
let playlist = [];       // array of file keys
let trackIndex = 0;
let audio = null;

async function loadAmplify() {
  const { Amplify } = await import("https://esm.sh/aws-amplify@6");
  const { fetchAuthSession, signIn, signOut, getCurrentUser, confirmSignIn } =
    await import("https://esm.sh/aws-amplify@6/auth");

  if (!amplifyConfigured) {
    const outputs = await fetch("/amplify_outputs.json").then((r) => r.json());
    Amplify.configure(outputs);
    amplifyConfigured = true;
  }

  return { fetchAuthSession, signIn, signOut, getCurrentUser, confirmSignIn };
}

window.initPrivate = async function () {
  const { getCurrentUser } = await loadAmplify();
  try {
    await getCurrentUser();
    showFileBrowser();
  } catch {
    showLoginForm();
  }
};

function showLoginForm() {
  document.getElementById("private-login").style.display = "block";
  document.getElementById("private-browser").style.display = "none";
}

function showFileBrowser() {
  document.getElementById("private-login").style.display = "none";
  document.getElementById("private-browser").style.display = "block";
  loadFiles("");
}

// ── Upload ───────────────────────────────────────────────────────────────────
window.toggleUpload = function () {
  const area = document.getElementById("upload-area");
  area.style.display = area.style.display === "none" ? "block" : "none";
};

window.handleUpload = async function () {
  const input = document.getElementById("upload-input");
  const statusEl = document.getElementById("upload-status");
  const file = input.files[0];
  if (!file) { statusEl.textContent = "Please select a file first."; return; }

  const key = currentPrefix ? `${currentPrefix}${file.name}` : file.name;
  statusEl.textContent = "Uploading…";
  statusEl.style.color = "#555";

  try {
    const apiUrl = await getApiUrl();
    const headers = await authHeaders();
    const res = await fetch(`${apiUrl}files`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ key, contentType: file.type || "application/octet-stream" }),
    });
    if (!res.ok) throw new Error(`Failed to get upload URL: HTTP ${res.status}`);
    const { url } = await res.json();

    const uploadRes = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`);

    statusEl.textContent = `✅ ${file.name} uploaded successfully.`;
    statusEl.style.color = "green";
    input.value = "";

    setTimeout(() => {
      statusEl.textContent = "";
      document.getElementById("upload-area").style.display = "none";
      loadFiles(currentPrefix);
    }, 2000);

  } catch (err) {
    statusEl.textContent = `❌ ${err.message}`;
    statusEl.style.color = "red";
  }
};

window.handleSignIn = async function () {
  const email = document.getElementById("private-email").value.trim();
  const password = document.getElementById("private-password").value;
  const errEl = document.getElementById("private-error");
  errEl.textContent = "";

  try {
    const { signIn, confirmSignIn } = await loadAmplify();
    const result = await signIn({ username: email, password });

    if (result.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      const np = prompt("First login — enter a new password:");
      if (!np) return;
      await confirmSignIn({ challengeResponse: np });
    }

    showFileBrowser();
  } catch (err) {
    errEl.textContent = err.message ?? "Sign in failed.";
  }
};

window.handleSignOut = async function () {
  const { signOut } = await loadAmplify();
  stopPlayer();
  await signOut();
  showLoginForm();
};

async function getApiUrl() {
  const outputs = await fetch("/amplify_outputs.json").then((r) => r.json());
  return outputs.custom?.apiUrl;
}

async function authHeaders() {
  const { fetchAuthSession } = await loadAmplify();
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  return { Authorization: token };
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────
function renderBreadcrumb(prefix) {
  const el = document.getElementById("private-breadcrumb");
  const parts = prefix ? prefix.split("/").filter(Boolean) : [];

  let html = `<a href="#" onclick="navigateTo(''); return false;">Home</a>`;
  let built = "";
  for (const part of parts) {
    built += part + "/";
    const p = built;
    html += ` / <a href="#" onclick="navigateTo('${encodeURIComponent(p)}'); return false;">${part}</a>`;
  }
  el.innerHTML = html;
}

window.navigateTo = function (encodedPrefix) {
  const prefix = decodeURIComponent(encodedPrefix);
  loadFiles(prefix);
};

// ── File listing ─────────────────────────────────────────────────────────────
async function loadFiles(prefix) {
  currentPrefix = prefix;
  renderBreadcrumb(prefix);

  const listEl = document.getElementById("private-file-list");
  listEl.innerHTML = "<li>Loading…</li>";

  try {
    const apiUrl = await getApiUrl();
    const headers = await authHeaders();
    const url = prefix
      ? `${apiUrl}files?prefix=${encodeURIComponent(prefix)}`
      : `${apiUrl}files`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { folders, files } = await res.json();

    if (!folders.length && !files.length) {
      listEl.innerHTML = "<li>No files found.</li>";
      return;
    }

    // Check for MP3s in current folder
    const mp3Files = files.filter((f) => f.key.toLowerCase().endsWith(".mp3"));
    const hasMp3 = mp3Files.length > 0;

    // MP3 play buttons
    const mp3Html = hasMp3 ? `
      <li class="mp3-controls" style="list-style:none; padding:0.4rem 0; border-bottom:1px solid #eee; display:flex; gap:0.5rem;">
        <button onclick="startPlaylist(false)" style="font-size:0.85rem;">▶ Play All</button>
        <button onclick="startPlaylist(true)" style="font-size:0.85rem;">🔀 Shuffle</button>
        <span style="font-size:0.8rem; color:#888; align-self:center;">${mp3Files.length} track${mp3Files.length !== 1 ? "s" : ""}</span>
      </li>` : "";

    // Folders
    const folderHtml = folders.map((f) => {
      const name = f.key.replace(prefix, "").replace("/", "");
      return `<li class="folder-item">
        <a href="#" onclick="navigateTo('${encodeURIComponent(f.key)}'); return false;">
          📁 ${name}
        </a>
      </li>`;
    });

    // Files — MP3s get a ▶ inline play button
    const fileHtml = files.map((f) => {
      const name = f.key.split("/").pop();
      const size = formatBytes(f.size);
      const isMp3 = f.key.toLowerCase().endsWith(".mp3");
      const playBtn = isMp3
        ? `<button onclick="playSingleTrack('${encodeURIComponent(f.key)}')" title="Play" style="font-size:0.75rem; padding:0.1rem 0.4rem;">▶</button>`
        : "";
      return `<li class="file-item">
        ${playBtn}
        <a href="#" onclick="openFile('${encodeURIComponent(f.key)}'); return false;">
          ${isMp3 ? "🎵" : "📄"} ${name}
        </a>
        <span class="file-size">${size}</span>
      </li>`;
    });

    listEl.innerHTML = mp3Html + [...folderHtml, ...fileHtml].join("");

    // Store mp3 keys for playlist use
    window._currentMp3Keys = mp3Files.map((f) => f.key);

  } catch (err) {
    listEl.innerHTML = `<li style="color:red">Error: ${err.message}</li>`;
  }
}

window.openFile = async function (encodedKey) {
  try {
    const apiUrl = await getApiUrl();
    const headers = await authHeaders();
    const res = await fetch(`${apiUrl}files/${encodedKey}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { url } = await res.json();
    window.open(url, "_blank");
  } catch (err) {
    alert("Could not open file: " + err.message);
  }
};

// ── Audio player ─────────────────────────────────────────────────────────────
async function getPresignedUrl(key) {
  const apiUrl = await getApiUrl();
  const headers = await authHeaders();
  const res = await fetch(`${apiUrl}files/${encodeURIComponent(key)}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { url } = await res.json();
  return url;
}

window.startPlaylist = function (shuffle) {
  const keys = [...(window._currentMp3Keys || [])];
  if (!keys.length) return;

  if (shuffle) {
    // Fisher-Yates shuffle
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [keys[i], keys[j]] = [keys[j], keys[i]];
    }
  }

  playlist = keys;
  trackIndex = 0;
  playTrack(trackIndex);
};

window.playSingleTrack = async function (encodedKey) {
  playlist = [decodeURIComponent(encodedKey)];
  trackIndex = 0;
  playTrack(0);
};

async function playTrack(index) {
  if (index < 0 || index >= playlist.length) {
    stopPlayer();
    return;
  }

  const key = playlist[index];
  const name = key.split("/").pop();
  showPlayer(name, index, playlist.length);
  updatePlayerLoading(true);

  try {
    const url = await getPresignedUrl(key);

    if (!audio) {
      audio = new Audio();
      audio.addEventListener("ended", () => playTrack(trackIndex + 1));
      audio.addEventListener("timeupdate", updateProgress);
      audio.addEventListener("canplay", () => updatePlayerLoading(false));
    } else {
      audio.pause();
      audio.src = "";
    }

    audio.src = url;
    trackIndex = index;
    audio.play();
  } catch (err) {
    document.getElementById("player-track").textContent = `Error: ${err.message}`;
    updatePlayerLoading(false);
  }
}

function showPlayer(trackName, index, total) {
  const player = document.getElementById("audio-player");
  player.style.display = "flex";
  document.getElementById("player-track").textContent = trackName;
  document.getElementById("player-count").textContent = `${index + 1} / ${total}`;
  document.getElementById("player-progress").value = 0;
}

function updatePlayerLoading(loading) {
  document.getElementById("player-track").style.opacity = loading ? "0.5" : "1";
}

function updateProgress() {
  if (!audio || !audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  document.getElementById("player-progress").value = pct;
}

function stopPlayer() {
  if (audio) {
    audio.pause();
    audio.src = "";
  }
  playlist = [];
  document.getElementById("audio-player").style.display = "none";
}

window.playerPrev = function () {
  if (trackIndex > 0) playTrack(trackIndex - 1);
};

window.playerNext = function () {
  playTrack(trackIndex + 1);
};

window.playerStop = function () {
  stopPlayer();
};

window.playerSeek = function (el) {
  if (audio && audio.duration) {
    audio.currentTime = (el.value / 100) * audio.duration;
  }
};

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
