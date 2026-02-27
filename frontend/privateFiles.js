// privateFiles.js — invite-only private file browser

let amplifyConfigured = false;
let currentPrefix = "";

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
    // Step 1: get a presigned PUT URL from our Lambda
    const apiUrl = await getApiUrl();
    const headers = await authHeaders();
    const res = await fetch(`${apiUrl}files`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ key, contentType: file.type || "application/octet-stream" }),
    });
    if (!res.ok) throw new Error(`Failed to get upload URL: HTTP ${res.status}`);
    const { url } = await res.json();

    // Step 2: PUT the file directly to S3 using the presigned URL
    const uploadRes = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!uploadRes.ok) throw new Error(`Upload failed: HTTP ${uploadRes.status}`);

    statusEl.textContent = `✅ ${file.name} uploaded successfully.`;
    statusEl.style.color = "green";
    input.value = "";

    // Close upload area and refresh file list
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

    // Render folders first, then files
    const folderHtml = folders.map((f) => {
      const name = f.key.replace(prefix, "").replace("/", "");
      return `<li class="folder-item">
        <a href="#" onclick="navigateTo('${encodeURIComponent(f.key)}'); return false;">
          📁 ${name}
        </a>
      </li>`;
    });

    const fileHtml = files.map((f) => {
      const name = f.key.split("/").pop();
      const size = formatBytes(f.size);
      return `<li class="file-item">
        <a href="#" onclick="openFile('${encodeURIComponent(f.key)}'); return false;">
          📄 ${name}
        </a>
        <span class="file-size">${size}</span>
      </li>`;
    });

    listEl.innerHTML = [...folderHtml, ...fileHtml].join("");
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

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
