// Media Editor — s'injecta a l'HTML per afegir suport de vídeos i imatges
(function () {
  const TOOLBAR_ID = "ud-media-toolbar";

  const style = document.createElement("style");
  style.textContent = `
    .ud-editor-wrap { position: relative; }
    .ud-toolbar {
      display: flex; gap: 6px; flex-wrap: wrap;
      padding: 6px 10px;
      background: #f8f9fc;
      border: 1.5px solid #e4e8f0;
      border-bottom: none;
      border-radius: 8px 8px 0 0;
    }
    .ud-toolbar button {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 5px 11px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: white;
      font-size: 12px;
      font-family: inherit;
      cursor: pointer;
      color: #374151;
      transition: all 0.15s;
    }
    .ud-toolbar button:hover { background: #f0f4ff; border-color: #1a2744; color: #1a2744; }
    .ud-content-area {
      width: 100%;
      min-height: 220px;
      padding: 12px;
      border: 1.5px solid #e4e8f0;
      border-radius: 0 0 8px 8px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.7;
      outline: none;
      background: #fffdf5;
      overflow-y: auto;
    }
    .ud-content-area:focus { border-color: #1a2744; }
    .ud-video-embed {
      margin: 12px 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #e4e8f0;
      background: #000;
    }
    .ud-video-embed iframe {
      width: 100%;
      height: 220px;
      border: none;
      display: block;
    }
    .ud-video-caption {
      background: #1a2744;
      color: white;
      font-size: 12px;
      padding: 5px 10px;
      text-align: center;
    }
    .ud-image-embed {
      margin: 12px 0;
      text-align: center;
    }
    .ud-image-embed img {
      max-width: 100%;
      max-height: 300px;
      border-radius: 8px;
      border: 1px solid #e4e8f0;
    }
    .ud-image-caption {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
      font-style: italic;
    }
    .ud-resource-link {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px;
      background: #eef2ff;
      color: #1a2744;
      border-radius: 6px;
      font-size: 13px;
      text-decoration: none;
      margin: 3px 0;
    }
    .ud-resource-link:hover { background: #dde5ff; }
    .ud-modal-bg {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .ud-modal {
      background: white;
      border-radius: 12px;
      padding: 24px;
      width: 90%; max-width: 440px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    }
    .ud-modal h3 { font-size: 16px; margin-bottom: 16px; color: #1a2744; }
    .ud-modal input {
      width: 100%; padding: 9px 12px;
      border: 1.5px solid #e4e8f0;
      border-radius: 8px; font-size: 14px;
      margin-bottom: 10px; outline: none;
      font-family: inherit;
    }
    .ud-modal input:focus { border-color: #1a2744; }
    .ud-modal-btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 6px; }
    .ud-modal-btns button {
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
      font-family: inherit; cursor: pointer; border: none; font-weight: 600;
    }
    .ud-btn-cancel { background: #f3f4f6; color: #374151; }
    .ud-btn-ok { background: #1a2744; color: white; }
  `;
  document.head.appendChild(style);

  // Converteix marcadors [VIDEO:...] i [IMATGE:...] a HTML
  function parseMediaMarkers(text) {
    if (!text) return text;

    // [VIDEO:Títol|URL]
    text = text.replace(/\[VIDEO:([^\|]+)\|([^\]]+)\]/gi, (_, title, url) => {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        return `<div class="ud-video-embed">
          <iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>
          <div class="ud-video-caption">▶ ${title.trim()}</div>
        </div>`;
      }
      return `<a class="ud-resource-link" href="${url}" target="_blank">▶ ${title.trim()}</a>`;
    });

    // [IMATGE:Descripció|URL]
    text = text.replace(/\[IMATGE:([^\|]+)\|([^\]]+)\]/gi, (_, desc, url) => {
      if (url.includes('commons.wikimedia') || url.includes('wikipedia')) {
        return `<a class="ud-resource-link" href="${url}" target="_blank">🖼 ${desc.trim()} (cerca imatges)</a>`;
      }
      return `<div class="ud-image-embed">
        <img src="${url}" alt="${desc.trim()}" onerror="this.style.display='none'">
        <div class="ud-image-caption">${desc.trim()}</div>
      </div>`;
    });

    // Convertim salts de línia a <br>
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  function extractYouTubeId(url) {
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  function showModal(fields, onOk) {
    const bg = document.createElement("div");
    bg.className = "ud-modal-bg";
    bg.innerHTML = `<div class="ud-modal">
      <h3>${fields.title}</h3>
      ${fields.inputs.map(f => `<input id="ud-inp-${f.id}" placeholder="${f.placeholder}" value="${f.value || ''}">`).join('')}
      <div class="ud-modal-btns">
        <button class="ud-btn-cancel" id="ud-cancel">Cancel·lar</button>
        <button class="ud-btn-ok" id="ud-ok">${fields.okLabel || 'Inserir'}</button>
      </div>
    </div>`;
    document.body.appendChild(bg);
    document.getElementById("ud-cancel").onclick = () => bg.remove();
    document.getElementById("ud-ok").onclick = () => {
      const vals = fields.inputs.reduce((acc, f) => {
        acc[f.id] = document.getElementById("ud-inp-" + f.id).value.trim();
        return acc;
      }, {});
      bg.remove();
      onOk(vals);
    };
    bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
    setTimeout(() => document.getElementById("ud-inp-" + fields.inputs[0].id)?.focus(), 50);
  }

  function insertAtCursor(editor, html) {
    editor.focus();
    const sel = window.getSelection();
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const div = document.createElement("div");
      div.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node, lastNode;
      while ((node = div.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        const r = range.cloneRange();
        r.setStartAfter(lastNode);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    } else {
      editor.innerHTML += html;
    }
  }

  function buildToolbar(editor) {
    const toolbar = document.createElement("div");
    toolbar.className = "ud-toolbar";

    // Botó vídeo YouTube
    const btnVideo = document.createElement("button");
    btnVideo.type = "button";
    btnVideo.innerHTML = "▶ Inserir vídeo YouTube";
    btnVideo.onclick = () => {
      showModal({
        title: "Inserir vídeo de YouTube",
        inputs: [
          { id: "url", placeholder: "URL del vídeo (https://www.youtube.com/watch?v=...)", value: "" },
          { id: "title", placeholder: "Títol del vídeo (opcional)", value: "" },
        ],
        okLabel: "Inserir vídeo"
      }, ({ url, title }) => {
        if (!url) return;
        const videoId = extractYouTubeId(url);
        const caption = title || url;
        if (videoId) {
          insertAtCursor(editor, `<div class="ud-video-embed">
            <iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>
            <div class="ud-video-caption">▶ ${caption}</div>
          </div><br>`);
        } else {
          insertAtCursor(editor, `<a class="ud-resource-link" href="${url}" target="_blank">▶ ${caption}</a><br>`);
        }
      });
    };

    // Botó imatge per URL
    const btnImg = document.createElement("button");
    btnImg.type = "button";
    btnImg.innerHTML = "🖼 Inserir imatge";
    btnImg.onclick = () => {
      showModal({
        title: "Inserir imatge",
        inputs: [
          { id: "url", placeholder: "URL de la imatge (https://...)", value: "" },
          { id: "caption", placeholder: "Peu de foto (opcional)", value: "" },
        ],
        okLabel: "Inserir imatge"
      }, ({ url, caption }) => {
        if (!url) return;
        insertAtCursor(editor, `<div class="ud-image-embed">
          <img src="${url}" alt="${caption}" onerror="this.parentNode.innerHTML='<p style=color:red>No s\\'ha pogut carregar la imatge</p>'">
          ${caption ? `<div class="ud-image-caption">${caption}</div>` : ""}
        </div><br>`);
      });
    };

    // Botó enllaç
    const btnLink = document.createElement("button");
    btnLink.type = "button";
    btnLink.innerHTML = "🔗 Inserir enllaç";
    btnLink.onclick = () => {
      showModal({
        title: "Inserir enllaç",
        inputs: [
          { id: "url", placeholder: "URL (https://...)", value: "" },
          { id: "text", placeholder: "Text de l'enllaç", value: "" },
        ],
        okLabel: "Inserir"
      }, ({ url, text }) => {
        if (!url) return;
        const label = text || url;
        insertAtCursor(editor, `<a href="${url}" target="_blank" style="color:#1a2744;text-decoration:underline">${label}</a> `);
      });
    };

    toolbar.appendChild(btnVideo);
    toolbar.appendChild(btnImg);
    toolbar.appendChild(btnLink);
    return toolbar;
  }

  function upgradeTextarea(textarea) {
    if (textarea.dataset.udUpgraded) return;
    textarea.dataset.udUpgraded = "true";

    const wrap = document.createElement("div");
    wrap.className = "ud-editor-wrap";
    textarea.parentNode.insertBefore(wrap, textarea);

    const editor = document.createElement("div");
    editor.className = "ud-content-area";
    editor.contentEditable = "true";
    editor.innerHTML = parseMediaMarkers(textarea.value);

    // Sincronitza editor → textarea
    editor.addEventListener("input", () => {
      textarea.value = editor.innerText;
    });

    // Quan la IA actualitza el textarea, actualitzem l'editor
    const observer = new MutationObserver(() => {
      if (textarea.value && editor.innerText !== textarea.value) {
        editor.innerHTML = parseMediaMarkers(textarea.value);
      }
    });
    observer.observe(textarea, { attributes: true, childList: true, characterData: true });

    // Observem canvis de valor (React)
    const origDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
    const origSet = origDescriptor.set;
    Object.defineProperty(textarea, "value", {
      set(v) {
        origSet.call(this, v);
        if (v && editor.innerText !== v) {
          editor.innerHTML = parseMediaMarkers(v);
        }
      },
      get() { return origDescriptor.get.call(this); }
    });

    const toolbar = buildToolbar(editor);
    textarea.style.display = "none";
    wrap.appendChild(toolbar);
    wrap.appendChild(editor);
    wrap.appendChild(textarea);
  }

  // Observem el DOM per detectar els textareas de contingut de l'alumne
  const domObserver = new MutationObserver(() => {
    // Busquem textareas dins de zones AI (ai-zone o similar)
    document.querySelectorAll("textarea").forEach(ta => {
      const label = ta.closest(".ai-zone, [class*='ai']")
        || ta.previousElementSibling?.textContent?.toLowerCase().includes("contingut");
      if (label && !ta.dataset.udUpgraded) {
        // Només els textareas de contingut per a l'alumne (rows >= 5)
        if (parseInt(ta.rows) >= 5 || ta.style.minHeight) {
          upgradeTextarea(ta);
        }
      }
    });
  });

  domObserver.observe(document.body, { childList: true, subtree: true });
})();
