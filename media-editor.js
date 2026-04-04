(function () {

  // ── ESPERA QUE EL DOM ESTIGA LLEST ──────────────────────────────
  function waitFor(selector, cb, tries = 0) {
    const el = document.querySelector(selector);
    if (el) return cb(el);
    if (tries > 40) return;
    setTimeout(() => waitFor(selector, cb, tries + 1), 300);
  }

  // ── LLEGEIX LES DADES DE L'APP DES DEL DOM ──────────────────────
  function readAppData() {
    const data = { titol: "", assignatura: "", nivell: "", justificacio: "", sessions: [] };

    // Camps de text del formulari
    document.querySelectorAll("input[type=text]").forEach(inp => {
      const label = inp.closest(".form-row, .fld, div")?.querySelector("label");
      const lbl = (label?.textContent || "").toLowerCase();
      if (lbl.includes("títol") || lbl.includes("titol")) data.titol = inp.value;
    });
    document.querySelectorAll("select").forEach(sel => {
      const label = sel.closest("div")?.querySelector("label");
      const lbl = (label?.textContent || "").toLowerCase();
      if (lbl.includes("assignatura")) data.assignatura = sel.options[sel.selectedIndex]?.text || "";
      if (lbl.includes("nivell")) data.nivell = sel.value;
    });
    document.querySelectorAll("textarea").forEach(ta => {
      const label = ta.closest("div")?.querySelector("label");
      const lbl = (label?.textContent || "").toLowerCase();
      if (lbl.includes("justific")) data.justificacio = ta.value;
    });

    // Sessions: busquem les session-card
    document.querySelectorAll(".session-card").forEach((card, i) => {
      const nom = card.querySelector("input[type=text]")?.value || `Sessió ${i + 1}`;
      let contingut = "", exercicis = "", objectius = "";

      card.querySelectorAll("textarea").forEach(ta => {
        const label = ta.closest("div")?.querySelector("label");
        const lbl = (label?.textContent || "").toLowerCase();
        if (lbl.includes("contingut") || lbl.includes("alumne")) contingut = ta.value;
        else if (lbl.includes("exercici")) exercicis = ta.value;
        else if (lbl.includes("objectiu")) objectius = ta.value;
      });

      // També llegim dels editors contenteditable si hi ha media-editor actiu
      card.querySelectorAll(".ud-editor").forEach(ed => {
        const toolbar = ed.previousElementSibling;
        if (toolbar?.classList.contains("ud-toolbar")) {
          contingut = ed.innerHTML; // preservem HTML (vídeos, imatges)
        }
      });

      if (contingut || exercicis) {
        data.sessions.push({ nom, contingut, exercicis, objectius, idx: i + 1 });
      }
    });

    return data;
  }

  // ── GENERA L'HTML DE PRESENTACIÓ ────────────────────────────────
  function generatePresentationHTML(data) {
    const { titol, assignatura, nivell, justificacio, sessions } = data;
    const nivellText = nivell ? `${nivell}r d'ESO` : "";
    const date = new Date().toLocaleDateString("ca-ES", { year: "numeric", month: "long", day: "numeric" });

    const COLORS = ["#1a2744", "#c1272d", "#2d6a4f", "#6d3a8a", "#b5461e", "#1a5f7a"];

    const sessionsHTML = sessions.map((s, i) => {
      const color = COLORS[i % COLORS.length];
      const lightColor = color + "18";

      // Convertim text pla a paràgrafs si no és HTML
      let contingutHTML = s.contingut;
      if (!s.contingut.includes("<")) {
        contingutHTML = s.contingut.split("\n").filter(p => p.trim())
          .map(p => `<p>${p}</p>`).join("");
      }

      const exercicisHTML = s.exercicis
        ? s.exercicis.split("\n").filter(e => e.trim()).map((e, ei) =>
            `<div class="exer-item">
              <div class="exer-num" style="background:${color}">${ei + 1}</div>
              <div class="exer-text">${e.replace(/^\d+[\.\)]\s*/, "")}</div>
            </div>`
          ).join("")
        : "";

      return `
      <section class="session-section" style="--accent:${color};--accent-light:${lightColor}">
        <div class="session-hero">
          <div class="session-badge">Sessió ${s.idx}</div>
          <h2 class="session-title">${s.nom}</h2>
          ${s.objectius ? `<p class="session-obj"><strong>Objectiu:</strong> ${s.objectius}</p>` : ""}
        </div>
        <div class="session-content">
          <div class="session-body">${contingutHTML}</div>
          ${exercicisHTML ? `
          <div class="exer-section">
            <div class="exer-header">
              <div class="exer-icon">✏️</div>
              <span>Exercicis i activitats</span>
            </div>
            <div class="exer-list">${exercicisHTML}</div>
          </div>` : ""}
        </div>
      </section>`;
    }).join("");

    return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titol || "Unitat Didàctica"}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Source Sans 3', sans-serif;
    background: #f5f4f0;
    color: #1e1e1e;
    font-size: 16px;
    line-height: 1.7;
  }

  /* ── PORTADA ── */
  .cover {
    background: #1a2744;
    color: white;
    min-height: 320px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 48px 56px 40px;
    position: relative;
    overflow: hidden;
  }
  .cover::before {
    content: '';
    position: absolute;
    top: -60px; right: -60px;
    width: 300px; height: 300px;
    border-radius: 50%;
    background: rgba(200,150,12,0.15);
  }
  .cover::after {
    content: '';
    position: absolute;
    bottom: -80px; left: 30%;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: rgba(255,255,255,0.05);
  }
  .cover-meta {
    font-size: 13px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
    margin-bottom: 16px;
  }
  .cover-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(28px, 5vw, 52px);
    font-weight: 900;
    line-height: 1.1;
    margin-bottom: 20px;
    max-width: 700px;
  }
  .cover-line {
    width: 60px;
    height: 4px;
    background: #c8960c;
    margin-bottom: 20px;
  }
  .cover-info {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
  }
  .cover-pill {
    background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 100px;
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 500;
  }
  .cover-date {
    color: rgba(255,255,255,0.4);
    font-size: 12px;
    margin-top: 20px;
  }

  /* ── JUSTIFICACIÓ ── */
  .justificacio {
    background: white;
    border-left: 5px solid #c8960c;
    margin: 32px 40px;
    padding: 20px 24px;
    border-radius: 0 8px 8px 0;
    font-size: 15px;
    color: #444;
    font-style: italic;
  }

  /* ── SESSIONS ── */
  .session-section {
    margin: 0 40px 40px;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  }

  .session-hero {
    background: var(--accent);
    padding: 28px 36px 24px;
    color: white;
    position: relative;
    overflow: hidden;
  }
  .session-hero::after {
    content: '';
    position: absolute;
    top: -30px; right: -30px;
    width: 120px; height: 120px;
    border-radius: 50%;
    background: rgba(255,255,255,0.08);
  }

  .session-badge {
    display: inline-block;
    background: rgba(255,255,255,0.2);
    border: 1px solid rgba(255,255,255,0.3);
    border-radius: 100px;
    padding: 3px 14px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 10px;
  }

  .session-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 700;
    line-height: 1.2;
    margin-bottom: 8px;
  }

  .session-obj {
    font-size: 13px;
    color: rgba(255,255,255,0.8);
    margin-top: 8px;
    font-style: italic;
  }

  .session-content {
    padding: 32px 36px;
  }

  .session-body p {
    margin-bottom: 14px;
    font-size: 15px;
    color: #2c2c2c;
    line-height: 1.8;
  }

  .session-body p:last-child { margin-bottom: 0; }

  /* Imatges i vídeos dins del contingut */
  .session-body iframe {
    width: 100%;
    height: 220px;
    border: none;
    border-radius: 10px;
    margin: 16px 0;
    display: block;
  }
  .session-body img {
    max-width: 100%;
    border-radius: 10px;
    margin: 12px 0;
    display: block;
  }
  .ud-video-wrap {
    margin: 16px 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #e4e8f0;
  }
  .ud-video-wrap iframe { width: 100%; height: 220px; border: none; display: block; }
  .ud-video-caption {
    background: #1a2744;
    color: white;
    font-size: 12px;
    padding: 5px 12px;
    text-align: center;
  }
  .ud-img-wrap { margin: 16px 0; text-align: center; }
  .ud-img-wrap img { max-width: 100%; max-height: 300px; border-radius: 10px; }
  .ud-img-caption { font-size: 12px; color: #888; margin-top: 6px; font-style: italic; }

  /* ── EXERCICIS ── */
  .exer-section {
    margin-top: 28px;
    background: var(--accent-light);
    border-radius: 12px;
    padding: 20px 24px;
    border-left: 4px solid var(--accent);
  }

  .exer-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--accent);
    margin-bottom: 16px;
  }

  .exer-icon { font-size: 16px; }

  .exer-item {
    display: flex;
    gap: 14px;
    margin-bottom: 14px;
    align-items: flex-start;
  }
  .exer-item:last-child { margin-bottom: 0; }

  .exer-num {
    min-width: 28px;
    height: 28px;
    border-radius: 50%;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .exer-text {
    font-size: 15px;
    color: #2c2c2c;
    line-height: 1.6;
    flex: 1;
  }

  /* ── PEU ── */
  .footer {
    text-align: center;
    padding: 24px;
    font-size: 11px;
    color: #aaa;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    border-top: 1px solid #e8e6e0;
    margin: 8px 40px 0;
  }

  @media (max-width: 600px) {
    .cover { padding: 32px 24px 28px; }
    .session-section, .justificacio { margin-left: 16px; margin-right: 16px; }
    .session-hero { padding: 20px 20px 16px; }
    .session-content { padding: 20px; }
  }

  @media print {
    body { background: white; }
    .session-section { box-shadow: none; break-inside: avoid; }
    .cover { min-height: 200px; }
  }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-meta">Decret 107/2022 · LOMLOE · Comunitat Valenciana</div>
  <h1 class="cover-title">${titol || "Unitat Didàctica"}</h1>
  <div class="cover-line"></div>
  <div class="cover-info">
    ${assignatura ? `<span class="cover-pill">${assignatura}</span>` : ""}
    ${nivellText ? `<span class="cover-pill">${nivellText}</span>` : ""}
    <span class="cover-pill">${sessions.length} sessions</span>
  </div>
  <div class="cover-date">${date}</div>
</div>

${justificacio ? `<div class="justificacio">${justificacio}</div>` : ""}

${sessionsHTML}

<div class="footer">Material didàctic generat amb l'App de Programació · Decret 107/2022</div>

</body>
</html>`;
  }

  // ── INTERCEPTA EL BOTÓ D'EXPORTACIÓ HTML ────────────────────────
  function interceptExportButton() {
    document.querySelectorAll("button, a").forEach(el => {
      const txt = el.textContent?.trim() || "";
      if (txt.includes("⬇️ HTML") || txt.includes("HTML")) {
        // Evitem interceptar el botó "App HTML"
        if (txt.includes("App")) return;
        if (el.dataset.udIntercepted) return;
        el.dataset.udIntercepted = "true";

        el.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();

          const data = readAppData();

          if (!data.sessions.length) {
            alert("No hi ha contingut generat. Genera les sessions primer.");
            return;
          }

          const html = generatePresentationHTML(data);
          const blob = new Blob([html], { type: "text/html;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = (data.titol || "unitat").replace(/[^\w\s\-àáèéíïòóúüçÀÁÈÉÍÏÒÓÚÜÇ]/g, "").trim() + "_alumnes.html";
          a.click();
          URL.revokeObjectURL(url);
        }, true);
      }
    });
  }

  // ── BARRA D'EINES PER A INSERIR MEDIA ───────────────────────────
  const css = `
    .ud-toolbar { display:flex;gap:6px;flex-wrap:wrap;padding:6px 10px;background:#f0f4ff;border:1.5px solid #c8d0e8;border-bottom:none;border-radius:8px 8px 0 0; }
    .ud-toolbar button { padding:5px 12px;border:1px solid #c8d0e8;border-radius:6px;background:white;font-size:12px;font-family:inherit;cursor:pointer;color:#1a2744;font-weight:600;transition:background 0.15s; }
    .ud-toolbar button:hover { background:#e0e8ff; }
    .ud-editor { width:100%;min-height:220px;padding:12px;border:1.5px solid #c8d0e8;border-radius:0 0 8px 8px;font-family:inherit;font-size:14px;line-height:1.8;outline:none;background:#fffdf5;overflow-y:auto; }
    .ud-editor:focus { border-color:#1a2744;box-shadow:0 0 0 3px #1a274414; }
    .ud-editor p { margin-bottom:10px; }
    .ud-video-wrap { margin:14px 0;border-radius:8px;overflow:hidden;border:1px solid #c8d0e8; }
    .ud-video-wrap iframe { width:100%;height:200px;border:none;display:block; }
    .ud-video-caption { background:#1a2744;color:white;font-size:12px;padding:5px 10px;text-align:center; }
    .ud-img-wrap { margin:14px 0;text-align:center; }
    .ud-img-wrap img { max-width:100%;max-height:280px;border-radius:8px;border:1px solid #c8d0e8; }
    .ud-img-caption { font-size:12px;color:#6b7280;margin-top:4px;font-style:italic; }
    .ud-modal-bg { position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center; }
    .ud-modal { background:white;border-radius:12px;padding:24px;width:90%;max-width:420px;box-shadow:0 20px 40px rgba(0,0,0,0.25); }
    .ud-modal h3 { font-size:15px;font-weight:700;margin-bottom:14px;color:#1a2744; }
    .ud-modal label { display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px;margin-top:10px; }
    .ud-modal input { width:100%;padding:9px 12px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none; }
    .ud-modal input:focus { border-color:#1a2744; }
    .ud-modal-btns { display:flex;gap:8px;justify-content:flex-end;margin-top:16px; }
    .ud-modal-btns button { padding:8px 18px;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;border:none;font-weight:600; }
    .ud-btn-cancel { background:#f3f4f6;color:#374151; }
    .ud-btn-ok { background:#1a2744;color:white; }
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  function ytId(url) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function modal(title, fields, onOk) {
    const bg = document.createElement("div");
    bg.className = "ud-modal-bg";
    bg.innerHTML = `<div class="ud-modal"><h3>${title}</h3>${fields.map(f => `<label>${f.label}</label><input id="udf-${f.id}" placeholder="${f.ph}">`).join("")}<div class="ud-modal-btns"><button class="ud-btn-cancel">Cancel·lar</button><button class="ud-btn-ok">Inserir</button></div></div>`;
    document.body.appendChild(bg);
    bg.querySelector(".ud-btn-cancel").onclick = () => bg.remove();
    bg.querySelector(".ud-btn-ok").onclick = () => {
      const vals = Object.fromEntries(fields.map(f => [f.id, document.getElementById("udf-" + f.id).value.trim()]));
      bg.remove(); onOk(vals);
    };
    bg.onclick = e => { if (e.target === bg) bg.remove(); };
    setTimeout(() => document.getElementById("udf-" + fields[0].id)?.focus(), 50);
  }

  function insertHTML(editor, html) {
    editor.focus();
    const sel = window.getSelection();
    if (editor.contains(sel.anchorNode) && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const tpl = document.createElement("div");
      tpl.innerHTML = html;
      const frag = document.createDocumentFragment();
      let last;
      while (tpl.firstChild) last = frag.appendChild(tpl.firstChild);
      range.insertNode(frag);
      if (last) { const r = range.cloneRange(); r.setStartAfter(last); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
    } else { editor.innerHTML += html; }
  }

  function makeToolbar(editor) {
    const bar = document.createElement("div");
    bar.className = "ud-toolbar";
    const bVid = document.createElement("button");
    bVid.type = "button"; bVid.textContent = "▶ Vídeo YouTube";
    bVid.onclick = () => modal("Inserir vídeo de YouTube", [
      { id: "url", label: "URL del vídeo", ph: "https://www.youtube.com/watch?v=..." },
      { id: "cap", label: "Títol (opcional)", ph: "Ex: Els instruments de l'orquestra" },
    ], ({ url, cap }) => {
      if (!url) return;
      const id = ytId(url);
      if (!id) { alert("URL de YouTube no vàlida"); return; }
      insertHTML(editor, `<div class="ud-video-wrap" contenteditable="false"><iframe src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>${cap ? `<div class="ud-video-caption">▶ ${cap}</div>` : ""}</div><p><br></p>`);
    });
    const bImg = document.createElement("button");
    bImg.type = "button"; bImg.textContent = "🖼 Imatge";
    bImg.onclick = () => modal("Inserir imatge", [
      { id: "url", label: "URL de la imatge", ph: "https://..." },
      { id: "cap", label: "Peu de foto (opcional)", ph: "Ex: Violí barroc, s. XVIII" },
    ], ({ url, cap }) => {
      if (!url) return;
      insertHTML(editor, `<div class="ud-img-wrap" contenteditable="false"><img src="${url}" alt="${cap}"><${cap ? `div class="ud-img-caption">${cap}</div` : "span></span"}></div><p><br></p>`);
    });
    const bLink = document.createElement("button");
    bLink.type = "button"; bLink.textContent = "🔗 Enllaç";
    bLink.onclick = () => modal("Inserir enllaç", [
      { id: "url", label: "URL", ph: "https://..." },
      { id: "txt", label: "Text de l'enllaç", ph: "Ex: Més informació" },
    ], ({ url, txt }) => {
      if (!url) return;
      insertHTML(editor, `<a href="${url}" target="_blank" style="color:#1a2744;font-weight:600;text-decoration:underline">${txt || url}</a> `);
    });
    bar.appendChild(bVid); bar.appendChild(bImg); bar.appendChild(bLink);
    return bar;
  }

  function convertToEditor(textarea) {
    if (textarea.dataset.udDone) return;
    textarea.dataset.udDone = "true";
    const editor = document.createElement("div");
    editor.className = "ud-editor";
    editor.contentEditable = "true";
    const init = textarea.value;
    editor.innerHTML = init ? init.split("\n").filter(l => l.trim()).map(l => `<p>${l}</p>`).join("") : "<p><br></p>";
    const sync = () => { textarea.value = editor.innerText; textarea.dispatchEvent(new Event("input", { bubbles: true })); textarea.dispatchEvent(new Event("change", { bubbles: true })); };
    editor.addEventListener("input", sync);
    let lastVal = textarea.value;
    setInterval(() => {
      if (textarea.value !== lastVal && textarea.value !== editor.innerText) {
        lastVal = textarea.value;
        editor.innerHTML = textarea.value.split("\n").filter(l => l.trim()).map(l => `<p>${l}</p>`).join("") || "<p><br></p>";
      }
    }, 300);
    const toolbar = makeToolbar(editor);
    textarea.style.display = "none";
    textarea.parentNode.insertBefore(toolbar, textarea);
    textarea.parentNode.insertBefore(editor, textarea);
  }

  // ── OBSERVADOR DEL DOM ───────────────────────────────────────────
  const observer = new MutationObserver(() => {
    // Barra d'eines als textareas grans
    document.querySelectorAll("textarea").forEach(ta => {
      if (ta.dataset.udDone) return;
      const rows = parseInt(ta.getAttribute("rows") || "0");
      if (rows >= 7) convertToEditor(ta);
    });
    // Interceptar botó exportació
    interceptExportButton();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Intent inicial
  setTimeout(interceptExportButton, 1500);
})();
