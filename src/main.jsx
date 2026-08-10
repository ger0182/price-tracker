import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

const STORAGE_KEY = "pchome-price-history";
const SHARED_HISTORY_URL = "https://raw.githubusercontent.com/ger0182/price-tracker/price-data/price-history.json";

async function preloadSharedHistory() {
  try {
    const response = await fetch(`${SHARED_HISTORY_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;

    const remote = await response.json();
    const remoteHistory = Array.isArray(remote) ? remote : (remote.history || []);

    let local = {};
    try {
      local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {}

    const localHistory = Array.isArray(local.history) ? local.history : [];
    const merged = new Map();

    [...remoteHistory, ...localHistory].forEach((entry) => {
      if (entry?.date && Number.isFinite(Number(entry?.price))) {
        merged.set(entry.date, {
          date: entry.date,
          price: Number(entry.price),
          original_price: entry.original_price == null ? null : Number(entry.original_price),
          in_stock: entry.in_stock !== false,
        });
      }
    });

    const history = [...merged.values()]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-180);

    const latest = history.at(-1);
    if (!latest) return;

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      history,
      currentPrice: latest.price,
      lastChecked: latest.date,
    }));
  } catch (error) {
    console.warn("Shared price history preload failed:", error);
  }
}

preloadSharedHistory().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode><App /></React.StrictMode>
  );
});
