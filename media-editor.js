(function () {

  // ── ACCÉS A L'ESTAT DE REACT ─────────────────────────────────────
  function getReactState(el) {
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternals'));
    if (!key) return null;
    let fiber = el[key];
    while (fiber) {
      const state = fiber.memoizedState;
      if (state && state.memoizedState && Array.isArray(state.memoizedState.sessions)) {
        return state.memoizedState;
      }
      if (state && Array.isArray(state.queue?.lastRenderedState?.sessions)) {
        return state.queue.lastRenderedState;
      }
      // Recorrem l'arbre de fibres
      if (fiber.memoizedState) {
        let s = fiber.memoizedState;
        while (s) {
          if (s.memoizedState && typeof s.memoizedState === 'object' && Array.isArray(s.memoizedState.sessions)) {
            return s.memoizedState;
          }
          s = s.next;
        }
      }
      fiber = fiber.return;
    }
    return null;
  }

  function getAppState() {
    const root = document.getElementById('root');
    if (!root) return null;
    const key = Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('_reactRootContainer'));
    if (!key) return null;

    // Cerquem en totes les fibres
    function searchFiber(fiber, depth = 0) {
      if (!fiber || depth > 50) return null;
      // Comprova memoizedState
      let s = fiber.memoizedState;
      while (s) {
        const val = s.memoizedState;
        if (val && typeof val === 'object' && !Array.isArray(val) && Array.isArray(val.sessions)) {
          return val;
        }
        s = s.next;
      }
      // Prova fills i germans
      const fromChild = searchFiber(fiber.child, depth + 1);
      if (fromChild) return fromChild;
      const fromSibling = depth < 3 ? searchFiber(fiber.sibling, depth + 1) : null;
      if (fromSibling) return fromSibling;
      return null;
    }

    const rootFiber = root[key]?.current || root[key];
    return searchFiber(rootFiber);
  }

  // ── LLEGEIX DADES DEL DOM COM A FALLBACK ─────────────────────────
  function readFromDOM() {
    const data = { titol: '', assignatura: '', nivell: '', justificacio: '', sessions: [] };

    document.querySelectorAll('input[type=text]').forEach(inp => {
      const lbl = inp.closest('div')?.querySelector('label')?.textContent?.toLowerCase() || '';
      if (lbl.includes('títol') || lbl.includes('titol')) data.titol = inp.value;
    });
    document.querySelectorAll('select').forEach(sel => {
      const lbl = sel.closest('div')?.querySelector('label')?.textContent?.toLowerCase() || '';
      if (lbl.includes('assignatura')) data.assignatura = sel.options[sel.selectedIndex]?.text || '';
      if (lbl.includes('nivell')) data.nivell = sel.value;
    });
    document.querySelectorAll('textarea').forEach(ta => {
      const lbl = ta.closest('div')?.querySelector('label')?.textContent?.toLowerCase() || '';
      if (lbl.includes('justific')) data.justificacio = ta.value;
    });

    document.querySelectorAll('.session-card').forEach((card, i) => {
      const nom = card.querySelector('.session-header input[type=text]')?.value || `Sessió ${i + 1}`;
      let contingut = '', exercicis = '', objectius = '';
      card.querySelectorAll('textarea').forEach(ta => {
        const rows = parseInt(ta.getAttribute('rows') || '0');
        const lbl = ta.closest('div')?.querySelector('label')?.textContent?.toLowerCase() || '';
        if (rows === 8 || lbl.includes('contingut') || lbl.includes('alumne')) contingut = ta.value;
        else if (rows === 6 || lbl.includes('exercici')) exercicis = ta.value;
        else if (lbl.includes('objectiu')) objectius = ta.value;
      });
      // Editor enriquit
      card.querySelectorAll('.ud-editor').forEach(ed => {
        contingut = ed.innerHTML;
      });
      if (contingut || exercicis) {
        data.sessions.push({ nom, contingut, exercicis, objectius, idx: i + 1 });
      }
    });

    return data;
  }

  function collectData() {
    // Primer intentem React state
    const reactState = getAppState();
    if (reactState && reactState.sessions?.length) {
      const sessions = reactState.sessions
        .filter(s => s.contingutAlumne || s.exercicis)
        .map((s, i) => ({
          idx: i + 1,
          nom: s.nom || `Sessió ${i + 1}`,
          contingut: s.contingutAlumne || '',
          exercicis: s.exercicis || '',
          objectius: s.objectiusOperatius || ''
        }));
      return {
        titol: reactState.titol || '',
        assignatura: reactState.assignatura || '',
        nivell: reactState.nivell || '',
        justificacio: reactState.justificacio || '',
        sessions
      };
    }
    // Fallback: DOM
    return readFromDOM();
  }

  // ── GENERA L'HTML DE PRESENTACIÓ ────────────────────────────────
  function generateHTML(data) {
    const { titol, assignatura, nivell, justificacio, sessions } = data;
    const nivellText = nivell ? `${nivell}r d'ESO` : '';
    const date = new Date().toLocaleDateString('ca-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const COLORS = ['#1a2744','#c1272d','#2d6a4f','#6d3a8a','#b5461e','#1a5f7a'];

    const sessionsHTML = sessions.map((s, i) => {
      const color = COLORS[i % COLORS.length];
      const light = color + '18';
      let contingutHTML = s.contingut;
      if (!s.contingut.includes('<')) {
        contingutHTML = s.contingut.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
      }
      const exercicisHTML = s.exercicis
        ? s.exercicis.split('\n').filter(e => e.trim()).map((e, ei) =>
            `<div class="ex-row"><div class="ex-n" style="background:${color}">${ei+1}</div><div class="ex-t">${e.replace(/^\d+[\.\)]\s*/,'')}</div></div>`
          ).join('')
        : '';
      return `
      <section class="sess" style="--c:${color};--cl:${light}">
        <div class="sess-hero">
          <div class="sess-badge">Sessió ${s.idx}</div>
          <h2 class="sess-title">${s.nom}</h2>
          ${s.objectius ? `<p class="sess-obj">${s.objectius}</p>` : ''}
        </div>
        <div class="sess-body">
          <div class="sess-text">${contingutHTML}</div>
          ${exercicisHTML ? `<div class="exer-box"><div class="exer-hdr">✏️ Exercicis i activitats</div>${exercicisHTML}</div>` : ''}
        </div>
      </section>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titol || 'Unitat Didàctica'}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Source Sans 3',sans-serif;background:#f5f4f0;color:#1e1e1e;font-size:16px;line-height:1.7}
.cover{background:#1a2744;color:white;min-height:300px;display:flex;flex-direction:column;justify-content:flex-end;padding:48px 56px 40px;position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:rgba(200,150,12,.15)}
.cover-meta{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:16px}
.cover-title{font-family:'Playfair Display',serif;font-size:clamp(26px,5vw,52px);font-weight:900;line-height:1.1;margin-bottom:18px;max-width:700px}
.cover-line{width:60px;height:4px;background:#c8960c;margin-bottom:18px}
.cover-pills{display:flex;gap:12px;flex-wrap:wrap}
.cover-pill{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:100px;padding:5px 16px;font-size:13px;font-weight:500}
.cover-date{color:rgba(255,255,255,.35);font-size:11px;margin-top:18px}
.just{background:white;border-left:5px solid #c8960c;margin:28px 40px;padding:18px 22px;border-radius:0 8px 8px 0;font-size:15px;color:#555;font-style:italic}
.sess{margin:0 40px 32px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.07)}
.sess-hero{background:var(--c);padding:26px 34px 22px;color:white;position:relative;overflow:hidden}
.sess-hero::after{content:'';position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08)}
.sess-badge{display:inline-block;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);border-radius:100px;padding:3px 14px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px}
.sess-title{font-family:'Playfair Display',serif;font-size:clamp(18px,3vw,26px);font-weight:700;line-height:1.2;margin-bottom:6px}
.sess-obj{font-size:13px;color:rgba(255,255,255,.8);font-style:italic;margin-top:6px}
.sess-body{padding:30px 34px}
.sess-text p{margin-bottom:13px;font-size:15px;color:#2c2c2c;line-height:1.8}
.sess-text p:last-child{margin-bottom:0}
.sess-text iframe{width:100%;height:220px;border:none;border-radius:10px;margin:14px 0;display:block}
.sess-text img{max-width:100%;border-radius:10px;margin:12px 0;display:block}
.ud-video-wrap{margin:14px 0;border-radius:10px;overflow:hidden;border:1px solid #e4e8f0}
.ud-video-wrap iframe{width:100%;height:220px;border:none;display:block}
.ud-video-caption{background:#1a2744;color:white;font-size:12px;padding:5px 12px;text-align:center}
.ud-img-wrap{margin:14px 0;text-align:center}
.ud-img-wrap img{max-width:100%;max-height:300px;border-radius:10px}
.ud-img-caption{font-size:12px;color:#888;margin-top:6px;font-style:italic}
.exer-box{margin-top:26px;background:var(--cl);border-radius:12px;padding:18px 22px;border-left:4px solid var(--c)}
.exer-hdr{font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:var(--c);margin-bottom:14px}
.ex-row{display:flex;gap:14px;margin-bottom:12px;align-items:flex-start}
.ex-row:last-child{margin-bottom:0}
.ex-n{min-width:26px;height:26px;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px}
.ex-t{font-size:15px;color:#2c2c2c;line-height:1.6;flex:1}
.footer{text-align:center;padding:22px;font-size:11px;color:#bbb;letter-spacing:.5px;text-transform:uppercase;border-top:1px solid #e8e6e0;margin:0 40px}
@media(max-width:600px){.cover{padding:28px 20px 24px}.sess,.just,.footer{margin-left:12px;margin-right:12px}.sess-hero{padding:18px 18px 14px}.sess-body{padding:20px 18px}}
@media print{body{background:white}.sess{box-shadow:none;break-inside:avoid}.cover{min-height:200px}}
</style>
</head>
<body>
<div class="cover">
  <div class="cover-meta">Decret 107/2022 · LOMLOE · Comunitat Valenciana</div>
  <h1 class="cover-title">${titol || 'Unitat Didàctica'}</h1>
  <div class="cover-line"></div>
  <div class="cover-pills">
    ${assignatura ? `<span class="cover-pill">${assignatura}</span>` : ''}
    ${nivellText ? `<span class="cover-pill">${nivellText}</span>` : ''}
    <span class="cover-pill">${sessions.length} sessions</span>
  </div>
  <div class="cover-date">${date}</div>
</div>
${justificacio ? `<div class="just">${justificacio}</div>` : ''}
${sessionsHTML}
<div class="footer">Material didàctic · Decret 107/2022 · Comunitat Valenciana</div>
</body></html>`;
  }

  // ── AFEGEIX BOTÓ NOU EN COMPTES D'INTERCEPTAR ───────────────────
  // Més fiable que intentar interceptar el botó de React
  function addExportButton() {
    if (document.getElementById('ud-export-btn')) return;

    const existingBtn = Array.from(document.querySelectorAll('button, a')).find(el => {
      const txt = el.textContent?.trim() || '';
      return txt.includes('⬇️ HTML') && !txt.includes('App');
    });

    if (!existingBtn) return;

    const btn = document.createElement('button');
    btn.id = 'ud-export-btn';
    btn.textContent = '🎨 HTML Presentació';
    btn.style.cssText = `
      padding: 6px 14px;
      border: 1.5px solid #c8960c;
      border-radius: 8px;
      background: #fef9eb;
      color: #7a5c00;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      margin-left: 6px;
      transition: all 0.15s;
    `;
    btn.onmouseover = () => { btn.style.background = '#c8960c'; btn.style.color = 'white'; };
    btn.onmouseout = () => { btn.style.background = '#fef9eb'; btn.style.color = '#7a5c00'; };

    btn.onclick = () => {
      const data = collectData();
      if (!data.sessions.length) {
        alert('No hi ha contingut generat. Genera les sessions primer amb la IA.');
        return;
      }
      const html = generateHTML(data);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (data.titol || 'unitat').replace(/[^\w\s\-]/g, '').trim() + '_alumnes.html';
      a.click();
      URL.revokeObjectURL(url);
    };

    existingBtn.parentNode.insertBefore(btn, existingBtn.nextSibling);
  }

  // ── BARRA D'EINES MEDIA ──────────────────────────────────────────
  const css = `
    .ud-toolbar{display:flex;gap:6px;flex-wrap:wrap;padding:6px 10px;background:#f0f4ff;border:1.5px solid #c8d0e8;border-bottom:none;border-radius:8px 8px 0 0}
    .ud-toolbar button{padding:5px 12px;border:1px solid #c8d0e8;border-radius:6px;background:white;font-size:12px;font-family:inherit;cursor:pointer;color:#1a2744;font-weight:600;transition:background 0.15s}
    .ud-toolbar button:hover{background:#e0e8ff}
    .ud-editor{width:100%;min-height:220px;padding:12px;border:1.5px solid #c8d0e8;border-radius:0 0 8px 8px;font-family:inherit;font-size:14px;line-height:1.8;outline:none;background:#fffdf5;overflow-y:auto}
    .ud-editor:focus{border-color:#1a2744;box-shadow:0 0 0 3px #1a274414}
    .ud-editor p{margin-bottom:10px}
    .ud-video-wrap{margin:14px 0;border-radius:8px;overflow:hidden;border:1px solid #c8d0e8}
    .ud-video-wrap iframe{width:100%;height:200px;border:none;display:block}
    .ud-video-caption{background:#1a2744;color:white;font-size:12px;padding:5px 10px;text-align:center}
    .ud-img-wrap{margin:14px 0;text-align:center}
    .ud-img-wrap img{max-width:100%;max-height:280px;border-radius:8px;border:1px solid #c8d0e8}
    .ud-img-caption{font-size:12px;color:#6b7280;margin-top:4px;font-style:italic}
    .ud-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center}
    .ud-modal{background:white;border-radius:12px;padding:24px;width:90%;max-width:420px;box-shadow:0 20px 40px rgba(0,0,0,0.25)}
    .ud-modal h3{font-size:15px;font-weight:700;margin-bottom:14px;color:#1a2744}
    .ud-modal label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px;margin-top:10px}
    .ud-modal input{width:100%;padding:9px 12px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none}
    .ud-modal input:focus{border-color:#1a2744}
    .ud-modal-btns{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
    .ud-modal-btns button{padding:8px 18px;border-radius:8px;font-size:13px;font-family:inherit;cursor:pointer;border:none;font-weight:600}
    .ud-btn-cancel{background:#f3f4f6;color:#374151}
    .ud-btn-ok{background:#1a2744;color:white}
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  function ytId(url) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function modal(title, fields, onOk) {
    const bg = document.createElement('div');
    bg.className = 'ud-modal-bg';
    bg.innerHTML = `<div class="ud-modal"><h3>${title}</h3>${fields.map(f=>`<label>${f.label}</label><input id="udf-${f.id}" placeholder="${f.ph}">`).join('')}<div class="ud-modal-btns"><button class="ud-btn-cancel">Cancel·lar</button><button class="ud-btn-ok">Inserir</button></div></div>`;
    document.body.appendChild(bg);
    bg.querySelector('.ud-btn-cancel').onclick = () => bg.remove();
    bg.querySelector('.ud-btn-ok').onclick = () => {
      const vals = Object.fromEntries(fields.map(f=>[f.id, document.getElementById('udf-'+f.id).value.trim()]));
      bg.remove(); onOk(vals);
    };
    bg.onclick = e => { if (e.target===bg) bg.remove(); };
    setTimeout(()=>document.getElementById('udf-'+fields[0].id)?.focus(), 50);
  }

  function insertHTML(editor, html) {
    editor.focus();
    const sel = window.getSelection();
    if (editor.contains(sel.anchorNode) && sel.rangeCount) {
      const range = sel.getRangeAt(0); range.deleteContents();
      const tpl = document.createElement('div'); tpl.innerHTML = html;
      const frag = document.createDocumentFragment(); let last;
      while (tpl.firstChild) last = frag.appendChild(tpl.firstChild);
      range.insertNode(frag);
      if (last) { const r=range.cloneRange(); r.setStartAfter(last); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
    } else { editor.innerHTML += html; }
  }

  function makeToolbar(editor) {
    const bar = document.createElement('div'); bar.className = 'ud-toolbar';
    const bVid = document.createElement('button'); bVid.type='button'; bVid.textContent='▶ Vídeo YouTube';
    bVid.onclick = () => modal('Inserir vídeo de YouTube',[
      {id:'url',label:'URL del vídeo',ph:'https://www.youtube.com/watch?v=...'},
      {id:'cap',label:'Títol (opcional)',ph:'Ex: Els instruments de l\'orquestra'},
    ],({url,cap})=>{
      if(!url)return; const id=ytId(url);
      if(!id){alert('URL de YouTube no vàlida');return;}
      insertHTML(editor,`<div class="ud-video-wrap" contenteditable="false"><iframe src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>${cap?`<div class="ud-video-caption">▶ ${cap}</div>`:''}</div><p><br></p>`);
    });
    const bImg = document.createElement('button'); bImg.type='button'; bImg.textContent='🖼 Imatge';
    bImg.onclick = () => modal('Inserir imatge',[
      {id:'url',label:'URL de la imatge',ph:'https://...'},
      {id:'cap',label:'Peu de foto (opcional)',ph:''},
    ],({url,cap})=>{
      if(!url)return;
      insertHTML(editor,`<div class="ud-img-wrap" contenteditable="false"><img src="${url}" alt="${cap}">${cap?`<div class="ud-img-caption">${cap}</div>`:''}</div><p><br></p>`);
    });
    const bLink = document.createElement('button'); bLink.type='button'; bLink.textContent='🔗 Enllaç';
    bLink.onclick = () => modal('Inserir enllaç',[
      {id:'url',label:'URL',ph:'https://...'},
      {id:'txt',label:'Text',ph:'Ex: Més informació'},
    ],({url,txt})=>{
      if(!url)return;
      insertHTML(editor,`<a href="${url}" target="_blank" style="color:#1a2744;font-weight:600;text-decoration:underline">${txt||url}</a> `);
    });
    bar.appendChild(bVid); bar.appendChild(bImg); bar.appendChild(bLink);
    return bar;
  }

  function convertToEditor(textarea) {
    if (textarea.dataset.udDone) return;
    textarea.dataset.udDone = 'true';
    const editor = document.createElement('div');
    editor.className = 'ud-editor'; editor.contentEditable = 'true';
    const init = textarea.value;
    editor.innerHTML = init ? init.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('') : '<p><br></p>';
    editor.addEventListener('input', () => {
      textarea.value = editor.innerText;
      textarea.dispatchEvent(new Event('input',{bubbles:true}));
      textarea.dispatchEvent(new Event('change',{bubbles:true}));
    });
    let lastVal = textarea.value;
    setInterval(() => {
      if (textarea.value !== lastVal && textarea.value !== editor.innerText) {
        lastVal = textarea.value;
        editor.innerHTML = textarea.value.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('') || '<p><br></p>';
      }
    }, 300);
    const toolbar = makeToolbar(editor);
    textarea.style.display = 'none';
    textarea.parentNode.insertBefore(toolbar, textarea);
    textarea.parentNode.insertBefore(editor, textarea);
  }

  // ── OBSERVADOR ───────────────────────────────────────────────────
  new MutationObserver(() => {
    document.querySelectorAll('textarea').forEach(ta => {
      if (ta.dataset.udDone) return;
      if (parseInt(ta.getAttribute('rows')||'0') >= 7) convertToEditor(ta);
    });
    addExportButton();
  }).observe(document.body, { childList: true, subtree: true });

  setTimeout(addExportButton, 2000);

})();
