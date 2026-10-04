/* Shared UI helpers: ERP.ui */
window.ERP = window.ERP || {};
ERP.ui = (function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const debounce = (fn, ms = 300) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function toast(msg, type = "ok") {
    let box = document.getElementById("toasts");
    if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
    const el = document.createElement("div");
    el.className = "toast " + type; el.textContent = msg; el.setAttribute("role", "status");
    box.appendChild(el); setTimeout(() => el.remove(), type === "err" ? 6000 : 3000);
  }

  /* Disable a button and show progress while an async action runs (prevents double saves). */
  async function busy(btn, fn) {
    const label = btn.textContent; btn.disabled = true; btn.textContent = "Please wait...";
    try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; }
  }

  function downloadCSV(name, rows) {
    if (!rows.length) return toast("No data to export", "err");
    const cols = Object.keys(rows[0]);
    const cell = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const csv = "\ufeff" + [cols.map(cell).join(",")].concat(rows.map(r => cols.map(c => cell(r[c])).join(","))).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return { esc, money, today, debounce, toast, busy, downloadCSV };
})();
