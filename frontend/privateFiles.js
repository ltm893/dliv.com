// privateFiles.js — invite-only private file browser

let amplifyConfigured = false;

async function loadAmplify() {
  const [
    { Amplify },
    { fetchAuthSession, signIn, signOut, getCurrentUser, confirmSignIn },
  ] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/aws-amplify@6/dist/aws-amplify.js"),
    import("https://cdn.jsdelivr.net/npm/aws-amplify@6/dist/aws-amplify.js"),
  ]);

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
  loadFiles();
}

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

async function loadFiles(prefix = "") {
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
    const files = await res.json();

    if (!files.length) {
      listEl.innerHTML = "<li>No files found.</li>";
      return;
    }

    listEl.innerHTML = files
      .map((f) => {
        const name = f.key.split("/").pop();
        const size = formatBytes(f.size);
        return `<li>
          <a href="#" onclick="openFile('${encodeURIComponent(f.key)}'); return false;">${name}</a>
          <span class="file-size">${size}</span>
        </li>`;
      })
      .join("");
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
