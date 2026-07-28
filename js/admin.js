// ---------- storage of connection settings (this browser only) ----------

const STORAGE_KEY = "tearzzq_admin_conn";

function loadConn() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveConn(conn) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conn));
}

const ownerInput = document.getElementById("ownerInput");
const repoInput = document.getElementById("repoInput");
const branchInput = document.getElementById("branchInput");
const tokenInput = document.getElementById("tokenInput");
const connState = document.getElementById("connState");

(function restoreConn() {
  const c = loadConn();
  if (c.owner) ownerInput.value = c.owner;
  if (c.repo) repoInput.value = c.repo;
  if (c.branch) branchInput.value = c.branch;
  if (c.token) tokenInput.value = c.token;
  if (c.owner && c.repo && c.token) {
    connState.textContent = "Подключение сохранено в этом браузере";
    connState.className = "conn-state ok";
  }
})();

document.getElementById("saveConnBtn").addEventListener("click", async () => {
  const conn = {
    owner: ownerInput.value.trim(),
    repo: repoInput.value.trim(),
    branch: branchInput.value.trim() || "main",
    token: tokenInput.value.trim()
  };
  if (!conn.owner || !conn.repo || !conn.token) {
    connState.textContent = "Заполни владельца, репозиторий и токен";
    connState.className = "conn-state bad";
    return;
  }
  saveConn(conn);
  connState.textContent = "Проверяю доступ...";
  connState.className = "conn-state";
  try {
    const res = await fetch(`https://api.github.com/repos/${conn.owner}/${conn.repo}`, {
      headers: { Authorization: `Bearer ${conn.token}`, Accept: "application/vnd.github+json" }
    });
    if (!res.ok) throw new Error(res.status === 401 ? "неверный токен" : `репозиторий не найден (${res.status})`);
    connState.textContent = "Готово — подключение работает и сохранено";
    connState.className = "conn-state ok";
    loadCatalog();
  } catch (e) {
    connState.textContent = `Не получилось: ${e.message}`;
    connState.className = "conn-state bad";
  }
});

// ---------- github helpers ----------

function getConn() {
  return {
    owner: ownerInput.value.trim(),
    repo: repoInput.value.trim(),
    branch: branchInput.value.trim() || "main",
    token: tokenInput.value.trim()
  };
}

async function ghGet(path) {
  const { owner, repo, branch, token } = getConn();
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub (${res.status}): ${(await res.json()).message || "ошибка"}`);
  return res.json();
}

async function ghPut(path, contentBase64, sha, message) {
  const { owner, repo, branch, token } = getConn();
  const body = { message, content: contentBase64, branch };
  if (sha) body.sha = sha;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );
  if (!res.ok) throw new Error(`GitHub (${res.status}): ${(await res.json()).message || "ошибка"}`);
  return res.json();
}

async function ghDelete(path, sha, message) {
  const { owner, repo, branch, token } = getConn();
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, sha, branch })
    }
  );
  if (!res.ok) throw new Error(`GitHub (${res.status}): ${(await res.json()).message || "ошибка"}`);
  return res.json();
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

let cachedDesigns = null;
let cachedDesignsSha = null;
let editingId = null;

async function loadCatalog() {
  const list = document.getElementById("catalogList");
  list.innerHTML = `<p class="hint">Загружаю...</p>`;
  try {
    const file = await ghGet("data/designs.json");
    if (!file) { list.innerHTML = `<p class="hint">data/designs.json не найден.</p>`; return; }
    cachedDesignsSha = file.sha;
    cachedDesigns = JSON.parse(base64ToUtf8(file.content));
    cachedDesigns.sort((a, b) => a.id - b.id);

    if (editingId === null) {
      const maxId = cachedDesigns.reduce((m, d) => Math.max(m, d.id || 0), 0);
      idInput.value = maxId + 1;
    }

    renderCatalogList();
  } catch (e) {
    list.innerHTML = `<p class="hint" style="color:#ff6b6b;">Не удалось загрузить: ${e.message}</p>`;
  }
}

function renderCatalogList() {
  const list = document.getElementById("catalogList");
  const { owner, repo, branch } = getConn();
  if (!cachedDesigns || !cachedDesigns.length) {
    list.innerHTML = `<p class="hint">Каталог пуст.</p>`;
    return;
  }
  list.innerHTML = "";
  cachedDesigns.forEach(d => {
    const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${d.image}`;
    const row = document.createElement("div");
    row.className = "catalog-item";
    row.innerHTML = `
      <img src="${raw}" alt="">
      <div class="catalog-item__meta">
        <div class="catalog-item__num">№${pad(d.id)}</div>
        <div class="catalog-item__title">${d.title}</div>
      </div>
      <div class="catalog-item__actions">
        <button class="secondary" data-edit="${d.id}">Изменить</button>
        <button class="btn-danger" data-delete="${d.id}">Удалить</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll("[data-edit]").forEach(btn =>
    btn.addEventListener("click", () => startEdit(parseInt(btn.dataset.edit, 10)))
  );
  list.querySelectorAll("[data-delete]").forEach(btn =>
    btn.addEventListener("click", () => deleteDesign(parseInt(btn.dataset.delete, 10)))
  );
}

function startEdit(id) {
  const entry = cachedDesigns.find(d => d.id === id);
  if (!entry) return;
  editingId = id;
  idInput.value = entry.id;
  titleInput.value = entry.title;
  fileInput.value = "";
  currentFile = null;
  preview.style.display = "none";
  publishBtn.textContent = `Сохранить изменения №${pad(id)} →`;
  document.getElementById("cancelEditBtn").style.display = "block";
  statusEl.innerHTML = "";
  document.getElementById("titleInput").scrollIntoView({ behavior: "smooth", block: "center" });
}

function stopEdit() {
  editingId = null;
  titleInput.value = "";
  fileInput.value = "";
  currentFile = null;
  preview.style.display = "none";
  publishBtn.textContent = "Опубликовать на сайт →";
  document.getElementById("cancelEditBtn").style.display = "none";
  const maxId = (cachedDesigns || []).reduce((m, d) => Math.max(m, d.id || 0), 0);
  idInput.value = maxId + 1;
}

document.getElementById("cancelEditBtn").addEventListener("click", stopEdit);
document.getElementById("refreshListBtn").addEventListener("click", loadCatalog);

async function deleteDesign(id) {
  const entry = cachedDesigns.find(d => d.id === id);
  if (!entry) return;
  if (!confirm(`Удалить оформление №${pad(id)} («${entry.title}»)? Это удалит и картинку из репозитория.`)) return;

  statusEl.innerHTML = "";
  try {
    log(`Удаляю ${entry.image}...`);
    const imgFile = await ghGet(entry.image);
    if (imgFile) await ghDelete(entry.image, imgFile.sha, `Удалено изображение: оформление №${pad(id)}`);
    log(`${entry.image} удалено ✓`, "ok");

    log("Обновляю data/designs.json...");
    const designsFile = await ghGet("data/designs.json");
    const designs = JSON.parse(base64ToUtf8(designsFile.content)).filter(d => d.id !== id);
    const newContent = JSON.stringify(designs, null, 2) + "\n";
    await ghPut("data/designs.json", utf8ToBase64(newContent), designsFile.sha, `Каталог: удалено оформление №${pad(id)}`);
    log("Готово ✓", "ok");

    if (editingId === id) stopEdit();
    loadCatalog();
  } catch (e) {
    log(`Ошибка: ${e.message}`, "err");
  }
}

// ---------- publish flow ----------

const idInput = document.getElementById("idInput");
const titleInput = document.getElementById("titleInput");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const publishBtn = document.getElementById("publishBtn");
const statusEl = document.getElementById("status");
const downloadLink = document.getElementById("downloadLink");
const jsonOut = document.getElementById("jsonOut");

let currentFile = null;

function pad(n) { return String(n || 0).padStart(2, "0"); }

function log(line, cls) {
  const span = document.createElement("div");
  if (cls) span.className = cls;
  span.textContent = line;
  statusEl.appendChild(span);
}

fileInput.addEventListener("change", () => {
  currentFile = fileInput.files[0] || null;
  if (currentFile) {
    preview.src = URL.createObjectURL(currentFile);
    preview.style.display = "block";
    refreshManualFallback();
  }
});

function refreshManualFallback() {
  const id = parseInt(idInput.value || "0", 10);
  const title = titleInput.value.trim() || "Без названия";
  const ext = currentFile ? currentFile.name.split(".").pop() : "png";
  const filename = `design-${pad(id)}.${ext}`;

  jsonOut.value = JSON.stringify(
    { id: id || 0, title, image: `images/${filename}`, note: "" },
    null,
    2
  ) + ",";

  if (currentFile) {
    downloadLink.href = URL.createObjectURL(currentFile);
    downloadLink.download = filename;
    downloadLink.textContent = `Скачать как ${filename} →`;
    downloadLink.style.display = "inline-block";
  }
}

idInput.addEventListener("input", refreshManualFallback);
titleInput.addEventListener("input", refreshManualFallback);

publishBtn.addEventListener("click", async () => {
  statusEl.innerHTML = "";
  const { owner, repo, token } = getConn();
  const id = parseInt(idInput.value || "0", 10);
  const title = titleInput.value.trim();
  const isEditingExisting = editingId === id && cachedDesigns && cachedDesigns.some(d => d.id === id);

  if (!owner || !repo || !token) {
    log("Сначала сохрани подключение к GitHub выше.", "err");
    return;
  }
  if (!id || !title) {
    log("Заполни номер и название.", "err");
    return;
  }
  if (!currentFile && !isEditingExisting) {
    log("Выбери файл — для нового оформления картинка обязательна.", "err");
    return;
  }

  publishBtn.disabled = true;
  refreshManualFallback();

  try {
    let imagePath;

    if (currentFile) {
      const ext = currentFile.name.split(".").pop().toLowerCase();
      const filename = `design-${pad(id)}.${ext}`;
      imagePath = `images/${filename}`;
      log(`Заливаю ${imagePath}...`);
      const imgBase64 = await fileToBase64(currentFile);
      const existingImg = await ghGet(imagePath);
      await ghPut(
        imagePath,
        imgBase64,
        existingImg ? existingImg.sha : null,
        `${isEditingExisting ? "Обновлено" : "Добавлено"} изображение: оформление №${pad(id)}`
      );
      log(`${imagePath} загружено ✓`, "ok");
    } else {
      imagePath = cachedDesigns.find(d => d.id === id).image;
      log("Картинка не менялась, обновляю только название...");
    }

    log("Обновляю data/designs.json...");
    const designsFile = await ghGet("data/designs.json");
    if (!designsFile) throw new Error("data/designs.json не найден в репозитории");
    const designs = JSON.parse(base64ToUtf8(designsFile.content));

    const entry = { id, title, image: imagePath, note: "" };
    const idx = designs.findIndex(d => d.id === id);
    if (idx >= 0) designs[idx] = entry; else designs.push(entry);
    designs.sort((a, b) => a.id - b.id);

    const newContent = JSON.stringify(designs, null, 2) + "\n";
    await ghPut(
      "data/designs.json",
      utf8ToBase64(newContent),
      designsFile.sha,
      `Каталог: оформление №${pad(id)} — ${title}`
    );
    log("data/designs.json обновлён ✓", "ok");
    log("Готово! Обнови сайт через 10–30 секунд.", "ok");

    editingId = null;
    stopEdit();
    loadCatalog();
  } catch (e) {
    log(`Ошибка: ${e.message}`, "err");
  } finally {
    publishBtn.disabled = false;
  }
});

if (ownerInput.value && repoInput.value && tokenInput.value) loadCatalog();
