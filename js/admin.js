const idInput = document.getElementById("idInput");
const titleInput = document.getElementById("titleInput");
const fileInput = document.getElementById("fileInput");
const preview = document.getElementById("preview");
const downloadLink = document.getElementById("downloadLink");
const jsonOut = document.getElementById("jsonOut");
const copyBtn = document.getElementById("copyBtn");

let currentFile = null;

function pad(n) { return String(n || 0).padStart(2, "0"); }

function refresh() {
  const id = parseInt(idInput.value || "0", 10);
  const title = titleInput.value.trim() || "Без названия";
  const ext = currentFile ? currentFile.name.split(".").pop() : "png";
  const filename = `design-${pad(id)}.${ext}`;

  const entry = {
    id: id || 0,
    title,
    image: `images/${filename}`,
    note: ""
  };

  jsonOut.value = JSON.stringify(entry, null, 2) + ",";

  if (currentFile) {
    downloadLink.href = URL.createObjectURL(currentFile);
    downloadLink.download = filename;
    downloadLink.textContent = `Скачать как ${filename} →`;
    downloadLink.style.display = "inline-block";
  }
}

fileInput.addEventListener("change", () => {
  currentFile = fileInput.files[0] || null;
  if (currentFile) {
    preview.src = URL.createObjectURL(currentFile);
    preview.style.display = "block";
  }
  refresh();
});

idInput.addEventListener("input", refresh);
titleInput.addEventListener("input", refresh);

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(jsonOut.value);
    copyBtn.textContent = "Скопировано ✓";
    setTimeout(() => (copyBtn.textContent = "Скопировать JSON"), 1500);
  } catch (e) {
    jsonOut.select();
  }
});

refresh();
