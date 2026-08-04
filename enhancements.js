// ===================================================================
// enhancements.js · v4
// Funcionalitats addicionals per a Unitats Didàctiques ESO CV
//
//  1. 🎵  Àudio al toolbar (Spotify / SoundCloud / MP3)
//  2. 📉📈 Simplificar / Ampliar text per sessió (DUA)
//  3. 🎼  Editor de partitura (ABC notation + Web Audio)
//  4. 🚫  Elimina el botó "Exportar a Canva" de l'app original
// ===================================================================

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════
  // 0. CAPA DE FIABILITAT DE LES CRIDES A LA IA
  // ══════════════════════════════════════════════════════════════════
  // Intercepta TOTES les crides a /api/ai/generate de l'aplicació
  // (incloses les del codi compilat que no podem modificar) i hi afegeix:
  //   · reintents automàtics amb espera creixent
  //   · límit mínim de tokens per evitar respostes tallades
  //   · detecció de respostes truncades
  //   · missatges d'error clars en lloc de fallades silencioses

  var AI_ENDPOINT   = '/api/ai/generate';
  var AI_MIN_TOKENS = 2500;   // mínim per evitar talls a mitja frase
  var AI_RETRIES    = 3;      // intents totals per crida
  var AI_BACKOFF    = 1200;   // ms d'espera inicial entre intents

  function aiSleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

  // Detecta si una resposta ha quedat tallada a mitges
  function aiLooksTruncated(text) {
    if (!text) return true;
    var t = text.trim();
    if (t.length < 20) return true;
    // Comptem claus i claudàtors: si no quadren, el JSON està incomplet
    var opens = (t.match(/[{[]/g) || []).length;
    var closes = (t.match(/[}\]]/g) || []).length;
    if (opens > closes) return true;
    // Cometes senars → cadena sense tancar
    var quotes = (t.match(/(?<!\\)"/g) || []).length;
    if (opens > 0 && quotes % 2 !== 0) return true;
    return false;
  }

  // Repara els defectes més habituals del JSON generat per la IA
  function aiRepairJSON(raw) {
    if (!raw) return null;
    var t = String(raw).trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    // Ens quedem només amb el bloc JSON
    var a = t.search(/[{[]/);
    if (a === -1) return null;
    var lastObj = t.lastIndexOf('}');
    var lastArr = t.lastIndexOf(']');
    var b = Math.max(lastObj, lastArr);
    if (b > a) t = t.substring(a, b + 1);
    else t = t.substring(a);

    // Intent 1: tal com està
    try { return JSON.parse(t); } catch(e) {}

    // Intent 2: netejar salts de línia literals i comes sobreres
    var t2 = t.replace(/\r/g, '').replace(/\n/g, ' ').replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(t2); } catch(e) {}

    // Intent 3: tancar estructures obertes (resposta truncada)
    var t3 = t2;
    // Tanquem una cadena oberta
    var q = (t3.match(/(?<!\\)"/g) || []).length;
    if (q % 2 !== 0) t3 += '"';
    // Retallem un element incomplet al final
    t3 = t3.replace(/,\s*[^,{}\[\]]*$/, '');
    // Tanquem claus i claudàtors pendents, en ordre
    var stack = [];
    for (var i = 0; i < t3.length; i++) {
      var c = t3[i];
      if (c === '{' || c === '[') stack.push(c);
      else if (c === '}' || c === ']') stack.pop();
    }
    while (stack.length) {
      var open = stack.pop();
      t3 += (open === '{' ? '}' : ']');
    }
    try { return JSON.parse(t3); } catch(e) {}

    return null;
  }

  // Substituïm window.fetch per una versió amb reintents per a la IA
  function installAIReliabilityLayer() {
    if (window.__udAIWrapped) return;
    window.__udAIWrapped = true;

    var nativeFetch = window.fetch.bind(window);

    window.fetch = async function(input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var isAI = url.indexOf(AI_ENDPOINT) !== -1;

      if (!isAI || !init || (init.method || '').toUpperCase() !== 'POST') {
        return nativeFetch(input, init);
      }

      // Pugem el límit de tokens si és massa baix (evita respostes tallades)
      var bodyObj = null;
      try {
        bodyObj = (typeof init.body === 'string') ? JSON.parse(init.body) : null;
      } catch(e) {}
      if (bodyObj) {
        var mt = bodyObj.maxTokens || bodyObj.max_tokens || 0;
        if (mt && mt < AI_MIN_TOKENS) {
          if (bodyObj.maxTokens) bodyObj.maxTokens = AI_MIN_TOKENS;
          if (bodyObj.max_tokens) bodyObj.max_tokens = AI_MIN_TOKENS;
          init = Object.assign({}, init, { body: JSON.stringify(bodyObj) });
        }
      }

      var lastErr = null;

      for (var attempt = 1; attempt <= AI_RETRIES; attempt++) {
        try {
          var res = await nativeFetch(input, init);

          // Errors temporals del servidor → reintentem
          if (res.status === 429 || res.status >= 500) {
            lastErr = new Error('El servidor de la IA no respon (error ' + res.status + ')');
            if (attempt < AI_RETRIES) { await aiSleep(AI_BACKOFF * attempt); continue; }
            return res;
          }
          if (!res.ok) return res; // 4xx: error real, no té sentit reintentar

          // Comprovem que el text no haja quedat tallat
          var clone = res.clone();
          var data = null;
          try { data = await clone.json(); } catch(e) { return res; }

          if (data && typeof data.text === 'string' && aiLooksTruncated(data.text)) {
            lastErr = new Error('La resposta de la IA ha arribat incompleta');
            if (attempt < AI_RETRIES) {
              await aiSleep(AI_BACKOFF * attempt);
              continue;
            }
          }
          return res;

        } catch (err) {
          // Error de xarxa (connexió lenta, tall...)
          lastErr = err;
          if (attempt < AI_RETRIES) { await aiSleep(AI_BACKOFF * attempt); continue; }
          throw new Error('No s\'ha pogut connectar amb la IA. Comprova la connexi\u00f3 i torna-ho a provar.');
        }
      }

      throw lastErr || new Error('Error desconegut en la crida a la IA');
    };

    // Fem el reparador accessible per a la resta de codi (media-editor.js inclòs)
    window.udRepairJSON = aiRepairJSON;
    console.log('[enhancements.js] Capa de fiabilitat de la IA activada');
  }

  // S'activa IMMEDIATAMENT (abans que l'app puga fer cap crida a la IA)
  installAIReliabilityLayer();


  // ══════════════════════════════════════════════════════════════════
  // UTILS
  // ══════════════════════════════════════════════════════════════════

  function toast(msg, isError) {
    var t = document.createElement('div');
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
    var r = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: prompt, maxTokens: maxTokens || 2000 })
    });
    if (!r.ok) {
      var errMsg = 'Error ' + r.status;
      try { var e = await r.json(); if (e && e.error) errMsg = e.error; } catch (_) {}
      throw new Error(errMsg);
    }
    var d = await r.json();
    return (d && d.text) || '';
  }

  // ══════════════════════════════════════════════════════════════════
  // 1. ÀUDIO
  // ══════════════════════════════════════════════════════════════════

  function parseSpotifyURL(url) {
    var m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
    if (!m) return null;
    return { type: m[1], embedURL: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] };
  }

  function parseSoundCloudURL(url) {
    if (!/soundcloud\.com\/[^/]+\/[^/?]+/.test(url)) return null;
    return {
      embedURL: 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) +
        '&color=%231a2744&auto_play=false&hide_related=false&show_comments=false&show_user=true'
    };
  }

  function isDirectAudioURL(url) {
    return /^https?:\/\/.+\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(url);
  }

  function makeAudioWrap(url, caption) {
    var sp = parseSpotifyURL(url);
    var sc = parseSoundCloudURL(url);
    var isFile = isDirectAudioURL(url);
    if (!sp && !sc && !isFile) return null;

    var wrap = document.createElement('div');
    wrap.className = 'ud-audio-wrap';
    wrap.setAttribute('contenteditable', 'false');
    wrap.setAttribute('data-ud-audio', '1');
    wrap.style.cssText = 'margin:14px 0;padding:12px;background:#f8f6ed;border:1px solid #e4e8f0;border-radius:10px;position:relative';

    var inner = '';
    if (sp) {
      var h = sp.type === 'track' || sp.type === 'episode' ? 152 : 352;
      inner = '<iframe src="' + sp.embedURL + '" width="100%" height="' + h +
        '" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:8px;display:block"></iframe>';
    } else if (sc) {
      inner = '<iframe src="' + sc.embedURL + '" width="100%" height="166" frameborder="0" scrolling="no" allow="autoplay" style="border-radius:8px;display:block"></iframe>';
    } else if (isFile) {
      inner = '<audio controls src="' + url + '" style="width:100%;display:block"></audio>';
    }
    if (caption) {
      inner += '<div style="margin-top:8px;font-size:13px;color:#3a4a6f;font-style:italic;text-align:center">🎵 ' +
        caption.replace(/</g, '&lt;') + '</div>';
    }
    inner += '<button type="button" class="ud-audio-del" title="Esborrar àudio" ' +
      'style="position:absolute;top:6px;right:6px;background:rgba(193,39,45,0.9);color:white;' +
      'border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600">🗑</button>';
    wrap.innerHTML = inner;
    return wrap;
  }

  function insertElementInEditor(editor, element) {
    editor.focus();
    var sel = window.getSelection();
    if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(element);
      var p = document.createElement('p');
      p.innerHTML = '<br>';
      element.after(p);
      range.setStartAfter(p);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(element);
      var p2 = document.createElement('p');
      p2.innerHTML = '<br>';
      editor.appendChild(p2);
    }
    setTimeout(function () { editor.dispatchEvent(new Event('input', { bubbles: true })); }, 50);
  }

  function openAudioModal(editor) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,39,68,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:inherit';
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:12px;padding:24px;width:480px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3)';
    box.innerHTML =
      '<h3 style="margin:0 0 16px;color:#1a2744;font-size:18px;font-weight:700">🎵 Inserir àudio</h3>' +
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#1a2744;font-size:13px">URL de Spotify, SoundCloud o MP3 directa</label>' +
      '<input id="ud-audio-url" type="text" placeholder="https://open.spotify.com/track/..." ' +
      'style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;font-size:14px;font-family:inherit;margin-bottom:14px;box-sizing:border-box">' +
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#1a2744;font-size:13px">Títol (opcional)</label>' +
      '<input id="ud-audio-cap" type="text" placeholder="Ex: Simfonia núm. 5 de Beethoven" ' +
      'style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;font-size:14px;font-family:inherit;margin-bottom:18px;box-sizing:border-box">' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<button id="ud-audio-cancel" type="button" style="padding:9px 16px;border:1px solid #c8d0e8;border-radius:8px;background:white;color:#1a2744;font-weight:600;font-family:inherit;cursor:pointer">Cancel·lar</button>' +
      '<button id="ud-audio-ok" type="button" style="padding:9px 16px;border:none;border-radius:8px;background:#1a2744;color:white;font-weight:600;font-family:inherit;cursor:pointer">Inserir</button>' +
      '</div>' +
      '<div style="margin-top:14px;padding:10px;background:#f0f4ff;border-radius:8px;font-size:12px;color:#3a4a6f;line-height:1.5">' +
      '💡 <strong>Suport:</strong> Spotify (cançons, àlbums, llistes), SoundCloud, MP3 directe.</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    var urlInput = box.querySelector('#ud-audio-url');
    setTimeout(function () { urlInput.focus(); }, 50);
    function close() { overlay.remove(); }
    box.querySelector('#ud-audio-cancel').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
    urlInput.onkeydown = function (e) {
      if (e.key === 'Enter') box.querySelector('#ud-audio-ok').click();
      if (e.key === 'Escape') close();
    };
    box.querySelector('#ud-audio-ok').onclick = function () {
      var url = urlInput.value.trim();
      var caption = box.querySelector('#ud-audio-cap').value.trim();
      if (!url) { toast('Has d\'introduir una URL', true); return; }
      var wrap = makeAudioWrap(url, caption);
      if (!wrap) { toast('URL no reconeguda. Usa Spotify, SoundCloud o un MP3 directe.', true); return; }
      insertElementInEditor(editor, wrap);
      close();
      toast('✓ Àudio inserit');
    };
  }

  function makeAudioButton(toolbar) {
    if (toolbar._audioBtnAdded) return;
    var editor = toolbar.nextElementSibling;
    if (!editor || !editor.classList.contains('ud-editor')) return;
    toolbar._audioBtnAdded = true;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🎵 Àudio';
    btn.title = 'Inserir àudio (Spotify, SoundCloud o MP3)';
    btn.onclick = function () { openAudioModal(editor); };
    toolbar.appendChild(btn);
  }

  // ══════════════════════════════════════════════════════════════════
  // 2. DUA  (Simplificar / Ampliar)
  // ══════════════════════════════════════════════════════════════════

  async function adaptText(card, editor, mode) {
    var btn = card.querySelector(mode === 'simple' ? '.ud-adapt-simple' : '.ud-adapt-amplify');
    if (!btn) return;
    var tmp = editor.cloneNode(true);
    tmp.querySelectorAll('[data-ud-img],[data-ud-vid],[data-ud-audio],[data-ud-score],.ud-img-controls,.ud-vid-controls,[data-ud-adapted]').forEach(function (el) { el.remove(); });
    var text = tmp.innerText.trim();
    if (!text || text.length < 50) { toast('Cal escriure primer el contingut per poder adaptar-lo.', true); return; }

    var sessionInputs = card.querySelectorAll('.session-header input[type=text]');
    var sessionName = (sessionInputs[0] || {}).value || '';
    var titol = document.querySelector('input[type=text]') ? document.querySelector('input[type=text]').value : 'la unitat';

    var originalText = btn.textContent;
    btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = '⏳ Generant...';

    try {
      var prompt;
      if (mode === 'simple') {
        prompt = 'Ets un docent expert en DUA i NEE.\n\nContext: Unitat "' + titol + '"' +
          (sessionName ? ', sessió "' + sessionName + '"' : '') +
          '.\n\nText original:\n---\n' + text + '\n---\n\n' +
          'Reescriu en VALENCIÀ simplificat per a alumnat amb dificultats ' +
          '(frases curtes màx 15 paraules, vocabulari quotidià, <b> per a conceptes clau, ' +
          'paràgrafs curts, frase resum inicial).\n\n' +
          'Sortida: NOMÉS HTML (<p> i <b>). Sense introduccions, sense Markdown, sense ```.';
      } else {
        prompt = 'Ets un docent expert en atenció a l\'alumnat avançat.\n\nContext: Unitat "' + titol + '"' +
          (sessionName ? ', sessió "' + sessionName + '"' : '') +
          '.\n\nText original:\n---\n' + text + '\n---\n\n' +
          'Reescriu en VALENCIÀ ampliant per a alumnat avançat ' +
          '(aprofundeix, vocabulari específic, connexions interdisciplinàries, to acadèmic ESO, ' +
          '<b> per a conceptes clau).\n\n' +
          'Sortida: NOMÉS HTML (<p> i <b>). Sense introduccions, sense Markdown, sense ```.';
      }
      var result = await callAI(prompt, 2000);
      result = result.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

      editor.querySelectorAll('[data-ud-adapted="' + mode + '"]').forEach(function (el) { el.remove(); });

      var isSimple = mode === 'simple';
      var bgColor = isSimple ? '#e0f2fe' : '#fef3c7';
      var borderColor = isSimple ? '#7dd3fc' : '#fde68a';
      var titleIcon = isSimple ? '📉' : '📈';
      var titleText = isSimple ? 'Versió simplificada (NEE / dificultats de lectura)' : 'Versió ampliada (alumnat avançat)';

      var wrap = document.createElement('div');
      wrap.className = 'ud-adapted-block';
      wrap.setAttribute('data-ud-adapted', mode);
      wrap.setAttribute('contenteditable', 'false');
      wrap.style.cssText = 'margin:18px 0 8px;padding:16px;background:' + bgColor +
        ';border:1.5px dashed ' + borderColor + ';border-radius:10px';
      wrap.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;' +
        'margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid ' + borderColor + '">' +
        '<strong style="color:#1a2744;font-size:13px">' + titleIcon + ' ' + titleText + '</strong>' +
        '<button type="button" class="ud-adapted-del" style="background:rgba(193,39,45,0.9);color:white;' +
        'border:none;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600">' +
        '🗑 Esborrar</button></div>' +
        '<div class="ud-adapted-content" contenteditable="true">' + result + '</div>';

      editor.appendChild(wrap);
      setTimeout(function () { editor.dispatchEvent(new Event('input', { bubbles: true })); }, 50);
      toast('✓ Versió ' + (isSimple ? 'simplificada' : 'ampliada') + ' afegida');
    } catch (e) {
      toast('Error: ' + e.message, true);
    } finally {
      btn.disabled = false; btn.style.opacity = '1'; btn.textContent = originalText;
    }
  }

  function addAdaptButtons(card) {
    if (card._adaptButtonsAdded) return;
    var editor = card.querySelector('.ud-editor');
    if (!editor) return;
    card._adaptButtonsAdded = true;
    var container = document.createElement('div');
    container.className = 'ud-adapt-buttons';
    container.style.cssText = 'display:flex;gap:8px;margin:8px 0 4px;flex-wrap:wrap;align-items:center';
    container.innerHTML =
      '<span style="font-size:12px;color:#3a4a6f;font-weight:600;margin-right:4px">DUA · adaptar text:</span>' +
      '<button type="button" class="ud-adapt-simple" style="padding:6px 12px;border:1px solid #c8d0e8;' +
      'border-radius:6px;background:#e0f2fe;color:#1a2744;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">' +
      '📉 Simplificar (NEE)</button>' +
      '<button type="button" class="ud-adapt-amplify" style="padding:6px 12px;border:1px solid #c8d0e8;' +
      'border-radius:6px;background:#fef3c7;color:#1a2744;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">' +
      '📈 Ampliar (avançat)</button>';
    var toolbar = editor.previousElementSibling;
    var beforeNode = (toolbar && toolbar.classList && toolbar.classList.contains('ud-toolbar')) ? toolbar : editor;
    beforeNode.parentNode.insertBefore(container, beforeNode);
    container.querySelector('.ud-adapt-simple').onclick = function () { adaptText(card, editor, 'simple'); };
    container.querySelector('.ud-adapt-amplify').onclick = function () { adaptText(card, editor, 'amplify'); };
  }

  // ══════════════════════════════════════════════════════════════════
  // 3. PARTITURA
  // 3b. EINES EXTRA PER A L'EDITOR DE TEXT
  // ══════════════════════════════════════════════════════════════════

  // CSS per a llistes, subtítols i caixes destacades dins de l'editor
  function injectEditorCSS() {
    if (document.getElementById('ud-extra-css')) return;
    var st = document.createElement('style');
    st.id = 'ud-extra-css';
    st.textContent =
      '.ud-editor ul{margin:8px 0;padding-left:26px;list-style:disc}' +
      '.ud-editor ol{margin:8px 0;padding-left:26px;list-style:decimal}' +
      '.ud-editor li{margin:4px 0}' +
      '.ud-editor h3{font-size:17px;font-weight:700;color:#1a2744;margin:16px 0 8px;' +
      'padding-bottom:3px;border-bottom:2px solid #c8960c}' +
      '.ud-editor [data-ud-callout]{margin:12px 0;padding:12px 14px;border-radius:8px;line-height:1.5}' +
      '.ud-editor [data-ud-callout="info"]{background:#e0f2fe;border-left:4px solid #0891b2}' +
      '.ud-editor [data-ud-callout="warn"]{background:#fef3c7;border-left:4px solid #f59e0b}' +
      '.ud-editor [data-ud-callout="act"]{background:#dcfce7;border-left:4px solid #10b981}';
    document.head.appendChild(st);
  }

  function addExtraToolbarButtons(toolbar) {
    if (toolbar._extraBtnsAdded) return;
    var editor = toolbar.nextElementSibling;
    if (!editor || !editor.classList.contains('ud-editor')) return;
    toolbar._extraBtnsAdded = true;

    function sync() {
      setTimeout(function(){ editor.dispatchEvent(new Event('input', { bubbles: true })); }, 50);
    }
    function fmt(cmd, val) {
      editor.focus();
      document.execCommand(cmd, false, val || null);
      sync();
    }
    function mkBtn(html, title, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.innerHTML = html; b.title = title;
      b.onclick = fn;
      return b;
    }
    function mkSep() {
      var s = document.createElement('span');
      s.style.cssText = 'width:1px;background:#c8d0e8;margin:0 2px;align-self:stretch';
      return s;
    }

    // Llistes
    var bUL = mkBtn('\u2022 Llista', 'Llista de punts', function(){ fmt('insertUnorderedList'); });
    var bOL = mkBtn('1. Llista', 'Llista numerada', function(){ fmt('insertOrderedList'); });

    // Subtitol (toggle H3 / paragraf)
    var bH3 = mkBtn('T Subt\u00edtol', 'Convertir en subt\u00edtol (clica de nou per tornar a text normal)', function(){
      var cur = '';
      try { cur = document.queryCommandValue('formatBlock'); } catch(e) {}
      if (/h3/i.test(cur)) fmt('formatBlock', '<p>');
      else fmt('formatBlock', '<h3>');
    });

    // Ressaltador groc
    var bHi = mkBtn('\uD83D\uDD8D Ressaltar', 'Ressaltar en groc (treure-ho amb Netejar format)', function(){
      try { document.execCommand('styleWithCSS', false, true); } catch(e) {}
      fmt('hiliteColor', '#fff3a3');
    });

    // Color de text
    var colSel = document.createElement('select');
    colSel.title = 'Color del text';
    colSel.style.cssText = 'padding:4px 6px;border:1px solid #c8d0e8;border-radius:6px;font-size:12px;background:white;color:#1a2744;cursor:pointer;height:28px';
    [['Color','__'],['Negre','#1a2744'],['Roig','#c1272d'],['Blau','#0867b2'],['Verd','#0a7d4f'],['Daurat','#c8960c']].forEach(function(p){
      var o = document.createElement('option');
      o.value = p[1]; o.textContent = p[0];
      if (p[1]==='__') o.selected = true;
      colSel.appendChild(o);
    });
    colSel.onchange = function() {
      if (colSel.value !== '__') {
        try { document.execCommand('styleWithCSS', false, true); } catch(e) {}
        fmt('foreColor', colSel.value);
      }
      colSel.value = '__';
    };

    // Caixes destacades
    var boxSel = document.createElement('select');
    boxSel.title = 'Inserir una caixa destacada';
    boxSel.style.cssText = colSel.style.cssText;
    [['\uD83D\uDCE6 Caixa','__'],['\uD83D\uDCA1 Informaci\u00f3','info'],['\u26A0\uFE0F Important','warn'],['\u270F\uFE0F Activitat','act']].forEach(function(p){
      var o = document.createElement('option');
      o.value = p[1]; o.textContent = p[0];
      if (p[1]==='__') o.selected = true;
      boxSel.appendChild(o);
    });
    boxSel.onchange = function() {
      var type = boxSel.value;
      boxSel.value = '__';
      if (type === '__') return;
      var labels = { info:'\uD83D\uDCA1 ', warn:'\u26A0\uFE0F ', act:'\u270F\uFE0F ' };
      var html = '<div data-ud-callout="' + type + '"><p>' + (labels[type]||'') + 'Escriu ac\u00ed el contingut...</p></div><p><br></p>';
      editor.focus();
      var sel = window.getSelection();
      if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        document.execCommand('insertHTML', false, html);
      } else {
        editor.innerHTML += html;
      }
      sync();
    };

    // Imatge per URL
    var bImgURL = mkBtn('\uD83C\uDF10 Imatge URL', "Inserir imatge des d\u2019una adre\u00e7a web", function(){
      var url = prompt('Adre\u00e7a (URL) de la imatge:');
      if (!url) return;
      url = url.trim();
      if (url.indexOf('http://') !== 0 && url.indexOf('https://') !== 0) { toast('La URL ha de comen\u00e7ar per http:// o https://', true); return; }
      editor.focus();
      var html = '<img src="' + url.replace(/"/g,'&quot;') + '" style="max-width:70%">';
      var sel = window.getSelection();
      if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        document.execCommand('insertHTML', false, html + '<p><br></p>');
      } else {
        editor.innerHTML += html + '<p><br></p>';
      }
      sync();
    });

    // Netejar format
    var bClear = mkBtn('\u232B Netejar', 'Treure tot el format del text seleccionat', function(){
      fmt('removeFormat');
      fmt('formatBlock', '<p>');
    });

    [mkSep(), bUL, bOL, bH3, mkSep(), bHi, colSel, mkSep(), boxSel, bImgURL, mkSep(), bClear].forEach(function(el){
      toolbar.appendChild(el);
    });
  }

  // Arrossegar i deixar anar imatges directament a l'editor
  function addDragDropSupport(editor) {
    if (editor._dragDropAdded) return;
    editor._dragDropAdded = true;

    editor.addEventListener('dragover', function(ev) {
      if (ev.dataTransfer && Array.prototype.some.call(ev.dataTransfer.items || [], function(it){ return it.kind === 'file'; })) {
        ev.preventDefault();
        editor.style.outline = '2px dashed #0891b2';
        editor.style.outlineOffset = '-2px';
      }
    });
    editor.addEventListener('dragleave', function() {
      editor.style.outline = '';
      editor.style.outlineOffset = '';
    });
    editor.addEventListener('drop', function(ev) {
      editor.style.outline = '';
      editor.style.outlineOffset = '';
      if (!ev.dataTransfer || !ev.dataTransfer.files || !ev.dataTransfer.files.length) return;
      var file = ev.dataTransfer.files[0];
      if (!file.type || file.type.indexOf('image/') !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      var reader = new FileReader();
      reader.onload = function(e) {
        var html = '<img src="' + e.target.result + '" style="max-width:70%">';
        editor.focus();
        document.execCommand('insertHTML', false, html + '<p><br></p>');
        setTimeout(function(){ editor.dispatchEvent(new Event('input', { bubbles: true })); }, 80);
        toast('\u2713 Imatge inserida');
      };
      reader.readAsDataURL(file);
    });
  }

  // 3c. REPRODUCCIÓ DE VÍDEOS YOUTUBE DINS DE LA PÀGINA
  // ══════════════════════════════════════════════════════════════════
  // L'app original obria YouTube en una pestanya nova. Ara el vídeo es
  // reprodueix incrustat dins de la pàgina en clicar la miniatura.

  function buildVideoThumb(id) {
    var thumbWrap = document.createElement('div');
    thumbWrap.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;border:1px solid #e4e8f0;cursor:pointer;';
    var img = document.createElement('img');
    img.src = 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg';
    img.alt = 'Video YouTube';
    img.style.cssText = 'width:100%;display:block;';
    var play = document.createElement('div');
    play.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;';
    play.innerHTML = '<svg viewBox="0 0 68 48" width="56" height="40"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C0 13.05 0 24 0 24s0 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C68 34.95 68 24 68 24s0-10.95-1.48-16.26z" fill="rgba(0,0,0,0.7)"/><path d="M45 24 27 14v20" fill="#fff"/></svg>';
    thumbWrap.appendChild(img);
    thumbWrap.appendChild(play);
    return thumbWrap;
  }

  function swapToInlinePlayer(wrap, box) {
    var id = wrap.getAttribute('data-ud-vid');
    if (!id) return;
    // El primer div fill del box es la miniatura
    var thumb = box.firstElementChild;
    if (!thumb) return;

    var player = document.createElement('div');
    player.setAttribute('data-ud-inline-player', '1');
    player.style.cssText = 'position:relative;width:100%;padding-bottom:56.25%;border-radius:8px;overflow:hidden;border:1px solid #e4e8f0;background:#000;';
    player.innerHTML =
      '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0" ' +
      'referrerpolicy="strict-origin-when-cross-origin" ' +
      'style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" ' +
      'allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>' +
      '<button type="button" data-ud-close-player="1" title="Tancar el reproductor" ' +
      'style="position:absolute;top:6px;right:6px;z-index:10;background:rgba(0,0,0,0.7);color:white;' +
      'border:none;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;font-family:inherit;font-weight:700">\u2715</button>';

    box.replaceChild(player, thumb);
    wrap._udPlayerActive = true; // marca en memoria (no es serialitza)
  }

  function restoreVideoThumb(wrap) {
    var id = wrap.getAttribute('data-ud-vid');
    var box = wrap.querySelector('.ud-vid-box');
    if (!id || !box) return;
    var player = box.querySelector('[data-ud-inline-player]');
    if (!player) return;
    box.replaceChild(buildVideoThumb(id), player);
    wrap._udPlayerActive = false;
  }

  function setupInlineVideoPlayback() {
    // Captura el clic ABANS que el listener original (que obria pestanya nova)
    document.addEventListener('click', function(e) {
      // Boto de tancar el reproductor
      var closeBtn = e.target.closest('[data-ud-close-player]');
      if (closeBtn) {
        e.preventDefault(); e.stopPropagation();
        var wrapC = closeBtn.closest('[data-ud-vid]');
        if (wrapC) restoreVideoThumb(wrapC);
        return;
      }
      // Clic a la miniatura del video
      var box = e.target.closest('.ud-vid-box');
      if (!box) return;
      if (e.target.closest('.ud-img-controls')) return; // no interceptem els controls
      var wrap = box.closest('[data-ud-vid]');
      if (!wrap) return;
      if (box.querySelector('[data-ud-inline-player]')) return; // ja esta reproduint
      e.preventDefault();
      e.stopPropagation();
      swapToInlinePlayer(wrap, box);
    }, true); // capture phase: intercepta abans del window.open original
  }

  // Si una sessio guardada conte un reproductor incrustat (amb autoplay),
  // el restaurem a miniatura per evitar que comence a sonar sol en obrir.
  function cleanupSavedPlayers() {
    document.querySelectorAll('[data-ud-vid]').forEach(function(wrap) {
      if (wrap._udPlayerActive) return; // l'ha obert l'usuari ara mateix
      if (wrap.querySelector('[data-ud-inline-player]')) restoreVideoThumb(wrap);
    });
  }

  // 3d. MAPA CONCEPTUAL + MENÚ DESPLEGABLE DE LA CAPÇALERA
  // ══════════════════════════════════════════════════════════════════

  function renderMindMap(conceptes, container) {
    var W = container.clientWidth || 820;
    var H = 540;
    var CX = W/2, CY = H/2;
    var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    svg.style.cssText = 'display:block;font-family:inherit';
    var bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('width',W); bg.setAttribute('height',H);
    bg.setAttribute('fill','#f8fafc'); bg.setAttribute('rx','12');
    svg.appendChild(bg);

    var colors = ['#0891b2','#7c3aed','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316'];
    var center = conceptes[0];
    var nodes = conceptes.slice(1);
    var angleStep = (2*Math.PI)/Math.max(nodes.length,1);
    var radius = Math.min(W,H)*0.33;

    function addText(g, x, y, label, size, weight, fill, maxChars) {
      var words = label.split(' ');
      if (words.length <= 2 || label.length <= maxChars) {
        var t = document.createElementNS('http://www.w3.org/2000/svg','text');
        t.setAttribute('x',x); t.setAttribute('y',y+5);
        t.setAttribute('text-anchor','middle');
        t.setAttribute('font-size',size); t.setAttribute('font-weight',weight);
        t.setAttribute('fill',fill);
        t.textContent = label.length > maxChars+2 ? label.substring(0,maxChars+1)+'\u2026' : label;
        g.appendChild(t);
      } else {
        var mid = Math.ceil(words.length/2);
        [words.slice(0,mid).join(' '), words.slice(mid).join(' ')].forEach(function(line, li){
          var t2 = document.createElementNS('http://www.w3.org/2000/svg','text');
          t2.setAttribute('x',x); t2.setAttribute('y', y + (li===0 ? -3 : 13));
          t2.setAttribute('text-anchor','middle');
          t2.setAttribute('font-size',size-1); t2.setAttribute('font-weight',weight);
          t2.setAttribute('fill',fill);
          t2.textContent = line.length > maxChars ? line.substring(0,maxChars-1)+'\u2026' : line;
          g.appendChild(t2);
        });
      }
    }

    nodes.forEach(function(node, i) {
      var angle = i*angleStep - Math.PI/2;
      var nx = CX + radius*Math.cos(angle);
      var ny = CY + radius*Math.sin(angle);
      var col = colors[i % colors.length];

      var line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1',CX); line.setAttribute('y1',CY);
      line.setAttribute('x2',nx); line.setAttribute('y2',ny);
      line.setAttribute('stroke',col); line.setAttribute('stroke-width','2');
      line.setAttribute('stroke-opacity','0.5');
      svg.appendChild(line);

      if (node.fills && node.fills.length) {
        var subR = 95;
        var subStep = Math.PI/Math.max(node.fills.length+1,2);
        var baseA = angle - Math.PI/2 + subStep;
        node.fills.forEach(function(fill, j){
          var sa = baseA + j*subStep;
          var sx = nx + subR*Math.cos(sa);
          var sy = ny + subR*Math.sin(sa);
          var sl = document.createElementNS('http://www.w3.org/2000/svg','line');
          sl.setAttribute('x1',nx); sl.setAttribute('y1',ny);
          sl.setAttribute('x2',sx); sl.setAttribute('y2',sy);
          sl.setAttribute('stroke',col); sl.setAttribute('stroke-width','1.5');
          sl.setAttribute('stroke-opacity','0.35'); sl.setAttribute('stroke-dasharray','4,3');
          svg.appendChild(sl);
          var sg = document.createElementNS('http://www.g3.org/2000/svg','g');
          sg = document.createElementNS('http://www.w3.org/2000/svg','g');
          var sr = document.createElementNS('http://www.w3.org/2000/svg','rect');
          sr.setAttribute('x',sx-58); sr.setAttribute('y',sy-16);
          sr.setAttribute('width',116); sr.setAttribute('height',32);
          sr.setAttribute('rx',8); sr.setAttribute('fill','white');
          sr.setAttribute('stroke',col); sr.setAttribute('stroke-width','1');
          sr.setAttribute('stroke-opacity','0.5');
          sg.appendChild(sr);
          var st = document.createElementNS('http://www.w3.org/2000/svg','text');
          st.setAttribute('x',sx); st.setAttribute('y',sy+4);
          st.setAttribute('text-anchor','middle');
          st.setAttribute('font-size','11'); st.setAttribute('fill','#334155');
          st.textContent = fill.length > 15 ? fill.substring(0,14)+'\u2026' : fill;
          sg.appendChild(st);
          svg.appendChild(sg);
        });
      }

      var g = document.createElementNS('http://www.w3.org/2000/svg','g');
      var el = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
      el.setAttribute('cx',nx); el.setAttribute('cy',ny);
      el.setAttribute('rx',72); el.setAttribute('ry',30);
      el.setAttribute('fill',col); el.setAttribute('fill-opacity','0.15');
      el.setAttribute('stroke',col); el.setAttribute('stroke-width','2');
      g.appendChild(el);
      addText(g, nx, ny, node.nom||'', 13, '600', col, 15);
      svg.appendChild(g);
    });

    var cg = document.createElementNS('http://www.w3.org/2000/svg','g');
    var cel = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
    cel.setAttribute('cx',CX); cel.setAttribute('cy',CY);
    cel.setAttribute('rx',95); cel.setAttribute('ry',45);
    cel.setAttribute('fill','#1e293b');
    cg.appendChild(cel);
    addText(cg, CX, CY, (center&&center.nom)||'', 15, '700', '#ffffff', 17);
    svg.appendChild(cg);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  function openMindMapModal(conceptes, titol) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,39,68,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:20px;box-sizing:border-box';
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:16px;padding:24px;width:100%;max-width:920px;box-shadow:0 24px 64px rgba(0,0,0,0.35);display:flex;flex-direction:column;gap:16px';
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px';
    header.innerHTML =
      '<h3 style="margin:0;color:#1e293b;font-size:19px;font-weight:700">\uD83E\uDDE0 Mapa conceptual \u00b7 ' + (titol||'') + '</h3>' +
      '<div style="display:flex;gap:8px">' +
      '<button id="ud-map-export" type="button" style="padding:8px 14px;border:1px solid #c8d0e8;border-radius:8px;background:white;color:#1e293b;font-weight:600;font-family:inherit;cursor:pointer;font-size:13px">\uD83D\uDCBE Descarregar SVG</button>' +
      '<button id="ud-map-close" type="button" style="padding:8px 14px;border:none;border-radius:8px;background:#1e293b;color:white;font-weight:600;font-family:inherit;cursor:pointer;font-size:13px">Tancar</button>' +
      '</div>';
    var mapContainer = document.createElement('div');
    mapContainer.style.cssText = 'width:100%;border-radius:12px;overflow:hidden;min-height:540px';
    box.appendChild(header); box.appendChild(mapContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    renderMindMap(conceptes, mapContainer);
    box.querySelector('#ud-map-close').onclick = function(){ overlay.remove(); };
    overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
    box.querySelector('#ud-map-export').onclick = function(){
      var svgEl = mapContainer.querySelector('svg');
      if (!svgEl) return;
      var svgData = new XMLSerializer().serializeToString(svgEl);
      var blob = new Blob([svgData], { type:'image/svg+xml;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = (titol||'mapa_conceptual').replace(/[^\w\u00C0-\u00FF\s\-]/g,'').trim() + '_mapa.svg';
      a.click();
      URL.revokeObjectURL(url);
      toast('\u2713 Mapa descarregat!');
    };
  }

  async function generateMindMap() {
    var titolInput = document.querySelector('input[type=text]');
    var titol = titolInput ? titolInput.value : 'Unitat';
    var allText = 'Unitat: ' + titol + '\n';
    document.querySelectorAll('.session-card').forEach(function(card, i) {
      var nomInput = card.querySelector('.session-header input[type=text]');
      var nom = nomInput ? nomInput.value : ('Sessi\u00f3 ' + (i+1));
      var editors = card.querySelectorAll('.ud-editor');
      var text = editors.length ? editors[0].innerText.trim().substring(0,800) : '';
      if (text) allText += '\n--- ' + nom + ' ---\n' + text;
    });
    if (allText.length < 150) { toast('Cal tindre contingut a les sessions primer.', true); return; }

    toast('\u23F3 Generant el mapa conceptual...');
    try {
      var prompt = "Analitza el contingut d'aquesta unitat did\u00e0ctica i genera un mapa conceptual en format JSON.\n\nContingut:\n---\n" +
        allText.substring(0,4000) +
        "\n---\n\nRetorna \u00daNICAMENT un array JSON (sense explicacions, sense Markdown):\n" +
        '[{"nom":"Concepte Central","fills":[]},{"nom":"Tema 1","fills":["subtema","subtema"]},{"nom":"Tema 2","fills":[]}]\n' +
        "El primer element \u00e9s el concepte central (t\u00edtol resumit). Els altres (entre 4 i 7) s\u00f3n temes principals amb 0-3 subtemes cadascun. Tot en VALENCI\u00c0.";
      var result = await callAI(prompt, 900);
      result = result.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/i,'').trim();
      var conceptes = JSON.parse(result);
      if (!Array.isArray(conceptes) || conceptes.length < 2) throw new Error('Format inesperat');
      openMindMapModal(conceptes, titol);
    } catch(e) {
      toast('Error generant el mapa: ' + e.message, true);
    }
  }

  // ── MENÚ DESPLEGABLE A LA CAPÇALERA ───────────────────────────────
  function organizeHeader() {
    var container = document.querySelector('.header-actions');
    if (!container) return;

    if (!document.getElementById('ud-tools-menu')) {
      var wrap = document.createElement('div');
      wrap.id = 'ud-tools-menu';
      wrap.style.cssText = 'position:relative;display:inline-block';

      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn btn-sm btn-outline header-btn';
      toggle.textContent = '\uD83D\uDCE4 Exportar \u25BE';
      toggle.title = 'Exportacions i eines de la unitat';

      var panel = document.createElement('div');
      panel.style.cssText = 'position:absolute;top:calc(100% + 6px);right:0;z-index:5000;background:white;' +
        'border:1px solid #c8d0e8;border-radius:10px;box-shadow:0 10px 30px rgba(26,39,68,0.18);' +
        'padding:6px;display:none;min-width:230px;flex-direction:column;gap:2px';

      var ITEM = 'display:block;width:100%;text-align:left;padding:9px 12px;border:none;background:none;' +
        'border-radius:7px;font-size:13px;font-family:inherit;color:#1a2744;cursor:pointer;font-weight:600';

      function addItem(label, fn) {
        var b = document.createElement('button');
        b.type = 'button'; b.style.cssText = ITEM; b.textContent = label;
        b.onmouseover = function(){ b.style.background = '#f0f4ff'; };
        b.onmouseout  = function(){ b.style.background = 'none'; };
        b.onclick = function(e){ e.stopPropagation(); panel.style.display = 'none'; fn(); };
        panel.appendChild(b);
      }
      function addSep() {
        var s = document.createElement('div');
        s.style.cssText = 'height:1px;background:#e4e8f0;margin:4px 6px';
        panel.appendChild(s);
      }
      function proxy(id) {
        return function() {
          var o = document.getElementById(id);
          if (o) o.click();
          else toast('Aquesta funci\u00f3 encara no est\u00e0 disponible', true);
        };
      }

      addItem('\uD83C\uDF10 HTML Alumnes', proxy('ud-html-btn'));
      addItem('\uD83E\uDDE0 Mapa Conceptual', generateMindMap);
      addSep();
      addItem('\uD83D\uDCE6 Exportar unitats (.json)', proxy('ud-export-btn'));
      addItem('\uD83D\uDCC2 Importar unitats (.json)', proxy('ud-import-btn'));

      toggle.onclick = function(e) {
        e.stopPropagation();
        panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
      };
      document.addEventListener('click', function() { panel.style.display = 'none'; });

      wrap.appendChild(toggle);
      wrap.appendChild(panel);
      container.appendChild(wrap);
    }

    // Amaguem els botons que ara viuen dins del menú (el PDF Professor queda VISIBLE)
    if (document.getElementById('ud-tools-menu')) {
      ['ud-html-btn','ud-export-btn','ud-import-btn'].forEach(function(id) {
        var b = document.getElementById(id);
        if (b && b.style.display !== 'none') b.style.display = 'none';
      });
      // Assegurem que el PDF Professor està visible
      var pdfBtn = document.getElementById('ud-pdf-prof-btn');
      if (pdfBtn && pdfBtn.style.display === 'none') pdfBtn.style.display = '';
    }
  }

  // 3e. CÒPIA DE SEGURETAT AUTOMÀTICA AL GOOGLE DRIVE
  // ══════════════════════════════════════════════════════════════════

  var BK_URL_KEY  = 'ud_backup_url';
  var BK_LAST_KEY = 'ud_backup_last';
  var BK_HASH_KEY = 'ud_backup_hash';
  var UNITS_KEY   = 'ud_units';

  function bkGetURL()  { try { return localStorage.getItem(BK_URL_KEY) || ''; } catch(e) { return ''; } }
  function bkSetURL(u) { try { localStorage.setItem(BK_URL_KEY, u); } catch(e) {} }
  function bkGetLast() { try { return localStorage.getItem(BK_LAST_KEY) || ''; } catch(e) { return ''; } }

  function bkGetUnits() {
    try { return JSON.parse(localStorage.getItem(UNITS_KEY) || '[]'); } catch(e) { return []; }
  }

  // Signatura simple del contingut, per no enviar còpies idèntiques
  function bkHash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return String(h) + '_' + str.length;
  }

  function bkDaysSinceLast() {
    var last = bkGetLast();
    if (!last) return 999;
    var d = new Date(last);
    if (isNaN(d.getTime())) return 999;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  // Envia les unitats a l'Apps Script.
  // text/plain evita la petició prèvia de permisos (CORS preflight).
  async function bkSend(silent) {
    var url = bkGetURL();
    if (!url) { if (!silent) toast('Primer has de configurar la còpia de seguretat.', true); return false; }

    var units = bkGetUnits();
    if (!units.length) { if (!silent) toast('No hi ha cap unitat guardada per copiar.', true); return false; }

    var payload = JSON.stringify({ unitats: units });

    // Si res no ha canviat des de l'última còpia, no enviem
    var hash = bkHash(payload);
    if (silent) {
      try { if (localStorage.getItem(BK_HASH_KEY) === hash) return true; } catch(e) {}
    }

    try {
      var r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload
      });
      var res = await r.json();
      if (!res.ok) throw new Error(res.error || 'error desconegut');

      try {
        localStorage.setItem(BK_LAST_KEY, new Date().toISOString());
        localStorage.setItem(BK_HASH_KEY, hash);
      } catch(e) {}

      if (!silent) toast('\u2713 C\u00f2pia guardada al Drive (' + res.unitats + ' unitats)');
      bkUpdateBadge();
      return true;
    } catch(e) {
      if (!silent) toast('Error en la c\u00f2pia: ' + e.message, true);
      return false;
    }
  }

  // Recupera l'última còpia del Drive
  async function bkRestore() {
    var url = bkGetURL();
    if (!url) { toast('Primer has de configurar la c\u00f2pia de seguretat.', true); return; }
    try {
      var r = await fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'accio=recuperar');
      var res = await r.json();
      if (!res.ok) throw new Error(res.error || 'error desconegut');
      var n = (res.unitats || []).length;
      if (!n) { toast('La c\u00f2pia del Drive est\u00e0 buida.', true); return; }

      var actuals = bkGetUnits().length;
      if (!confirm(
        'RECUPERAR C\u00d2PIA DEL DRIVE\n\n' +
        'C\u00f2pia del ' + (res.data || '?') + ' \u2014 ' + n + ' unitats.\n' +
        'Ara mateix tens ' + actuals + ' unitats al navegador.\n\n' +
        '\u26A0\uFE0F Les unitats actuals seran SUBSTITU\u00cfDES per les de la c\u00f2pia.\n\n' +
        'Vols continuar?'
      )) return;

      localStorage.setItem(UNITS_KEY, JSON.stringify(res.unitats));
      alert('\u2705 C\u00f2pia recuperada correctament (' + n + ' unitats).\n\nLa p\u00e0gina es recarregar\u00e0 ara.');
      location.reload();
    } catch(e) {
      toast('Error en recuperar: ' + e.message, true);
    }
  }

  // Indicador visual a la capçalera
  function bkUpdateBadge() {
    var badge = document.getElementById('ud-bk-badge');
    if (!badge) return;
    var url = bkGetURL();
    if (!url) {
      badge.textContent = '\u26A0\uFE0F C\u00f2pia sense configurar';
      badge.style.background = '#fef3c7';
      badge.style.color = '#92400e';
      badge.style.display = '';
      return;
    }
    var d = bkDaysSinceLast();
    if (d === 999) {
      badge.textContent = '\u26A0\uFE0F Cap c\u00f2pia encara';
      badge.style.background = '#fef3c7'; badge.style.color = '#92400e';
    } else if (d >= 7) {
      badge.textContent = '\u26A0\uFE0F Sense c\u00f2pia fa ' + d + ' dies';
      badge.style.background = '#fee2e2'; badge.style.color = '#991b1b';
    } else {
      badge.textContent = '\u2713 C\u00f2pia al dia';
      badge.style.background = '#dcfce7'; badge.style.color = '#166534';
    }
    badge.style.display = '';
  }

  // Finestra de configuració
  function bkOpenConfig() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,39,68,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:16px;box-sizing:border-box;overflow-y:auto';
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:16px;padding:26px;width:100%;max-width:620px;box-shadow:0 24px 64px rgba(0,0,0,0.3);display:flex;flex-direction:column;gap:16px';

    var last = bkGetLast();
    var lastTxt = last ? new Date(last).toLocaleString('ca-ES') : 'mai';
    var nUnits = bkGetUnits().length;

    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;color:#1e293b;font-size:19px;font-weight:700">\uD83D\uDCBE C\u00f2pia de seguretat al Drive</h3>' +
      '<button id="bk-close" type="button" style="padding:7px 13px;border:none;border-radius:8px;background:#1e293b;color:white;font-weight:600;font-family:inherit;cursor:pointer">\u2715</button>' +
      '</div>' +

      '<div style="background:#f0f9ff;border-radius:10px;padding:12px 14px;font-size:13px;color:#0c4a6e;line-height:1.6">' +
      '<b>Unitats al navegador:</b> ' + nUnits + '<br>' +
      '<b>\u00daltima c\u00f2pia:</b> ' + lastTxt +
      '</div>' +

      '<details style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">' +
      '<summary style="cursor:pointer;font-weight:700;color:#1e293b;font-size:13px">\uD83D\uDCD6 Com configurar-ho (primera vegada)</summary>' +
      '<ol style="margin:10px 0 0;padding-left:20px;font-size:12.5px;color:#334155;line-height:1.9">' +
      '<li>Obri <b>script.google.com</b> i crea un <b>projecte nou</b></li>' +
      '<li>Esborra tot el codi que hi haja i <b>enganxa el codi</b> que t\'ha donat el Claude</li>' +
      '<li>Clica <b>Desplega \u2192 Nou desplegament</b></li>' +
      '<li>A la rodeta \u2699\uFE0F tria <b>Aplicaci\u00f3 web</b></li>' +
      '<li>Executa com a: <b>Jo mateix</b> \u00b7 Qui hi t\u00e9 acc\u00e9s: <b>Qualsevol persona</b></li>' +
      '<li>Clica <b>Desplega</b> i autoritza els permisos que et demane</li>' +
      '<li>Copia l\'<b>URL de l\'aplicaci\u00f3 web</b> (acaba en <code>/exec</code>) i enganxa-la ac\u00ed baix</li>' +
      '</ol></details>' +

      '<div>' +
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#1e293b;font-size:13px">URL de l\'Apps Script</label>' +
      '<input id="bk-url" type="text" placeholder="https://script.google.com/macros/s/.../exec" ' +
      'style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;font-size:13px;font-family:monospace;box-sizing:border-box">' +
      '</div>' +

      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="bk-test" type="button" style="padding:9px 15px;border:1.5px solid #0891b2;border-radius:8px;background:white;color:#0891b2;font-weight:600;font-family:inherit;cursor:pointer;font-size:13px">\uD83D\uDD0C Provar connexi\u00f3</button>' +
      '<button id="bk-now" type="button" style="padding:9px 15px;border:none;border-radius:8px;background:#0891b2;color:white;font-weight:600;font-family:inherit;cursor:pointer;font-size:13px">\uD83D\uDCBE Copiar ara</button>' +
      '<button id="bk-restore" type="button" style="padding:9px 15px;border:1.5px solid #f59e0b;border-radius:8px;background:white;color:#b45309;font-weight:600;font-family:inherit;cursor:pointer;font-size:13px">\u21BA Recuperar del Drive</button>' +
      '</div>' +

      '<div id="bk-msg" style="display:none;padding:11px 13px;border-radius:8px;font-size:13px;line-height:1.5"></div>' +

      '<div style="font-size:12px;color:#64748b;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:12px">' +
      '\uD83D\uDD12 Un cop configurat, la c\u00f2pia es fa <b>autom\u00e0ticament</b> cada vegada que deses una unitat i en tancar l\'app. ' +
      'Es conserven les <b>30 c\u00f2pies</b> m\u00e9s recents al teu Drive, dins la carpeta <i>Unitats Didactiques - Copies</i>.' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var inp = box.querySelector('#bk-url');
    var msg = box.querySelector('#bk-msg');
    inp.value = bkGetURL();

    function show(text, isErr) {
      msg.textContent = text;
      msg.style.display = 'block';
      msg.style.background = isErr ? '#fef2f2' : '#dcfce7';
      msg.style.color = isErr ? '#991b1b' : '#166534';
    }
    function saveURL() {
      var u = inp.value.trim();
      if (u && u.indexOf('https://script.google.com/') !== 0) {
        show('L\'URL ha de comen\u00e7ar per https://script.google.com/', true);
        return null;
      }
      bkSetURL(u);
      return u;
    }

    box.querySelector('#bk-close').onclick = function(){ saveURL(); bkUpdateBadge(); overlay.remove(); };
    overlay.onclick = function(e){ if (e.target === overlay) { saveURL(); bkUpdateBadge(); overlay.remove(); } };

    box.querySelector('#bk-test').onclick = async function() {
      var u = saveURL();
      if (!u) { show('Enganxa primer l\'URL de l\'Apps Script.', true); return; }
      show('Provant la connexi\u00f3...', false);
      try {
        var r = await fetch(u);
        var res = await r.json();
        if (res.ok) show('\u2705 Connexi\u00f3 correcta! Ja pots fer c\u00f2pies (' + (res.copies || 0) + ' c\u00f2pies al Drive).', false);
        else show('\u274C ' + (res.error || 'resposta inesperada'), true);
      } catch(e) {
        show('\u274C No s\'ha pogut connectar. Revisa que el desplegament tinga acc\u00e9s "Qualsevol persona".', true);
      }
    };

    box.querySelector('#bk-now').onclick = async function() {
      var u = saveURL();
      if (!u) { show('Enganxa primer l\'URL de l\'Apps Script.', true); return; }
      show('Guardant la c\u00f2pia...', false);
      var ok = await bkSend(false);
      if (ok) show('\u2705 C\u00f2pia guardada correctament al teu Drive.', false);
      else show('\u274C No s\'ha pogut guardar. Prova la connexi\u00f3 primer.', true);
    };

    box.querySelector('#bk-restore').onclick = function() { saveURL(); bkRestore(); };
  }

  // Vigila el localStorage: quan canvien les unitats, fa còpia automàtica
  function bkWatchChanges() {
    var lastSeen = '';
    try { lastSeen = localStorage.getItem(UNITS_KEY) || ''; } catch(e) {}
    var timer = null;

    setInterval(function() {
      if (!bkGetURL()) return;
      var now = '';
      try { now = localStorage.getItem(UNITS_KEY) || ''; } catch(e) { return; }
      if (now === lastSeen) return;
      lastSeen = now;
      // Esperem 5s d'inactivitat per no enviar a cada tecla
      clearTimeout(timer);
      timer = setTimeout(function(){ bkSend(true); }, 5000);
    }, 3000);

    // Còpia en tancar la pestanya (si fa més d'un dia)
    window.addEventListener('beforeunload', function() {
      if (!bkGetURL() || bkDaysSinceLast() < 1) return;
      try {
        navigator.sendBeacon(bkGetURL(),
          new Blob([JSON.stringify({ unitats: bkGetUnits() })], { type: 'text/plain;charset=utf-8' }));
        localStorage.setItem(BK_LAST_KEY, new Date().toISOString());
      } catch(e) {}
    });
  }

  // Botó + indicador a la capçalera
  function addBackupButton() {
    var container = document.querySelector('.header-actions');
    if (!container || document.getElementById('ud-bk-btn')) return;

    var badge = document.createElement('span');
    badge.id = 'ud-bk-badge';
    badge.style.cssText = 'display:none;font-size:11px;font-weight:700;padding:4px 9px;border-radius:20px;margin-right:2px;white-space:nowrap';

    var btn = document.createElement('button');
    btn.id = 'ud-bk-btn';
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline header-btn';
    btn.textContent = '\uD83D\uDCBE C\u00f2pia';
    btn.title = 'C\u00f2pia de seguretat al Google Drive';
    btn.onclick = bkOpenConfig;

    container.appendChild(badge);
    container.appendChild(btn);
    bkUpdateBadge();
  }

  // 3f. GENERAR SESSIONS A PARTIR D'UN PDF
  // ══════════════════════════════════════════════════════════════════

  var PDF_MAX_MB = 28;          // límit raonable per crida a l'API
  var PDF_MAX_PAGINES = 55;     // a partir d'ací, oferim retallar

  function fitxerABase64(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1]); };
      r.onerror = function () { rej(new Error('No s\u2019ha pogut llegir el fitxer')); };
      r.readAsDataURL(file);
    });
  }

  // Compta les pàgines sense llibreries externes
  async function contaPagines(file) {
    try {
      var txt = await file.slice(0, Math.min(file.size, 6e6)).text();
      var m = txt.match(/\/Type\s*\/Page[^s]/g);
      if (m && m.length) return m.length;
      var c2 = txt.match(/\/Count\s+(\d+)/);
      if (c2) return parseInt(c2[1], 10);
    } catch (e) {}
    return 0;
  }

  // Crida a la IA enviant-li el PDF
  async function callAIambPDF(pdfB64, prompt, maxTokens) {
    var r = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: pdfB64, prompt: prompt, maxTokens: maxTokens || 8000 })
    });
    if (!r.ok) {
      var em = 'Error ' + r.status;
      try { var e = await r.json(); if (e && e.error) em = e.error; } catch (_) {}
      throw new Error(em);
    }
    var d = await r.json();
    return (d && d.text) || '';
  }

  // Escriu les sessions generades a l'app, simulant l'edició manual
  function aplicaSessions(sessions) {
    var cards = document.querySelectorAll('.session-card');
    var setVal = function (el, val) {
      var proto = el.tagName === 'TEXTAREA'
        ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      var setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    var aplicades = 0;
    sessions.forEach(function (s, i) {
      var card = cards[i];
      if (!card) return;
      // Desplega la targeta si està plegada
      var body = card.querySelector('.session-body');
      if (!body) {
        var hdr = card.querySelector('.session-header');
        if (hdr) hdr.click();
        body = card.querySelector('.session-body');
      }
      if (!body) return;

      var nom = card.querySelector('.session-name-display');
      if (nom && s.titol) setVal(nom, s.titol);

      var tas = body.querySelectorAll('textarea');
      if (tas[0] && s.objectius) setVal(tas[0], s.objectius);
      if (tas[1] && s.notes) setVal(tas[1], s.notes);
      aplicades++;
    });
    return aplicades;
  }

  function obreModalPDF() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,39,68,.6);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;font-family:inherit;padding:16px;' +
      'box-sizing:border-box;overflow-y:auto';
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:16px;padding:26px;width:100%;max-width:640px;' +
      'box-shadow:0 24px 64px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:15px';

    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;color:#1a2744;font-size:19px;font-weight:700">\uD83D\uDCC4 Generar sessions des d\u2019un PDF</h3>' +
      '<button id="pdf-close" type="button" style="padding:7px 13px;border:none;border-radius:8px;' +
      'background:#1a2744;color:#fff;font-weight:600;font-family:inherit;cursor:pointer">\u2715</button></div>' +

      '<div><label style="display:block;margin-bottom:6px;font-weight:700;color:#1a2744;font-size:12px;' +
      'text-transform:uppercase;letter-spacing:.6px">Document PDF</label>' +
      '<input id="pdf-file" type="file" accept="application/pdf,.pdf" ' +
      'style="width:100%;padding:9px;border:1.5px solid #e4e8f0;border-radius:8px;font-family:inherit;font-size:13px">' +
      '<div id="pdf-info" style="margin-top:7px;font-size:12px;color:#8a92a6"></div></div>' +

      '<div><label style="display:block;margin-bottom:6px;font-weight:700;color:#1a2744;font-size:12px;' +
      'text-transform:uppercase;letter-spacing:.6px">Nombre de sessions</label>' +
      '<input id="pdf-n" type="number" min="1" max="15" value="4" ' +
      'style="width:90px;padding:9px 12px;border:1.5px solid #e4e8f0;border-radius:8px;font-family:inherit;font-size:14px">' +
      '<span style="font-size:12px;color:#8a92a6;margin-left:10px">S\u2019aplicaran a les sessions existents</span></div>' +

      '<div><label style="display:block;margin-bottom:6px;font-weight:700;color:#1a2744;font-size:12px;' +
      'text-transform:uppercase;letter-spacing:.6px">Instruccions (opcional)</label>' +
      '<textarea id="pdf-instr" rows="4" placeholder="Ex: centra\u2019t en els capítols 2 i 3; adapta-ho a 2n d\u2019ESO; ' +
      'que cada sessió incloga una audició; ignora la bibliografia..." ' +
      'style="width:100%;padding:10px 12px;border:1.5px solid #e4e8f0;border-radius:8px;font-family:inherit;' +
      'font-size:14px;box-sizing:border-box;resize:vertical;line-height:1.6"></textarea></div>' +

      '<div id="pdf-msg" style="display:none;padding:11px 13px;border-radius:8px;font-size:13px;line-height:1.55"></div>' +

      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<button id="pdf-go" type="button" style="padding:11px 20px;border:none;border-radius:8px;' +
      'background:linear-gradient(135deg,#c8960c,#f0b429);color:#1a2744;font-weight:700;font-family:inherit;' +
      'cursor:pointer;font-size:14px">\u2728 Generar sessions</button></div>' +

      '<div style="font-size:11.5px;color:#8a92a6;line-height:1.6;border-top:1px solid #e4e8f0;padding-top:11px">' +
      'La IA llegirà el PDF i omplirà el <b>títol</b>, els <b>objectius operatius</b> i les <b>notes del professor</b> ' +
      'de cada sessió. Després podràs revisar-ho i prémer <b>\u2728 Generar</b> a cada sessió (o \u201cGenerar totes\u201d) ' +
      'per crear el contingut de l\u2019alumnat.</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var fileInp = box.querySelector('#pdf-file');
    var infoEl = box.querySelector('#pdf-info');
    var msgEl = box.querySelector('#pdf-msg');
    var btnGo = box.querySelector('#pdf-go');

    function msg(t, tipus) {
      msgEl.innerHTML = t;
      msgEl.style.display = t ? 'block' : 'none';
      var cols = { err: ['#fef2f2', '#991b1b'], ok: ['#dcfce7', '#166534'], info: ['#f0f9ff', '#0c4a6e'] };
      var c2 = cols[tipus || 'info'];
      msgEl.style.background = c2[0]; msgEl.style.color = c2[1];
    }
    function close() { overlay.remove(); }
    box.querySelector('#pdf-close').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };

    fileInp.onchange = async function () {
      var f = fileInp.files[0];
      if (!f) { infoEl.textContent = ''; return; }
      var mb = f.size / 1048576;
      infoEl.textContent = 'Llegint\u2026';
      var pags = await contaPagines(f);
      infoEl.innerHTML = '<b>' + f.name + '</b> \u00b7 ' + mb.toFixed(1) + ' MB' +
        (pags ? ' \u00b7 ~' + pags + ' pàgines' : '');
      if (mb > PDF_MAX_MB) {
        msg('\u26A0\uFE0F El fitxer és molt gran (' + mb.toFixed(1) + ' MB). El màxim és ' + PDF_MAX_MB +
          ' MB. Prova de comprimir-lo o divideix-lo.', 'err');
      } else if (pags > PDF_MAX_PAGINES) {
        msg('\u2139\uFE0F El document té ~' + pags + ' pàgines. Funcionarà, però si vols centrar-te en una part ' +
          'concreta indica-ho a les instruccions (p. ex. \u201cnomés les pàgines 10-40\u201d).', 'info');
      } else { msg(''); }
    };

    btnGo.onclick = async function () {
      var f = fileInp.files[0];
      if (!f) { msg('Tria primer un fitxer PDF.', 'err'); return; }
      if (f.size / 1048576 > PDF_MAX_MB) { msg('El fitxer és massa gran.', 'err'); return; }

      var n = parseInt(box.querySelector('#pdf-n').value, 10) || 4;
      var instr = box.querySelector('#pdf-instr').value.trim();
      var cards = document.querySelectorAll('.session-card').length;
      if (cards < n) {
        if (!confirm('Has demanat ' + n + ' sessions però només n\u2019hi ha ' + cards + ' creades.\n\n' +
          'Es generaran ' + n + ' i s\u2019aplicaran les ' + cards + ' primeres.\n' +
          'Pots afegir-ne més amb \u201c+ Afegir sessió\u201d i tornar-ho a fer.\n\nContinuar?')) return;
      }

      btnGo.disabled = true;
      var txtOrig = btnGo.textContent;
      btnGo.textContent = '\u23F3 Llegint el PDF\u2026';
      msg('', '');

      try {
        var b64 = await fitxerABase64(f);
        btnGo.textContent = '\u23F3 La IA està analitzant el document\u2026';

        var titolInp = document.querySelector('input[type=text]');
        var titolUnitat = titolInp ? titolInp.value : '';

        var prompt =
          'Ets un docent expert en did\u00e0ctica de l\u2019ESO a la Comunitat Valenciana, treballant amb el ' +
          'Decret 107/2022 (LOMLOE).\n\n' +
          'Analitza el document adjunt i dissenya una seq\u00fcència de ' + n + ' SESSIONS de classe.\n' +
          (titolUnitat ? 'Unitat did\u00e0ctica: "' + titolUnitat + '".\n' : '') +
          (instr ? '\nINSTRUCCIONS ESPEC\u00cdFIQUES DEL DOCENT (prioritàries):\n' + instr + '\n' : '') +
          '\nPer a cada sessió indica:\n' +
          '- "titol": nom breu i clar de la sessió (màxim 8 paraules)\n' +
          '- "objectius": 2-3 objectius operatius amb verbs observables (identificar, comparar, interpretar, ' +
          'crear, valorar\u2026), un per l\u00ednia\n' +
          '- "notes": notes del professorat de 120-200 paraules explicant els continguts concrets del document ' +
          'que es treballaran en aquesta sessió, els conceptes clau i com abordar-los. Ha de ser prou detallat ' +
          'perquè després es puga generar el text per a l\u2019alumnat a partir d\u2019aquestes notes.\n\n' +
          'Reparteix el contingut del document de manera progressiva i equilibrada entre les sessions. ' +
          'Escriu-ho TOT EN VALENCI\u00c0.\n\n' +
          'Respon NOM\u00c9S amb aquest JSON, sense cap text abans ni despr\u00e9s, sense Markdown:\n' +
          '{"sessions":[{"titol":"\u2026","objectius":"\u2026","notes":"\u2026"}]}';

        var resp = await callAIambPDF(b64, prompt, 8000);

        var dades = (typeof window.udRepairJSON === 'function') ? window.udRepairJSON(resp) : null;
        if (!dades) {
          var t = resp.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
          var a = t.indexOf('{'), b = t.lastIndexOf('}');
          if (a !== -1 && b > a) t = t.substring(a, b + 1);
          dades = JSON.parse(t);
        }
        if (!dades || !Array.isArray(dades.sessions) || !dades.sessions.length) {
          throw new Error('La IA no ha retornat cap sessió v\u00e0lida');
        }

        btnGo.textContent = '\u23F3 Aplicant\u2026';
        var apl = aplicaSessions(dades.sessions);

        msg('\u2705 <b>' + apl + ' sessions omplides</b> amb el t\u00edtol, els objectius i les notes del professor.<br>' +
          'Revisa-les i prem <b>\u2728 Generar</b> a cada sessió per crear el contingut de l\u2019alumnat.', 'ok');
        toast('\u2713 ' + apl + ' sessions generades des del PDF');
        setTimeout(close, 4000);

      } catch (e) {
        msg('\u274C ' + e.message + '<br><span style="font-size:12px">Si el document \u00e9s molt llarg, ' +
          'prova d\u2019indicar a les instruccions quines pàgines interessen.</span>', 'err');
      } finally {
        btnGo.disabled = false;
        btnGo.textContent = txtOrig;
      }
    };
  }

  function afigBotoPDF() {
    if (document.getElementById('ud-pdf-sess-btn')) return;
    // El botó "+ Afegir sessió" marca la capçalera de la pestanya de sessions
    var ref = null;
    document.querySelectorAll('button').forEach(function (b) {
      if (b.textContent.indexOf('Afegir sessi') !== -1) ref = b;
    });
    if (!ref || !ref.parentElement) return;

    var btn = document.createElement('button');
    btn.id = 'ud-pdf-sess-btn';
    btn.type = 'button';
    btn.className = 'btn btn-outline';
    btn.textContent = '\uD83D\uDCC4 Des d\u2019un PDF';
    btn.title = 'Generar les sessions a partir d\u2019un document PDF';
    btn.onclick = obreModalPDF;
    ref.parentElement.insertBefore(btn, ref);
  }

  // ══════════════════════════════════════════════════════════════════
  // Plantilla: Do Major, 2/4
  var SCORE_TEMPLATE = 'C4/q D4/q | E4/q F4/q | G4/h | C5/h';

  function loadAbcjs(cb) {
    if (window.ABCJS) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.0/dist/abcjs-basic-min.js';
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error('Error carregant abcjs')); };
    document.head.appendChild(s);
  }

  var NOTE_SEMI = { 'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11 };
  function noteToMidi(name, octave) {
    var base = NOTE_SEMI[name[0]] || 0;
    var acc = name.length>1 ? (name[1]==='#'?1:-1) : 0;
    return (octave+1)*12 + base + acc;
  }
  function midiToFreq(midi) { return 440*Math.pow(2,(midi-69)/12); }

  var DUR_BEATS = {'w':4,'h':2,'q':1,'8':0.5,'16':0.25,'w.':6,'h.':3,'q.':1.5,'8.':0.75,'16.':0.375};
  var DUR_ABC   = {'w':'16','h':'8','q':'4','8':'2','16':'1','w.':'24','h.':'12','q.':'6','8.':'3','16.':'3/2'};

  function parseScoreInput(input) {
    var bars = input.split('|').map(function(b){return b.trim();}).filter(Boolean);
    var notes = [], barEnds = [];
    bars.forEach(function(bar) {
      var re = /([A-G][#b]?)(\d)\/(w\.|h\.|q\.|8\.|16\.|w|h|q|8|16)|[Rr]\/(w\.|h\.|q\.|8\.|16\.|w|h|q|8|16)/g;
      var m;
      while ((m=re.exec(bar))!==null) {
        if (/^[Rr]/.test(m[0])) {
          notes.push({rest:true, dur:m[0].split('/')[1]});
        } else {
          notes.push({name:m[1], octave:parseInt(m[2],10), dur:m[3], midi:noteToMidi(m[1],parseInt(m[2],10))});
        }
      }
      barEnds.push(notes.length);
    });
    return {notes:notes, barEnds:barEnds};
  }

  function noteToAbcName(name, octave) {
    var acc = name.length>1?(name[1]==='#'?'^':'_'):'';
    var L = name[0];
    if (octave<=2) return acc+L.toUpperCase()+new Array(Math.max(0,3-octave)+1).join(',');
    if (octave===3) return acc+L.toUpperCase();
    if (octave===4) return acc+L.toLowerCase();
    return acc+L.toLowerCase()+new Array(octave-4+1).join("'");
  }

  function buildAbcString(parsed, ts) {
    ts = ts||'2/4';
    var s='';
    parsed.notes.forEach(function(note,i) {
      var d = DUR_ABC[note.dur]||'4';
      s += (note.rest?'z':noteToAbcName(note.name,note.octave)) + d + ' ';
      if (parsed.barEnds.indexOf(i+1)!==-1 && i<parsed.notes.length-1) s += '| ';
    });
    return 'X:1\nT:\nM:'+ts+'\nL:1/16\nQ:1/4=80\nK:C\n'+s+'|';
  }

  // Web Audio synth
  var _scoreACtx = null, _scoreOscs = [];
  function getScoreCtx() {
    if (!_scoreACtx) _scoreACtx = new (window.AudioContext||window.webkitAudioContext)();
    return _scoreACtx;
  }
  function stopScorePlayback() {
    _scoreOscs.forEach(function(o){try{o.stop();}catch(e){}});
    _scoreOscs=[];
  }
  function playScoreNotes(parsed, bpm, onEnd) {
    stopScorePlayback();
    var ctx=getScoreCtx();
    if (ctx.state==='suspended') ctx.resume();
    var mg=ctx.createGain(); mg.gain.value=0.65; mg.connect(ctx.destination);
    var spb=60/(bpm||80), t=ctx.currentTime+0.1, total=0;
    parsed.notes.forEach(function(note) {
      var dur=(DUR_BEATS[note.dur]||1)*spb;
      if (!note.rest) {
        var osc=ctx.createOscillator(), ng=ctx.createGain();
        osc.connect(ng); ng.connect(mg);
        osc.type='triangle';
        osc.frequency.value=midiToFreq(note.midi);
        ng.gain.setValueAtTime(0,t);
        ng.gain.linearRampToValueAtTime(0.5,t+0.015);
        ng.gain.exponentialRampToValueAtTime(0.001,t+Math.max(dur*0.9,0.06));
        osc.start(t); osc.stop(t+dur+0.06);
        _scoreOscs.push(osc);
      }
      t+=dur; total+=dur;
    });
    setTimeout(function(){if(onEnd)onEnd();}, (total+0.5)*1000);
  }

  // ── TOOLBAR FLOTANT (fora del contenteditable) ───────────────────
  var _floatBar = null, _floatWrap = null;

  function ensureFloatBar() {
    if (_floatBar) return;
    _floatBar = document.createElement('div');
    _floatBar.id = 'ud-sc-floatbar';
    _floatBar.style.cssText =
      'position:fixed;z-index:99999;display:none;flex-direction:row;gap:3px;' +
      'background:rgba(26,39,68,0.96);border-radius:8px;padding:5px 6px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,0.45);pointer-events:auto;user-select:none;';

    var CBTN = 'border:none;border-radius:5px;padding:5px 10px;cursor:pointer;font-size:13px;' +
      'font-weight:700;font-family:inherit;line-height:1.2;color:white;background:rgba(255,255,255,0.22);';
    var CDEL = 'border:none;border-radius:5px;padding:5px 10px;cursor:pointer;font-size:13px;' +
      'font-weight:700;font-family:inherit;line-height:1.2;color:white;background:rgba(193,39,45,0.9);';

    [{a:'up',l:'↑',t:'Amunt'},{a:'down',l:'↓',t:'Avall'},
     {a:'smaller',l:'−',t:'Reduir'},{a:'bigger',l:'+',t:'Ampliar'},
     {a:'left',l:'←',t:'Esquerra'},{a:'center',l:'↕',t:'Centrar'},
     {a:'right',l:'→',t:'Dreta'},{a:'del',l:'🗑',t:'Esborrar',del:true}
    ].forEach(function(d) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = d.l; b.title = d.t;
      b.setAttribute('data-sc-action', d.a);
      b.style.cssText = d.del ? CDEL : CBTN;
      _floatBar.appendChild(b);
    });

    // Usar CLICK (no mousedown) — molt mes fiable per a botons fixos sobre contenteditable
    _floatBar.addEventListener('click', function(ev) {
      ev.preventDefault(); ev.stopPropagation();
      var btn = ev.target.closest('[data-sc-action]');
      if (btn && _floatWrap) handleScoreAction(btn.getAttribute('data-sc-action'), _floatWrap);
    });

    // Amagar en clicar fora (no en mouseleave)
    document.addEventListener('click', function(ev) {
      if (!_floatBar || _floatBar.style.display === 'none') return;
      var onBar  = ev.target.closest('#ud-sc-floatbar');
      var onWrap = ev.target.closest('.ud-score-wrap');
      if (!onBar && !onWrap) hideFloatBar();
    }, true);

    document.body.appendChild(_floatBar);
  }

  function showFloatBar(wrap) {
    ensureFloatBar();
    _floatWrap = wrap;
    var r = wrap.getBoundingClientRect();
    _floatBar.style.display = 'flex';
    _floatBar.style.top  = (r.top  + 6) + 'px';
    _floatBar.style.left = (r.left + 6) + 'px';
  }

  function hideFloatBar() {
    if (_floatBar) _floatBar.style.display = 'none';
    _floatWrap = null;
  }

  function handleScoreAction(action, wrap) {
    var clone = wrap.querySelector('svg');
    var curSz = clone ? (parseFloat(clone.getAttribute('width')||'80')||80) : 80;
    function syncEd() {
      var ed=wrap.parentElement;
      while(ed && !ed.classList.contains('ud-editor')) ed=ed.parentElement;
      if(ed) ed.dispatchEvent(new Event('input',{bubbles:true}));
    }
    if (action==='del') {
      hideFloatBar();
      if (confirm('Esborrar aquesta partitura?')) { wrap.remove(); setTimeout(syncEd,50); }
      return;
    }
    if (!clone) return;
    if (action==='smaller') {
      var ns=Math.max(15,curSz-10)+'%';
      clone.setAttribute('width',ns); clone.style.maxWidth=ns;
      if (clone.style.float&&clone.style.float!=='none') clone.style.width=ns;
    }
    if (action==='bigger') {
      var nb=Math.min(100,curSz+10)+'%';
      clone.setAttribute('width',nb); clone.style.maxWidth=nb;
      if (clone.style.float&&clone.style.float!=='none') clone.style.width=nb;
    }
    if (action==='left') {
      wrap.style.cssText='margin:8px 0;position:relative;display:block;min-height:10px;clear:both;';
      clone.style.cssText='width:'+curSz+'%;max-width:'+curSz+'%;float:left;margin:0 18px 8px 0;border-radius:4px;';
      clone.setAttribute('width',curSz+'%');
    }
    if (action==='right') {
      wrap.style.cssText='margin:8px 0;position:relative;display:block;min-height:10px;clear:both;';
      clone.style.cssText='width:'+curSz+'%;max-width:'+curSz+'%;float:right;margin:0 0 8px 18px;border-radius:4px;';
      clone.setAttribute('width',curSz+'%');
    }
    if (action==='center') {
      wrap.style.cssText='text-align:center;clear:both;margin:14px 0;position:relative;display:block;';
      clone.style.cssText='max-width:'+curSz+'%;width:'+curSz+'%;display:inline-block;float:none;border-radius:4px;';
      clone.setAttribute('width',curSz+'%');
    }
    if (action==='up') {
      var prev=wrap.previousElementSibling;
      while(prev&&!prev.textContent.trim()) prev=prev.previousElementSibling;
      if(prev&&wrap.parentElement) wrap.parentElement.insertBefore(wrap,prev);
    }
    if (action==='down') {
      var next=wrap.nextElementSibling;
      while(next&&!next.textContent.trim()) next=next.nextElementSibling;
      if(next&&next.nextSibling&&wrap.parentElement) { wrap.parentElement.insertBefore(wrap,next.nextSibling); }
      else if(next&&wrap.parentElement) { wrap.parentElement.appendChild(wrap); }
    }
    // Reposiciona la toolbar
    setTimeout(function(){ if(_floatWrap===wrap) showFloatBar(wrap); syncEd(); }, 60);
  }

  function attachScoreEvents(wrap) {
    if (wrap._scoreEventsAdded) return;
    wrap._scoreEventsAdded = true;
    // Mostrar toolbar en hover i en click; s'amaga en clicar fora (ges a ensureFloatBar)
    wrap.addEventListener('mouseenter', function(){ showFloatBar(wrap); });
    wrap.addEventListener('click', function(ev){ ev.stopPropagation(); showFloatBar(wrap); });
  }

  // ── Modal editor de partitura ─────────────────────────────────────
  function openScoreModal(editor) {
    var overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(26,39,68,0.6);z-index:9999;' +
      'display:flex;align-items:center;justify-content:center;font-family:inherit;' +
      'padding:16px;box-sizing:border-box;overflow-y:auto';
    var box = document.createElement('div');
    box.style.cssText =
      'background:white;border-radius:16px;padding:24px;width:100%;max-width:820px;' +
      'box-shadow:0 24px 64px rgba(0,0,0,0.3);display:flex;flex-direction:column;gap:14px';
    box.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;color:#1e293b;font-size:20px;font-weight:700">\uD83C\uDFBC Editor de partitura</h3>' +
      '<button id="sc-close" type="button" style="padding:8px 14px;border:none;border-radius:8px;background:#1e293b;color:white;font-weight:600;font-family:inherit;cursor:pointer">\u2715 Tancar</button>' +
      '</div>' +
      '<details style="background:#f8fafc;border-radius:10px;padding:12px;border:1px solid #e2e8f0">' +
      '<summary style="cursor:pointer;font-weight:600;color:#1e293b;font-size:13px">\uD83D\uDCDA Guia rapida de format</summary>' +
      '<div style="margin-top:10px;font-size:12px;color:#334155;line-height:2">' +
      '<b>Format:</b> NOTA+OCTAVA/DURADA &nbsp; ex: <code style="background:#e2e8f0;padding:1px 6px;border-radius:4px">C4/q D4/q</code><br>' +
      '<b>Notes:</b> C=Do D=Re E=Mi F=Fa G=Sol A=La B=Si<br>' +
      '<b>Octaves:</b> 3=greu &middot; 4=central &middot; 5=aguda<br>' +
      '<b>Alteracions:</b> C#4=Do# &middot; Bb4=Sib &middot; Eb4=Mib<br>' +
      '<b>Durades:</b> w=rodona h=blanca q=negra 8=corxera 16=semicorxera (+ punt: q. h. 8.)<br>' +
      '<b>Silenci:</b> R/q R/h R/w etc. &nbsp;&nbsp; <b>Compas:</b> separa amb <code style="background:#e2e8f0;padding:1px 6px;border-radius:4px">|</code>' +
      '</div></details>' +
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
      '<label style="font-weight:600;color:#1e293b;font-size:13px">Compas:</label>' +
      '<select id="sc-ts" style="padding:7px 10px;border:1.5px solid #c8d0e8;border-radius:8px;font-family:inherit;font-size:13px">' +
      '<option value="2/4" selected>2/4</option><option value="3/4">3/4</option>' +
      '<option value="4/4">4/4</option><option value="6/8">6/8</option></select>' +
      '<label style="font-weight:600;color:#1e293b;font-size:13px;margin-left:8px">Tempo:</label>' +
      '<input id="sc-bpm" type="number" value="80" min="40" max="200" ' +
      'style="width:72px;padding:7px 10px;border:1.5px solid #c8d0e8;border-radius:8px;font-family:inherit;font-size:13px"> BPM' +
      '</div>' +
      '<div><label style="display:block;margin-bottom:6px;font-weight:600;color:#1e293b;font-size:13px">Sequencia de notes:</label>' +
      '<textarea id="sc-input" rows="3" spellcheck="false" ' +
      'style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;' +
      'font-size:14px;font-family:monospace;box-sizing:border-box;resize:vertical;line-height:1.7">' +
      SCORE_TEMPLATE + '</textarea></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="sc-render" type="button" style="padding:9px 16px;border:none;border-radius:8px;background:#0891b2;color:white;font-weight:600;font-family:inherit;cursor:pointer">\uD83C\uDFBC Renderitzar</button>' +
      '<button id="sc-play"   type="button" style="padding:9px 16px;border:1.5px solid #10b981;border-radius:8px;background:white;color:#10b981;font-weight:600;font-family:inherit;cursor:pointer">\u25B6 Reproduir</button>' +
      '<button id="sc-stop"   type="button" style="padding:9px 16px;border:1.5px solid #ef4444;border-radius:8px;background:white;color:#ef4444;font-weight:600;font-family:inherit;cursor:pointer;display:none">\u23F9 Aturar</button>' +
      '</div>' +
      '<div id="sc-area" style="min-height:160px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:12px;overflow-x:auto">' +
      '<p style="color:#94a3b8;text-align:center;margin:50px 0;font-size:14px">Clica \"Renderitzar\" per veure la partitura</p>' +
      '</div>' +
      '<div id="sc-err" style="display:none;padding:10px;background:#fef2f2;border-radius:8px;color:#c1272d;font-size:13px"></div>' +
      '<div style="display:flex;justify-content:flex-end">' +
      '<button id="sc-insert" type="button" ' +
      'style="padding:9px 18px;border:none;border-radius:8px;background:#1e293b;color:white;font-weight:600;font-family:inherit;cursor:pointer;display:none">' +
      '\u2705 Inserir partitura a la sessio</button></div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var parsedScore = null;
    var btnPlay   = box.querySelector('#sc-play');
    var btnStop   = box.querySelector('#sc-stop');
    var btnInsert = box.querySelector('#sc-insert');
    var errEl     = box.querySelector('#sc-err');
    var area      = box.querySelector('#sc-area');

    function showErr(msg){ errEl.textContent=msg; errEl.style.display=msg?'block':'none'; }
    function closeModal(){ stopScorePlayback(); overlay.remove(); }

    box.querySelector('#sc-close').onclick = closeModal;
    overlay.onclick = function(e){ if(e.target===overlay) closeModal(); };

    box.querySelector('#sc-render').onclick = function() {
      showErr('');
      loadAbcjs(function(err) {
        if (err) { showErr('No s\'ha pogut carregar la llibreria.'); return; }
        var input = box.querySelector('#sc-input').value.trim();
        if (!input) { showErr('Escriu algunes notes primer.'); return; }
        try {
          parsedScore = parseScoreInput(input);
          if (!parsedScore.notes.length) { showErr('No s\'han reconegut notes. Ex: C4/q D4/q | E4/q F4/q'); return; }
          var ts = box.querySelector('#sc-ts').value;
          var abc = buildAbcString(parsedScore, ts);
          window.ABCJS.renderAbc(area, abc, {
            scale:1.5, staffwidth:Math.min((area.clientWidth||700)-30,720), add_classes:true
          });
          btnInsert.style.display='';
        } catch(e){ showErr('Error: '+e.message); }
      });
    };

    btnPlay.onclick = function() {
      if (!parsedScore||!parsedScore.notes.length){ showErr('Renderitza primer.'); return; }
      btnPlay.style.display='none'; btnStop.style.display='';
      var bpm = parseInt(box.querySelector('#sc-bpm').value,10)||80;
      playScoreNotes(parsedScore, bpm, function(){ btnPlay.style.display=''; btnStop.style.display='none'; });
    };
    btnStop.onclick = function(){ stopScorePlayback(); btnPlay.style.display=''; btnStop.style.display='none'; };

    btnInsert.onclick = function() {
      var svgEl = area.querySelector('svg');
      if (!svgEl){ showErr('Renderitza primer.'); return; }

      // Wrap simple sense controls interns (la toolbar es flotant)
      var wrap = document.createElement('div');
      wrap.className = 'ud-score-wrap';
      wrap.setAttribute('contenteditable','false');
      wrap.setAttribute('data-ud-score','1');
      wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';

      var clone = svgEl.cloneNode(true);
      clone.setAttribute('width','80%');
      clone.removeAttribute('height');
      clone.style.cssText = 'max-width:80%;display:inline-block;border-radius:4px;vertical-align:top;cursor:pointer;';

      // Etiqueta d'ajuda visible fins primer hover
      var hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:#94a3b8;text-align:center;margin-top:4px;font-style:italic;';
      hint.textContent = 'Passa el ratolí per sobre per veure els controls';

      wrap.appendChild(clone);
      wrap.appendChild(hint);
      attachScoreEvents(wrap);

      // Eliminar etiqueta al primer hover
      wrap.addEventListener('mouseenter', function(){ if(hint.parentElement) hint.remove(); }, {once:true});

      insertElementInEditor(editor, wrap);
      closeModal();
      toast('\u2713 Partitura inserida');
    };
  }

  function makeScoreButton(toolbar) {
    if (toolbar._scoreBtnAdded) return;
    var editor = toolbar.nextElementSibling;
    if (!editor||!editor.classList.contains('ud-editor')) return;
    toolbar._scoreBtnAdded = true;
    var btn = document.createElement('button');
    btn.type='button'; btn.textContent='\uD83C\uDFBC Partitura';
    btn.title='Inserir un fragment de partitura (amb so)';
    btn.onclick = function(){ openScoreModal(editor); };
    toolbar.appendChild(btn);
  }

  // 4. ELIMINAR BOTÓ "EXPORTAR A CANVA"
  // ══════════════════════════════════════════════════════════════════

  function hideCanvaButton() {
    var btn = document.getElementById('ud-canva-btn');
    if (btn) { btn.style.display = 'none'; btn.style.visibility = 'hidden'; }
  }

  // ══════════════════════════════════════════════════════════════════
  // EVENT DELEGATION GLOBAL (botons d'esborrar)
  // ══════════════════════════════════════════════════════════════════

  // ── Amaga la marca d'aigua de Replit ─────────────────────────────
  function hideReplitBadge() {
    // CSS agressiu per a qualsevol element de Replit
    var style = document.createElement('style');
    style.textContent =
      '[class*="replit"],[id*="replit"],a[href*="replit.com"],' +
      '[data-testid*="replit"]{display:none!important;visibility:hidden!important;}';
    document.head.appendChild(style);

    // Cerca per contingut de text (per si no te classe identificable)
    function findAndHide() {
      document.querySelectorAll('div,a,span,footer,aside,section').forEach(function(el) {
        try {
          if (el.offsetParent !== null &&
              (el.textContent.trim() === 'Made with Replit' ||
               el.innerHTML.indexOf('replit') !== -1)) {
            // Busca el contenidor fix mes proper
            var target = el;
            for (var i = 0; i < 5; i++) {
              if (!target.parentElement || target.parentElement === document.body) break;
              var cs = window.getComputedStyle(target.parentElement);
              if (cs.position === 'fixed' || cs.position === 'absolute') { target = target.parentElement; break; }
              target = target.parentElement;
            }
            target.style.setProperty('display', 'none', 'important');
          }
        } catch(e) {}
      });
    }

    findAndHide();
    setTimeout(findAndHide, 500);
    setTimeout(findAndHide, 2000);
    setTimeout(findAndHide, 5000);

    var obs = new MutationObserver(function() { setTimeout(findAndHide, 100); });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function setupGlobalClickHandler() {
    // useCapture:true garanteix que capturem els events de mousedown antes que el contenteditable
    // NOTA: els botons [data-sc-action] de la toolbar flotant es gestionen amb click,
    //       NO aqui, perque preventDefault en mousedown bloquejaria el click posterior.
    document.addEventListener('mousedown', function (e) {

      // Esborrar adaptacio DUA
      var adaptedDel = e.target.closest('.ud-adapted-del');
      if (adaptedDel) {
        e.preventDefault(); e.stopPropagation();
        var wrapA = adaptedDel.closest('.ud-adapted-block');
        if (wrapA && confirm('Esborrar aquesta adaptacio?')) {
          var edA = wrapA.closest('.ud-editor');
          wrapA.remove();
          if (edA) edA.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      // Esborrar audio
      var audioDel = e.target.closest('.ud-audio-del');
      if (audioDel) {
        e.preventDefault(); e.stopPropagation();
        var wrapAu = audioDel.closest('.ud-audio-wrap');
        if (wrapAu && confirm('Esborrar aquest audio?')) {
          var edAu = wrapAu.closest('.ud-editor');
          wrapAu.remove();
          if (edAu) edAu.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

    }, true);
  }
  // ══════════════════════════════════════════════════════════════════
  // INICIALITZACIÓ I OBSERVACIÓ DEL DOM
  // ══════════════════════════════════════════════════════════════════

  function processNewElements() {
    document.querySelectorAll('.ud-toolbar').forEach(makeAudioButton);
    document.querySelectorAll('.ud-toolbar').forEach(makeScoreButton);
    document.querySelectorAll('.ud-toolbar').forEach(addExtraToolbarButtons);
    document.querySelectorAll('.session-card').forEach(addAdaptButtons);
    document.querySelectorAll('.ud-score-wrap').forEach(attachScoreEvents);
    document.querySelectorAll('.ud-editor').forEach(addDragDropSupport);
    cleanupSavedPlayers();
    afigBotoPDF();
    organizeHeader();
    addBackupButton();
    hideCanvaButton();
  }

  function init() {
    injectEditorCSS();
    bkWatchChanges();
    hideReplitBadge();
    setupInlineVideoPlayback();
    setupGlobalClickHandler();
    processNewElements();

    var pending = false;
    var observer = new MutationObserver(function (mutations) {
      if (pending) return;
      var needs = false;
      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if ((n.classList && (
            n.classList.contains('ud-toolbar') ||
            n.classList.contains('session-card') ||
            n.classList.contains('ud-score-wrap')
          )) || (n.querySelector && n.querySelector('.ud-toolbar,.session-card,.ud-score-wrap'))) {
            needs = true; break;
          }
        }
        if (needs) break;
      }
      if (needs) {
        pending = true;
        setTimeout(function () { processNewElements(); pending = false; }, 150);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Xarxa de seguretat: cada 2s revisem que totes les partitures tinguen events.
    // Això garanteix el correcte funcionament després de canvis de sessió, recàrregues
    // de l'estat de React, etc., on el MutationObserver podria no haver actuat.
    setInterval(function() {
      document.querySelectorAll('.ud-score-wrap').forEach(attachScoreEvents);
    }, 2000);

    console.log('[enhancements.js v18] Àudio · DUA · Partitura · Elimina Canva');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
