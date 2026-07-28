const FUNPAY_URL = "https://funpay.com/users/12579286/";

let designs = [];
let activeIndex = 0;

const grid = document.getElementById("grid");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxNum = document.getElementById("lightboxNum");
const lightboxTitle = document.getElementById("lightboxTitle");
const pickHint = document.getElementById("pickHint");

function pad(n) { return String(n).padStart(2, "0"); }

function renderGrid() {
  grid.innerHTML = "";

  if (!designs.length) {
    grid.innerHTML = `<div class="empty-state">Каталог пуст. Добавь оформления в data/designs.json</div>`;
    return;
  }

  designs.forEach((d, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.tabIndex = 0;
    card.innerHTML = `
      <img src="${d.image}" alt="${d.title}" loading="lazy">
      <div class="card__veil"></div>
      <div class="card__meta">
        <span class="card__num">№${pad(d.id)}</span>
        <span class="card__title">${d.title}</span>
      </div>
    `;
    card.addEventListener("click", () => openLightbox(i));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openLightbox(i);
    });
    grid.appendChild(card);
  });
}

function openLightbox(index) {
  activeIndex = index;
  updateLightbox();
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  pickHint.textContent = "";
}

function closeLightbox() {
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
}

function updateLightbox() {
  const d = designs[activeIndex];
  lightboxImg.src = d.image;
  lightboxImg.alt = d.title;
  lightboxNum.textContent = `№${pad(d.id)}`;
  lightboxTitle.textContent = d.title;
  pickHint.textContent = "";
}

function step(delta) {
  activeIndex = (activeIndex + delta + designs.length) % designs.length;
  updateLightbox();
}

document.querySelectorAll("[data-close]").forEach(el =>
  el.addEventListener("click", closeLightbox)
);
document.getElementById("prevBtn").addEventListener("click", () => step(-1));
document.getElementById("nextBtn").addEventListener("click", () => step(1));

document.addEventListener("keydown", (e) => {
  if (!lightbox.classList.contains("is-open")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});

document.getElementById("pickBtn").addEventListener("click", async () => {
  const d = designs[activeIndex];
  const message = `Здравствуйте! Выбрал оформление №${pad(d.id)} («${d.title}») с сайта-каталога.`;

  try {
    await navigator.clipboard.writeText(message);
    pickHint.textContent = "Сообщение скопировано — вставьте его в чат на FunPay";
  } catch (e) {
    pickHint.textContent = `Скопируйте вручную: ${message}`;
  }

  window.open(FUNPAY_URL, "_blank", "noopener");
});

fetch("data/designs.json")
  .then(r => r.json())
  .then(data => {
    designs = data;
    renderGrid();
  })
  .catch(() => {
    grid.innerHTML = `<div class="empty-state">Не удалось загрузить каталог. Если файл открыт как локальный файл (file://), запустите локальный сервер — см. README.</div>`;
  });
