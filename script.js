/* Your Cloudflare Worker (from Project 8). The API key lives there, never here. */
const WORKER_URL = "https://loreal-chatbot.scratch-2026-11-13-9db2c2.workers.dev/";

/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateBtn = document.getElementById("generateRoutine");
const clearAllBtn = document.getElementById("clearAll");
const rtlToggle = document.getElementById("rtlToggle");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

/* The system prompt keeps the AI on topic */
const messages = [
  {
    role: "system",
    content:
      "You are L'Oréal's friendly beauty advisor. Build clear, step-by-step routines (AM/PM, with the order to apply each product) using ONLY the products the user selected, which arrive as JSON. Keep answers short and use plain text with numbered steps. Answer follow-up questions about the routine, skincare, haircare, makeup, fragrance, and related beauty topics. If asked about anything else, politely say you can only help with beauty and routines.",
  },
];

let allProducts = [];
/* Saved selection: an array of product ids, kept in localStorage */
let selectedIds = JSON.parse(localStorage.getItem("selectedIds") || "[]");

/* Load product data from JSON file once */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Show only products that match BOTH the category and the search text */
function showMatchingProducts() {
  const category = categoryFilter.value;
  const text = productSearch.value.trim().toLowerCase();

  if (!category && !text) {
    productsContainer.innerHTML = `<div class="placeholder-message">Pick a category or search to view products</div>`;
    return;
  }

  const matches = allProducts.filter(
    (p) =>
      (!category || p.category === category) &&
      `${p.name} ${p.brand} ${p.description}`.toLowerCase().includes(text)
  );

  if (matches.length === 0) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products found</div>`;
    return;
  }

  /* Each card acts like a toggle button; <details> reveals the description */
  productsContainer.innerHTML = matches
    .map(
      (p) => `
    <div class="product-card ${selectedIds.includes(p.id) ? "selected" : ""}"
         data-id="${p.id}" role="button" tabindex="0"
         aria-pressed="${selectedIds.includes(p.id)}">
      <img src="${p.image}" alt="${p.name}">
      <div class="product-info">
        <h3>${p.name}</h3>
        <p>${p.brand}</p>
        <details>
          <summary>Details</summary>
          <p>${p.description}</p>
        </details>
      </div>
    </div>`
    )
    .join("");
}

/* Redraw the "Selected Products" list and save it */
function showSelected() {
  localStorage.setItem("selectedIds", JSON.stringify(selectedIds));
  const chosen = allProducts.filter((p) => selectedIds.includes(p.id));

  selectedProductsList.innerHTML =
    chosen
      .map(
        (p) => `
    <span class="chip">${p.name}
      <button type="button" data-remove="${p.id}" aria-label="Remove ${p.name}">&times;</button>
    </span>`
      )
      .join("") || `<p class="empty">No products selected yet.</p>`;
}

/* Add or remove one product, then refresh both views */
function toggleProduct(id) {
  selectedIds = selectedIds.includes(id)
    ? selectedIds.filter((x) => x !== id)
    : [...selectedIds, id];
  showSelected();
  showMatchingProducts();
}

/* Add a chat bubble to the chat window */
function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text; // textContent keeps AI output safe (no HTML injection)
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

/* Send the whole conversation to the Worker and show the reply */
async function askAI(search = false) {
  const thinking = addMessage("assistant", search ? "Searching the web…" : "Thinking…");
  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, search }),
    });
    const data = await res.json();
    const message = data.choices[0].message;
    const reply = message.content;
    messages.push({ role: "assistant", content: reply }); // remember history
    // ponytail: strip markdown bold/links; add a markdown lib if richer formatting matters
    thinking.textContent = reply.replace(/\*\*/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

    /* Web search answers come with citations: show them as real links */
    const sources = (message.annotations || []).filter((a) => a.type === "url_citation");
    if (sources.length) {
      const list = document.createElement("div");
      list.className = "sources";
      list.textContent = "Sources: ";
      sources.forEach(({ url_citation }) => {
        const a = document.createElement("a");
        a.href = url_citation.url;
        a.textContent = url_citation.title || url_citation.url;
        a.target = "_blank";
        a.rel = "noopener";
        list.appendChild(a);
      });
      thinking.appendChild(list);
    }
  } catch (err) {
    thinking.textContent = "Sorry, something went wrong. Please try again.";
    console.error(err);
  }
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* ---- Event listeners ---- */

categoryFilter.addEventListener("change", showMatchingProducts);
productSearch.addEventListener("input", showMatchingProducts);

/* Click a card to select it (clicking "Details" only opens the description) */
productsContainer.addEventListener("click", (e) => {
  const card = e.target.closest(".product-card");
  if (card && !e.target.closest("details")) toggleProduct(Number(card.dataset.id));
});

/* Keyboard users can select with Enter or Space */
productsContainer.addEventListener("keydown", (e) => {
  const card = e.target.closest(".product-card");
  if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    toggleProduct(Number(card.dataset.id));
  }
});

/* Remove one item from the selected list */
selectedProductsList.addEventListener("click", (e) => {
  const id = e.target.dataset.remove;
  if (id) toggleProduct(Number(id));
});

clearAllBtn.addEventListener("click", () => {
  selectedIds = [];
  showSelected();
  showMatchingProducts();
});

/* Generate a routine from ONLY the selected products */
generateBtn.addEventListener("click", () => {
  const chosen = allProducts
    .filter((p) => selectedIds.includes(p.id))
    .map(({ name, brand, category, description }) => ({ name, brand, category, description }));

  if (chosen.length === 0) {
    addMessage("assistant", "Select at least one product first.");
    return;
  }

  addMessage("user", `Build me a routine with my ${chosen.length} selected product(s).`);
  messages.push({
    role: "user",
    content: `Create a personalized routine using these products:\n${JSON.stringify(chosen, null, 2)}`,
  });
  askAI();
});

/* Follow-up questions keep the full conversation history */
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;
  addMessage("user", text);
  messages.push({ role: "user", content: text });
  userInput.value = "";
  askAI(document.getElementById("webSearch").checked);
});

/* Flip the whole page between left-to-right and right-to-left */
rtlToggle.addEventListener("click", () => {
  const rtl = document.documentElement.dir !== "rtl";
  document.documentElement.dir = rtl ? "rtl" : "ltr";
  rtlToggle.setAttribute("aria-pressed", rtl);
});

/* Start up: load products, then show any saved selection */
loadProducts().then((products) => {
  allProducts = products;
  showSelected();
  showMatchingProducts();
  addMessage("assistant", "Hi! Pick some products above, then hit Generate Routine.");
});
