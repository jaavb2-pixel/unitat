(function () {
  const css = `
    .ud-toolbar {
      display: flex; gap: 6px; flex-wrap: wrap;
      padding: 6px 10px;
      background: #f0f4ff;
      border: 1.5px solid #c8d0e8;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
      margin-top: 8px;
    }
    .ud-toolbar button {
      padding: 5px 12px;
      border: 1px solid #c8d0e8;
      border-radius: 6px;
      background: white;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      color: #1a2744;
      font-weight: 600;
      transition: background 0.15s;
    }
    .ud-toolbar button:hover { background: #e0e8ff; }
    .ud-editor {
      width: 100%;
      min-height: 220px;
      padding: 12px;
      border: 1.5px solid #c8d0e8;
      border-radius: 0 0 8px 8px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.8;
      outline: none;
      background: #fffdf5;
      overflow-y: auto;
    }
    .ud-editor:focus { border-color: #1a2744; box-shadow: 0 0 0 3px #1a274414; }
    .ud-editor p { margin-bottom: 10px; }
    .ud-video-wrap {
      margin: 14px 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #c8d0e8;
    }
    .ud-video-wrap iframe { width: 100%; height: 200px; border: none; display: block; }
    .ud-video-caption { background: #1a2744; color: white; font-size: 12px; padding: 5px 10px; text-align: center; }
    .ud-img-wrap { margin: 14px 0; text-align: center; }
    .ud-img-wrap img { max-width: 100%; max-height: 280px; border-radius: 8px; border: 1px solid #c8d0e8; }
    .ud-img-caption { font-size: 12px; color: #6b7280; margin-top: 4px; font-style: italic; }
    .ud-modal-bg {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 9999; display: flex; align-items: center; justify-content: center;
    }
    .ud-modal {
      background: white; border-radius: 12px; padding: 24px;
      width: 90%; max-width: 420px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.25);
    }
    .ud-modal h3 { font-size: 15px; font-weight: 700; margin-bottom: 14px; color: #1a2744; }
    .ud-modal label { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; margin-bottom: 4px; margin-top: 10px; }
    .ud-modal input {
      width: 100%; padding: 9px 12px; border: 1.5px solid #e4e8f0;
      border-radius: 8px; font-size: 14px; font-family: inherit; outline: none;
    }
    .ud-modal input:focus { border-color: #1a2744; }
    .ud-modal-btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
    .ud-modal-btns button { padding: 8px 18px; border-radius: 8px; font-size: 13px; font-family: inherit; cursor: pointer; border: none; font-weight: 600; }
    .ud-btn-cancel { background: #f3f4f6; color: #374151; }
    .ud-btn-ok { background: #1a2744; color: white; }
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
    bg.innerHTML = `<div class="ud-modal">
      <h3>${title}</h3>
      ${fields.map(f => `<label>${f.label}</label><input id="udf-${f.id}" placeholder="${f.ph}">`).join("")}
      <div class="ud-modal-btns">
        <button class="ud-btn-cancel">Cancel·lar</button>
        <button class="ud-btn-ok">Inserir</button>
      </div>
    </div>`;
    document.body.appendChild(bg);
    bg.querySelector(".ud-btn-cancel").onclick = () => bg.remove();
    bg.querySelector(".ud-btn-ok").onclick = () => {
      const vals = Object.fromEntries(fields.map(f => [f.id, document.getElementById("udf-" + f.id).value.trim()]));
      bg.remove();
      onOk(vals);
    };
    bg.onclick = e => { if (e.target === bg) bg.remove(); };
    setTimeout(() => document.getElementById("udf-" + fields[0].id)?.focus(), 50);
  }

  function insertHTML(editor, html) {
    editor.focus();
    // Inserim al final si no hi ha selecció dins l'editor
    const sel = window.getSelection();
    const inEditor = editor.contains(sel.anchorNode);
    if (inEditor && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const tpl = document.createElement("div");
      tpl.innerHTML = html;
      const frag = document.createDocumentFragment();
      let last;
      while (tpl.firstChild) last = frag.appendChild(tpl.firstChild);
      range.insertNode(frag);
      if (last) { const r = range.cloneRange(); r.setStartAfter(last); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
    } else {
      editor.innerHTML += html;
    }
  }

  function makeToolbar(editor) {
    const bar = document.createElement("div");
    bar.className = "ud-toolbar";

    // Vídeo YouTube
    const bVid = document.createElement("button");
    bVid.textContent = "▶ Vídeo YouTube";
    bVid.onclick = () => modal("Inserir vídeo de YouTube", [
      { id: "url", label: "URL del vídeo", ph: "https://www.youtube.com/watch?v=..." },
      { id: "cap", label: "Títol (opcional)", ph: "Ex: Els instruments de l'orquestra" },
    ], ({ url, cap }) => {
      if (!url) return;
      const id = ytId(url);
      if (!id) { alert("URL de YouTube no vàlida. Comprova que siga un vídeo de youtube.com"); return; }
      insertHTML(editor, `<div class="ud-video-wrap" contenteditable="false">
        <iframe src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>
        ${cap ? `<div class="ud-video-caption">▶ ${cap}</div>` : ""}
      </div><p><br></p>`);
    });

    // Imatge per URL
    const bImg = document.createElement("button");
    bImg.textContent = "🖼 Imatge";
    bImg.onclick = () => modal("Inserir imatge", [
      { id: "url", label: "URL de la imatge", ph: "https://upload.wikimedia.org/..." },
      { id: "cap", label: "Peu de foto (opcional)", ph: "Ex: Violí barroc, s. XVIII" },
    ], ({ url, cap }) => {
      if (!url) return;
      insertHTML(editor, `<div class="ud-img-wrap" contenteditable="false">
        <img src="${url}" alt="${cap}" onerror="this.src='';this.alt='No s\\'ha pogut carregar la imatge'">
        ${cap ? `<div class="ud-img-caption">${cap}</div>` : ""}
      </div><p><br></p>`);
    });

    // Enllaç clicable
    const bLink = document.createElement("button");
    bLink.textContent = "🔗 Enllaç";
    bLink.onclick = () => modal("Inserir enllaç", [
      { id: "url", label: "URL", ph: "https://..." },
      { id: "txt", label: "Text de l'enllaç", ph: "Ex: Més informació sobre el Barroc" },
    ], ({ url, txt }) => {
      if (!url) return;
      insertHTML(editor, `<a href="${url}" target="_blank" style="color:#1a2744;font-weight:600;text-decoration:underline">${txt || url}</a> `);
    });

    bar.appendChild(bVid);
    bar.appendChild(bImg);
    bar.appendChild(bLink);
    return bar;
  }

  function convertTextToEditor(textarea) {
    if (textarea.dataset.udDone) return;
    textarea.dataset.udDone = "true";

    // Editor contenteditable
    const editor = document.createElement("div");
    editor.className = "ud-editor";
    editor.contentEditable = "true";

    // Copia el text inicial com a paràgrafs
    const initialText = textarea.value;
    if (initialText) {
      editor.innerHTML = initialText.split("\n").filter(l => l.trim())
        .map(l => `<p>${l}</p>`).join("") || "<p><br></p>";
    } else {
      editor.innerHTML = "<p><br></p>";
    }

    // Sincronitza editor → textarea (React llegeix el textarea)
    const sync = () => {
      textarea.value = editor.innerText;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    };
    editor.addEventListener("input", sync);

    // Quan React actualitza el textarea (la IA ha generat), actualitzem l'editor
    let lastVal = textarea.value;
    setInterval(() => {
      if (textarea.value !== lastVal && textarea.value !== editor.innerText) {
        lastVal = textarea.value;
        editor.innerHTML = textarea.value.split("\n").filter(l => l.trim())
          .map(l => `<p>${l}</p>`).join("") || "<p><br></p>";
      }
    }, 300);

    const toolbar = makeToolbar(editor);

    // Substituïm el textarea per toolbar + editor (amaguem el textarea)
    textarea.style.display = "none";
    textarea.parentNode.insertBefore(toolbar, textarea);
    textarea.parentNode.insertBefore(editor, textarea);
  }

  // Observem el DOM per trobar els textareas del contingut generat
  new MutationObserver(() => {
    document.querySelectorAll("textarea").forEach(ta => {
      if (ta.dataset.udDone) return;
      // Activem l'editor als textareas grans (contingut de l'alumne i exercicis)
      const rows = parseInt(ta.getAttribute("rows") || "0");
      const isContentArea = rows >= 7 ||
        (ta.placeholder && (
          ta.placeholder.includes("contingut") ||
          ta.placeholder.includes("alumne") ||
          ta.placeholder.includes("Omple les notes")
        ));
      if (isContentArea) convertTextToEditor(ta);
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
