/* Voice input for forms: put <button class="mic"> right after an <input>, then call ERP.voice.wire(root). */
window.ERP = window.ERP || {};
ERP.voice = (function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let rec = null, btn = null;
  function stop() { if (rec) { rec.onend = null; rec.onresult = null; try { rec.abort(); } catch (e) {} rec = null; } if (btn) { btn.classList.remove("on"); btn = null; } }
  function toggle(input, b) {
    if (!SR) return ERP.ui.toast("Voice input needs Google Chrome", "err");
    if (b.classList.contains("on")) return stop(); stop();
    const r = new SR(); r.lang = input.dataset.lang || "en-US"; r.continuous = true; r.interimResults = true; let fin = "";
    const numeric = input.inputMode === "numeric" || input.type === "number";
    rec = r; btn = b; b.classList.add("on");
    r.onresult = ev => { let it = ""; for (let i = ev.resultIndex; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; ev.results[i].isFinal ? fin += t + " " : it += t; }
      let tx = (fin + it).trim(); if (numeric) tx = tx.replace(/[^\d-]/g, ""); input.value = tx; input.dispatchEvent(new Event("input", { bubbles: true })); };
    r.onend = () => { b.classList.remove("on"); if (btn === b) { rec = null; btn = null; } };
    try { r.start(); } catch (e) {}
  }
  function wire(root = document) { root.querySelectorAll(".mic").forEach(b => { if (b.dataset.w) return; b.dataset.w = 1; b.onclick = () => toggle(b.previousElementSibling, b); }); }
  return { wire, stop };
})();
