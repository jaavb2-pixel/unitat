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
      addItem('\uD83D\uDCD5 PDF Professor', proxy('ud-pdf-prof-btn'));
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

    // Amaguem els botons individuals que ara viuen dins del menú
    ['ud-html-btn','ud-pdf-prof-btn','ud-export-btn','ud-import-btn'].forEach(function(id) {
      var b = document.getElementById(id);
      if (b && b.style.display !== 'none') b.style.display = 'none';
    });
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
    organizeHeader();
    hideCanvaButton();
  }

  function init() {
    injectEditorCSS();
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

    console.log('[enhancements.js v14] Àudio · DUA · Partitura · Elimina Canva');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
