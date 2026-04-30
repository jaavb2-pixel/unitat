// ===================================================================
// enhancements.js - Funcionalitats addicionals per a Unitats Didàctiques
// 
// Afegeix:
//  1. Botó "🎵 Àudio" al toolbar dels editors (Spotify / SoundCloud / MP3)
//  2. Botons "📉 Simplificar" i "📈 Ampliar" a cada sessió (DUA)
//
// Funciona com a complement, sense modificar l'app principal.
// ===================================================================

(function () {
  'use strict';

  // ── UTILITATS ─────────────────────────────────────────────────────

  function toast(msg, isError) {
    const t = document.createElement('div');
    t.style.cssText =
      'position:fixed;bottom:24px;right:24px;z-index:10000;' +
      'background:' + (isError ? '#c1272d' : '#1a2744') + ';color:white;' +
      'padding:12px 20px;border-radius:10px;font-size:14px;font-weight:500;' +
      'box-shadow:0 8px 24px rgba(26,39,68,0.3);font-family:inherit;' +
      'max-width:380px;line-height:1.4';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }

  async function callAI(prompt, maxTokens) {
    const r = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, maxTokens: maxTokens || 2000 })
    });
    if (!r.ok) {
      let errMsg = 'Error ' + r.status;
      try {
        const e = await r.json();
        if (e && e.error) errMsg = e.error;
      } catch (_) {}
      throw new Error(errMsg);
    }
    const d = await r.json();
    return (d && d.text) || '';
  }

  // ── PARSEJADORS D'URL ─────────────────────────────────────────────

  function parseSpotifyURL(url) {
    const m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
    if (!m) return null;
    return {
      type: m[1],
      id: m[2],
      embedURL: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2]
    };
  }

  function parseSoundCloudURL(url) {
    if (!/soundcloud\.com\/[^\/]+\/[^\/?]+/.test(url)) return null;
    return {
      embedURL: 'https://w.soundcloud.com/player/?url=' +
        encodeURIComponent(url) +
        '&color=%231a2744&auto_play=false&hide_related=false&show_comments=false&show_user=true'
    };
  }

  function isDirectAudioURL(url) {
    return /^https?:\/\/.+\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(url);
  }

  // ── 1. INSERCIÓ D'ÀUDIO ───────────────────────────────────────────

  function makeAudioWrap(url, caption) {
    const sp = parseSpotifyURL(url);
    const sc = parseSoundCloudURL(url);
    const isFile = isDirectAudioURL(url);

    if (!sp && !sc && !isFile) return null;

    const wrap = document.createElement('div');
    wrap.className = 'ud-audio-wrap';
    wrap.setAttribute('contenteditable', 'false');
    wrap.setAttribute('data-ud-audio', '1');
    wrap.style.cssText =
      'margin:14px 0;padding:12px;background:#f8f6ed;' +
      'border:1px solid #e4e8f0;border-radius:10px;position:relative';

    let inner = '';
    if (sp) {
      const height = sp.type === 'track' || sp.type === 'episode' ? 152 : 352;
      wrap.setAttribute('data-ud-audio-type', 'spotify');
      wrap.setAttribute('data-ud-audio-url', sp.embedURL);
      inner = '<iframe src="' + sp.embedURL + '" width="100%" height="' + height +
        '" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" ' +
        'loading="lazy" style="border-radius:8px;display:block"></iframe>';
    } else if (sc) {
      wrap.setAttribute('data-ud-audio-type', 'soundcloud');
      wrap.setAttribute('data-ud-audio-url', sc.embedURL);
      inner = '<iframe src="' + sc.embedURL + '" width="100%" height="166" ' +
        'frameborder="0" scrolling="no" allow="autoplay" ' +
        'style="border-radius:8px;display:block"></iframe>';
    } else if (isFile) {
      wrap.setAttribute('data-ud-audio-type', 'file');
      wrap.setAttribute('data-ud-audio-url', url);
      inner = '<audio controls src="' + url + '" style="width:100%;display:block"></audio>';
    }

    if (caption) {
      inner += '<div style="margin-top:8px;font-size:13px;color:#3a4a6f;' +
        'font-style:italic;text-align:center">🎵 ' + caption.replace(/</g, '&lt;') + '</div>';
    }

    inner += '<button type="button" class="ud-audio-del" title="Esborrar àudio" ' +
      'style="position:absolute;top:6px;right:6px;background:rgba(193,39,45,0.9);' +
      'color:white;border:none;border-radius:6px;padding:4px 8px;font-size:11px;' +
      'cursor:pointer;font-family:inherit;font-weight:600">🗑</button>';

    wrap.innerHTML = inner;
    return wrap;
  }

  function insertElementInEditor(editor, element) {
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(element);
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      element.after(p);
      range.setStartAfter(p);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(element);
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      editor.appendChild(p);
    }
    setTimeout(function () {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }, 50);
  }

  function openAudioModal(editor) {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(26,39,68,0.5);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;font-family:inherit';

    const box = document.createElement('div');
    box.style.cssText =
      'background:white;border-radius:12px;padding:24px;width:480px;' +
      'max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3)';

    box.innerHTML =
      '<h3 style="margin:0 0 16px;color:#1a2744;font-size:18px;font-weight:700">🎵 Inserir àudio</h3>' +
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#1a2744;font-size:13px">' +
      'URL de Spotify, SoundCloud o MP3 directa</label>' +
      '<input id="ud-audio-url" type="text" ' +
      'placeholder="https://open.spotify.com/track/... o https://soundcloud.com/... o https://...mp3" ' +
      'style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;' +
      'font-size:14px;font-family:inherit;margin-bottom:14px;box-sizing:border-box">' +
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#1a2744;font-size:13px">' +
      'Títol (opcional)</label>' +
      '<input id="ud-audio-cap" type="text" placeholder="Ex: Simfonia núm. 5 de Beethoven" ' +
      'style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;' +
      'font-size:14px;font-family:inherit;margin-bottom:18px;box-sizing:border-box">' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<button id="ud-audio-cancel" type="button" ' +
      'style="padding:9px 16px;border:1px solid #c8d0e8;border-radius:8px;' +
      'background:white;color:#1a2744;font-weight:600;font-family:inherit;cursor:pointer">Cancel·lar</button>' +
      '<button id="ud-audio-ok" type="button" ' +
      'style="padding:9px 16px;border:none;border-radius:8px;' +
      'background:#1a2744;color:white;font-weight:600;font-family:inherit;cursor:pointer">Inserir</button>' +
      '</div>' +
      '<div style="margin-top:14px;padding:10px;background:#f0f4ff;border-radius:8px;' +
      'font-size:12px;color:#3a4a6f;line-height:1.5">' +
      '💡 <strong>Suport:</strong> Spotify (cançons, àlbums, llistes), SoundCloud (qualsevol pista), ' +
      'MP3 directe (URL pública).</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const urlInput = box.querySelector('#ud-audio-url');
    setTimeout(function () { urlInput.focus(); }, 50);

    function close() { overlay.remove(); }

    box.querySelector('#ud-audio-cancel').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
    urlInput.onkeydown = function (e) {
      if (e.key === 'Enter') box.querySelector('#ud-audio-ok').click();
      if (e.key === 'Escape') close();
    };

    box.querySelector('#ud-audio-ok').onclick = function () {
      const url = urlInput.value.trim();
      const caption = box.querySelector('#ud-audio-cap').value.trim();
      if (!url) {
        toast('Has d\'introduir una URL', true);
        return;
      }
      const wrap = makeAudioWrap(url, caption);
      if (!wrap) {
        toast('URL no reconeguda. Usa Spotify, SoundCloud o un MP3 directe.', true);
        return;
      }
      insertElementInEditor(editor, wrap);
      close();
      toast('✓ Àudio inserit');
    };
  }

  function makeAudioButton(toolbar) {
    if (toolbar._audioBtnAdded) return;
    const editor = toolbar.nextElementSibling;
    if (!editor || !editor.classList.contains('ud-editor')) return;
    toolbar._audioBtnAdded = true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🎵 Àudio';
    btn.title = 'Inserir àudio (Spotify, SoundCloud o MP3)';
    btn.onclick = function () { openAudioModal(editor); };

    toolbar.appendChild(btn);
  }

  // ── 2. SIMPLIFICAR / AMPLIAR TEXT (DUA) ──────────────────────────

  function getSessionContext(card) {
    const titol = (document.querySelector('input[type=text]') || {}).value || 'la unitat';
    const sessionInputs = card.querySelectorAll('.session-header input[type=text]');
    const sessionName = (sessionInputs[0] || {}).value || '';
    return { titol: titol, sessionName: sessionName };
  }

  async function adaptText(card, editor, mode) {
    const btn = card.querySelector(
      mode === 'simple' ? '.ud-adapt-simple' : '.ud-adapt-amplify'
    );
    if (!btn) return;

    // Llegim el text pla, descartant elements multimèdia i adaptacions prèvies
    const tmp = editor.cloneNode(true);
    tmp.querySelectorAll(
      '[data-ud-img], [data-ud-vid], [data-ud-audio], ' +
      '.ud-img-controls, .ud-vid-controls, [data-ud-adapted]'
    ).forEach(function (el) { el.remove(); });
    const text = tmp.innerText.trim();

    if (!text || text.length < 50) {
      toast('Cal escriure primer el contingut per poder adaptar-lo.', true);
      return;
    }

    const ctx = getSessionContext(card);
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.textContent = '⏳ Generant...';

    try {
      let prompt;
      if (mode === 'simple') {
        prompt =
          "Ets un docent expert en Disseny Universal per a l'Aprenentatge (DUA) i atenció a l'alumnat amb necessitats educatives especials (NEE).\n\n" +
          'Context: Unitat didàctica "' + ctx.titol + '"' +
          (ctx.sessionName ? ', sessió "' + ctx.sessionName + '"' : '') + '.\n\n' +
          'Text original per a l\'alumnat:\n---\n' + text + '\n---\n\n' +
          "Reescriu aquest text **simplificant-lo per a alumnat amb dificultats de lectura/comprensió o NEE**, en VALENCIÀ. Fes-ho així:\n" +
          '- Frases curtes (màxim 15-18 paraules per frase)\n' +
          "- Vocabulari quotidià, evita tecnicismes (o explica'ls breument entre parèntesis)\n" +
          '- Estructura visual clara amb paràgrafs curts (3-4 línies màxim)\n' +
          '- Usa <b> per remarcar conceptes clau (1-2 per paràgraf)\n' +
          '- Conserva les idees essencials, no afegisques contingut nou\n' +
          '- Comença amb una frase resum del que aprendrem\n\n' +
          'Format de resposta: NOMÉS HTML directe (paràgrafs <p> amb <b> on calga). NO escrigues introduccions ni explicacions, NO uses Markdown, NO uses tres cometes invertides.';
      } else {
        prompt =
          "Ets un docent expert en atenció a l'alumnat avançat i ampliació curricular.\n\n" +
          'Context: Unitat didàctica "' + ctx.titol + '"' +
          (ctx.sessionName ? ', sessió "' + ctx.sessionName + '"' : '') + '.\n\n' +
          'Text original per a l\'alumnat:\n---\n' + text + '\n---\n\n' +
          "Reescriu aquest text **ampliant-lo per a alumnat avançat o amb interés acadèmic**, en VALENCIÀ. Fes-ho així:\n" +
          '- Aprofundeix en conceptes (afegeix matissos, exemples cultes, referents)\n' +
          '- Introdueix vocabulari específic de la matèria amb precisió\n' +
          '- Pots afegir 1-2 connexions interdisciplinàries breus si són rellevants\n' +
          "- Manté un to acadèmic però accessible per a ESO\n" +
          '- Usa <b> per a conceptes clau\n' +
          '- Format en paràgrafs <p> ben estructurats\n\n' +
          'Format de resposta: NOMÉS HTML directe (paràgrafs <p> amb <b> on calga). NO escrigues introduccions ni explicacions, NO uses Markdown, NO uses tres cometes invertides.';
      }

      let result = await callAI(prompt, 2000);
      // Netejar possibles wrappers de Markdown
      result = result.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

      insertAdaptedBlock(editor, result, mode);
      toast('✓ Versió ' + (mode === 'simple' ? 'simplificada' : 'ampliada') + ' afegida');
    } catch (e) {
      toast('Error: ' + e.message, true);
    } finally {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = originalText;
    }
  }

  function insertAdaptedBlock(editor, html, mode) {
    // Eliminar adaptació prèvia del mateix tipus
    editor.querySelectorAll('[data-ud-adapted="' + mode + '"]').forEach(function (el) {
      el.remove();
    });

    const isSimple = mode === 'simple';
    const bgColor = isSimple ? '#e0f2fe' : '#fef3c7';
    const borderColor = isSimple ? '#7dd3fc' : '#fde68a';
    const titleIcon = isSimple ? '📉' : '📈';
    const titleText = isSimple
      ? 'Versió simplificada (NEE / dificultats de lectura)'
      : 'Versió ampliada (alumnat avançat)';

    const wrap = document.createElement('div');
    wrap.className = 'ud-adapted-block';
    wrap.setAttribute('data-ud-adapted', mode);
    wrap.setAttribute('contenteditable', 'false');
    wrap.style.cssText =
      'margin:18px 0 8px;padding:16px;background:' + bgColor + ';' +
      'border:1.5px dashed ' + borderColor + ';border-radius:10px';

    wrap.innerHTML =
      '<div style="display:flex;justify-content:space-between;' +
      'align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid ' +
      borderColor + '">' +
      '<strong style="color:#1a2744;font-size:13px">' + titleIcon + ' ' + titleText + '</strong>' +
      '<button type="button" class="ud-adapted-del" title="Esborrar aquesta adaptació" ' +
      'style="background:rgba(193,39,45,0.9);color:white;border:none;border-radius:6px;' +
      'padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600">' +
      '🗑 Esborrar</button>' +
      '</div>' +
      '<div class="ud-adapted-content" contenteditable="true">' + html + '</div>';

    editor.appendChild(wrap);
    setTimeout(function () {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    }, 50);
  }

  function addAdaptButtons(card) {
    if (card._adaptButtonsAdded) return;
    const editor = card.querySelector('.ud-editor');
    if (!editor) return; // l'editor encara no s'ha creat
    card._adaptButtonsAdded = true;

    const container = document.createElement('div');
    container.className = 'ud-adapt-buttons';
    container.style.cssText =
      'display:flex;gap:8px;margin:8px 0 4px;flex-wrap:wrap;align-items:center';
    container.innerHTML =
      '<span style="font-size:12px;color:#3a4a6f;font-weight:600;margin-right:4px">' +
      'DUA · adaptar text:</span>' +
      '<button type="button" class="ud-adapt-simple" ' +
      'style="padding:6px 12px;border:1px solid #c8d0e8;border-radius:6px;' +
      'background:#e0f2fe;color:#1a2744;font-size:12px;font-weight:600;' +
      'font-family:inherit;cursor:pointer">📉 Simplificar (NEE)</button>' +
      '<button type="button" class="ud-adapt-amplify" ' +
      'style="padding:6px 12px;border:1px solid #c8d0e8;border-radius:6px;' +
      'background:#fef3c7;color:#1a2744;font-size:12px;font-weight:600;' +
      'font-family:inherit;cursor:pointer">📈 Ampliar (avançat)</button>';

    // Inserim el container just abans del toolbar (o de l'editor si no hi ha toolbar)
    const toolbar = editor.previousElementSibling;
    const beforeNode = toolbar && toolbar.classList && toolbar.classList.contains('ud-toolbar')
      ? toolbar
      : editor;
    beforeNode.parentNode.insertBefore(container, beforeNode);

    container.querySelector('.ud-adapt-simple').onclick = function () {
      adaptText(card, editor, 'simple');
    };
    container.querySelector('.ud-adapt-amplify').onclick = function () {
      adaptText(card, editor, 'amplify');
    };
  }

  // ── EVENT DELEGATION GLOBAL PER ALS BOTONS D'ESBORRAR ────────────
  // Captura clics a nivell de document perquè funcione encara que React
  // torne a renderitzar i els onclick directes es perden.

  function setupGlobalClickHandler() {
    document.addEventListener('click', function (e) {
      // Botó d'esborrar adaptació
      const adaptedDel = e.target.closest('.ud-adapted-del');
      if (adaptedDel) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = adaptedDel.closest('.ud-adapted-block');
        if (wrap && confirm('Esborrar aquesta adaptació?')) {
          const editor = wrap.closest('.ud-editor');
          wrap.remove();
          if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      // Botó d'esborrar àudio
      const audioDel = e.target.closest('.ud-audio-del');
      if (audioDel) {
        e.preventDefault();
        e.stopPropagation();
        const wrap = audioDel.closest('.ud-audio-wrap');
        if (wrap && confirm('Esborrar aquest àudio?')) {
          const editor = wrap.closest('.ud-editor');
          wrap.remove();
          if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
    }, true); // useCapture: true → s'executa abans que altres handlers
  }

  // ── INICIALITZACIÓ I OBSERVACIÓ DEL DOM ──────────────────────────

  function processNewElements() {
    document.querySelectorAll('.ud-toolbar').forEach(makeAudioButton);
    document.querySelectorAll('.session-card').forEach(addAdaptButtons);
  }

  function init() {
    setupGlobalClickHandler();
    processNewElements();

    let pending = false;
    const observer = new MutationObserver(function (mutations) {
      if (pending) return;
      let needs = false;
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        for (let j = 0; j < added.length; j++) {
          const n = added[j];
          if (n.nodeType !== 1) continue;
          if ((n.classList && (n.classList.contains('ud-toolbar') || n.classList.contains('session-card'))) ||
            (n.querySelector && n.querySelector('.ud-toolbar, .session-card'))) {
            needs = true;
            break;
          }
        }
        if (needs) break;
      }
      if (needs) {
        pending = true;
        setTimeout(function () {
          processNewElements();
          pending = false;
        }, 150);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    console.log('[enhancements.js] Inicialitzat correctament');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }
})();
