// ===================================================================
// enhancements.js · v3
// Funcionalitats addicionals per a Unitats Didàctiques ESO CV
//
//  1. 🎵 Botó Àudio al toolbar (Spotify / SoundCloud / MP3)
//  2. 📉📈 Simplificar / Ampliar text per sessió (DUA)
//  3. 🎓 PPT Visual per a l'aula (substitueix l'antic "Exportar a Canva")
//  4. 🧠 Mapa Conceptual interactiu de la unitat
// ===================================================================

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════
  // UTILITATS GENERALS
  // ══════════════════════════════════════════════════════════════════

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
      try { const e = await r.json(); if (e && e.error) errMsg = e.error; } catch (_) {}
      throw new Error(errMsg);
    }
    const d = await r.json();
    return (d && d.text) || '';
  }

  function htmlToPlainText(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    div.querySelectorAll('.ud-adapted-block,[data-ud-adapted],[data-ud-img],[data-ud-vid],[data-ud-audio]').forEach(function(el){ el.remove(); });
    return div.innerText.replace(/\s+/g,' ').trim();
  }

  function loadPptxGen(cb) {
    if (window.PptxGenJS) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  // ══════════════════════════════════════════════════════════════════
  // 1. ÀUDIO
  // ══════════════════════════════════════════════════════════════════

  function parseSpotifyURL(url) {
    const m = url.match(/open\.spotify\.com\/(?:intl-\w+\/)?(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
    if (!m) return null;
    return { type: m[1], id: m[2], embedURL: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] };
  }

  function parseSoundCloudURL(url) {
    if (!/soundcloud\.com\/[^\/]+\/[^\/?]+/.test(url)) return null;
    return { embedURL: 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url) +
      '&color=%231a2744&auto_play=false&hide_related=false&show_comments=false&show_user=true' };
  }

  function isDirectAudioURL(url) {
    return /^https?:\/\/.+\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(url);
  }

  function makeAudioWrap(url, caption) {
    const sp = parseSpotifyURL(url);
    const sc = parseSoundCloudURL(url);
    const isFile = isDirectAudioURL(url);
    if (!sp && !sc && !isFile) return null;

    const wrap = document.createElement('div');
    wrap.className = 'ud-audio-wrap';
    wrap.setAttribute('contenteditable', 'false');
    wrap.setAttribute('data-ud-audio', '1');
    wrap.style.cssText = 'margin:14px 0;padding:12px;background:#f8f6ed;border:1px solid #e4e8f0;border-radius:10px;position:relative';

    let inner = '';
    if (sp) {
      const height = sp.type === 'track' || sp.type === 'episode' ? 152 : 352;
      inner = '<iframe src="' + sp.embedURL + '" width="100%" height="' + height +
        '" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="border-radius:8px;display:block"></iframe>';
    } else if (sc) {
      inner = '<iframe src="' + sc.embedURL + '" width="100%" height="166" frameborder="0" scrolling="no" allow="autoplay" style="border-radius:8px;display:block"></iframe>';
    } else if (isFile) {
      inner = '<audio controls src="' + url + '" style="width:100%;display:block"></audio>';
    }

    if (caption) {
      inner += '<div style="margin-top:8px;font-size:13px;color:#3a4a6f;font-style:italic;text-align:center">🎵 ' + caption.replace(/</g,'&lt;') + '</div>';
    }
    inner += '<button type="button" class="ud-audio-del" title="Esborrar àudio" style="position:absolute;top:6px;right:6px;background:rgba(193,39,45,0.9);color:white;border:none;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600">🗑</button>';
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
    setTimeout(function () { editor.dispatchEvent(new Event('input', { bubbles: true })); }, 50);
  }

  function openAudioModal(editor) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,39,68,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:inherit';
    const box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:12px;padding:24px;width:480px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3)';
    box.innerHTML =
      '<h3 style="margin:0 0 16px;color:#1a2744;font-size:18px;font-weight:700">🎵 Inserir àudio</h3>' +
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#1a2744;font-size:13px">URL de Spotify, SoundCloud o MP3 directa</label>' +
      '<input id="ud-audio-url" type="text" placeholder="https://open.spotify.com/track/... o https://soundcloud.com/..." style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;font-size:14px;font-family:inherit;margin-bottom:14px;box-sizing:border-box">' +
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#1a2744;font-size:13px">Títol (opcional)</label>' +
      '<input id="ud-audio-cap" type="text" placeholder="Ex: Simfonia núm. 5 de Beethoven" style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;font-size:14px;font-family:inherit;margin-bottom:18px;box-sizing:border-box">' +
      '<div style="display:flex;justify-content:flex-end;gap:8px">' +
      '<button id="ud-audio-cancel" type="button" style="padding:9px 16px;border:1px solid #c8d0e8;border-radius:8px;background:white;color:#1a2744;font-weight:600;font-family:inherit;cursor:pointer">Cancel·lar</button>' +
      '<button id="ud-audio-ok" type="button" style="padding:9px 16px;border:none;border-radius:8px;background:#1a2744;color:white;font-weight:600;font-family:inherit;cursor:pointer">Inserir</button>' +
      '</div>' +
      '<div style="margin-top:14px;padding:10px;background:#f0f4ff;border-radius:8px;font-size:12px;color:#3a4a6f;line-height:1.5">' +
      '💡 <strong>Suport:</strong> Spotify (cançons, àlbums, llistes), SoundCloud, MP3 directe.</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    const urlInput = box.querySelector('#ud-audio-url');
    setTimeout(function () { urlInput.focus(); }, 50);
    function close() { overlay.remove(); }
    box.querySelector('#ud-audio-cancel').onclick = close;
    overlay.onclick = function (e) { if (e.target === overlay) close(); };
    urlInput.onkeydown = function (e) { if (e.key === 'Enter') box.querySelector('#ud-audio-ok').click(); if (e.key === 'Escape') close(); };
    box.querySelector('#ud-audio-ok').onclick = function () {
      const url = urlInput.value.trim();
      const caption = box.querySelector('#ud-audio-cap').value.trim();
      if (!url) { toast('Has d\'introduir una URL', true); return; }
      const wrap = makeAudioWrap(url, caption);
      if (!wrap) { toast('URL no reconeguda. Usa Spotify, SoundCloud o un MP3 directe.', true); return; }
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

  // ══════════════════════════════════════════════════════════════════
  // 2. SIMPLIFICAR / AMPLIAR (DUA)
  // ══════════════════════════════════════════════════════════════════

  async function adaptText(card, editor, mode) {
    const btn = card.querySelector(mode === 'simple' ? '.ud-adapt-simple' : '.ud-adapt-amplify');
    if (!btn) return;
    const tmp = editor.cloneNode(true);
    tmp.querySelectorAll('[data-ud-img],[data-ud-vid],[data-ud-audio],.ud-img-controls,.ud-vid-controls,[data-ud-adapted]').forEach(function(el){ el.remove(); });
    const text = tmp.innerText.trim();
    if (!text || text.length < 50) { toast('Cal escriure primer el contingut per poder adaptar-lo.', true); return; }

    const sessionInputs = card.querySelectorAll('.session-header input[type=text]');
    const sessionName = (sessionInputs[0] || {}).value || '';
    const rs = (window._udGetAppState && window._udGetAppState()) || {};
    const titol = rs.titol || document.querySelector('input[type=text]')?.value || 'la unitat';

    const originalText = btn.textContent;
    btn.disabled = true; btn.style.opacity = '0.6'; btn.textContent = '⏳ Generant...';

    try {
      let prompt;
      if (mode === 'simple') {
        prompt = "Ets un docent expert en DUA i NEE.\n\nContext: Unitat \"" + titol + "\"" + (sessionName ? ", sessió \"" + sessionName + "\"" : "") + ".\n\nText original:\n---\n" + text + "\n---\n\nReescriu en VALENCIÀ simplificat per a alumnat amb dificultats (frases curtes ≤15 paraules, vocabulari quotidià, <b> per a conceptes clau, paràgrafs curts, frase resum inicial).\n\nSortida: NOMÉS HTML (<p> i <b>). Sense introduccions, sense Markdown, sense ```.";
      } else {
        prompt = "Ets un docent expert en atenció a l'alumnat avançat.\n\nContext: Unitat \"" + titol + "\"" + (sessionName ? ", sessió \"" + sessionName + "\"" : "") + ".\n\nText original:\n---\n" + text + "\n---\n\nReescriu en VALENCIÀ ampliant per a alumnat avançat (aprofundeix, vocabulari específic, connexions interdisciplinàries, to acadèmic ESO, <b> per a conceptes clau).\n\nSortida: NOMÉS HTML (<p> i <b>). Sense introduccions, sense Markdown, sense ```.";
      }
      let result = await callAI(prompt, 2000);
      result = result.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

      editor.querySelectorAll('[data-ud-adapted="' + mode + '"]').forEach(function(el){ el.remove(); });

      const isSimple = mode === 'simple';
      const bgColor = isSimple ? '#e0f2fe' : '#fef3c7';
      const borderColor = isSimple ? '#7dd3fc' : '#fde68a';
      const titleIcon = isSimple ? '📉' : '📈';
      const titleText = isSimple ? 'Versió simplificada (NEE / dificultats de lectura)' : 'Versió ampliada (alumnat avançat)';

      const wrap = document.createElement('div');
      wrap.className = 'ud-adapted-block';
      wrap.setAttribute('data-ud-adapted', mode);
      wrap.setAttribute('contenteditable', 'false');
      wrap.style.cssText = 'margin:18px 0 8px;padding:16px;background:' + bgColor + ';border:1.5px dashed ' + borderColor + ';border-radius:10px';
      wrap.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid ' + borderColor + '">' +
        '<strong style="color:#1a2744;font-size:13px">' + titleIcon + ' ' + titleText + '</strong>' +
        '<button type="button" class="ud-adapted-del" style="background:rgba(193,39,45,0.9);color:white;border:none;border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;font-family:inherit;font-weight:600">🗑 Esborrar</button>' +
        '</div><div class="ud-adapted-content" contenteditable="true">' + result + '</div>';

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
    const editor = card.querySelector('.ud-editor');
    if (!editor) return;
    card._adaptButtonsAdded = true;
    const container = document.createElement('div');
    container.className = 'ud-adapt-buttons';
    container.style.cssText = 'display:flex;gap:8px;margin:8px 0 4px;flex-wrap:wrap;align-items:center';
    container.innerHTML =
      '<span style="font-size:12px;color:#3a4a6f;font-weight:600;margin-right:4px">DUA · adaptar text:</span>' +
      '<button type="button" class="ud-adapt-simple" style="padding:6px 12px;border:1px solid #c8d0e8;border-radius:6px;background:#e0f2fe;color:#1a2744;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">📉 Simplificar (NEE)</button>' +
      '<button type="button" class="ud-adapt-amplify" style="padding:6px 12px;border:1px solid #c8d0e8;border-radius:6px;background:#fef3c7;color:#1a2744;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer">📈 Ampliar (avançat)</button>';
    const toolbar = editor.previousElementSibling;
    const beforeNode = (toolbar && toolbar.classList && toolbar.classList.contains('ud-toolbar')) ? toolbar : editor;
    beforeNode.parentNode.insertBefore(container, beforeNode);
    container.querySelector('.ud-adapt-simple').onclick = function () { adaptText(card, editor, 'simple'); };
    container.querySelector('.ud-adapt-amplify').onclick = function () { adaptText(card, editor, 'amplify'); };
  }

  // ══════════════════════════════════════════════════════════════════
  // 3. PPT VISUAL PER A L'AULA
  // ══════════════════════════════════════════════════════════════════

  // Colors de l'estil visual
  const PPT = {
    BG:      'FFFFFF',
    DARK:    '1e293b',
    TEAL:    '0891b2',
    PURPLE:  '7c3aed',
    ORANGE:  'f59e0b',
    LIGHT:   'f0f9ff',
    GRAY:    '64748b',
    WHITE:   'FFFFFF',
    SLIDE_W: 10,
    SLIDE_H: 5.625
  };

  function splitBullets(bullets, maxPerSlide) {
    maxPerSlide = maxPerSlide || 5;
    const result = [];
    for (let i = 0; i < bullets.length; i += maxPerSlide) {
      result.push(bullets.slice(i, i + maxPerSlide));
    }
    return result;
  }

  function addCover(pptx, data) {
    const slide = pptx.addSlide();
    // Fons gradient teal→purple simulat amb rectangles
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:PPT.SLIDE_H, fill:{ color: PPT.TEAL } });
    slide.addShape(pptx.ShapeType.rect, { x:4, y:0, w:6, h:PPT.SLIDE_H, fill:{ color: PPT.PURPLE, transparency:30 } });
    // Accent decoratiu
    slide.addShape(pptx.ShapeType.rect, { x:0, y:PPT.SLIDE_H-0.08, w:PPT.SLIDE_W, h:0.08, fill:{ color: PPT.ORANGE } });
    slide.addShape(pptx.ShapeType.ellipse, { x:-0.5, y:-0.5, w:3, h:3, fill:{ color:PPT.WHITE, transparency:90 } });
    slide.addShape(pptx.ShapeType.ellipse, { x:8, y:3.5, w:3, h:3, fill:{ color:PPT.ORANGE, transparency:80 } });
    // Textos
    slide.addText(data.assignatura || 'Música', { x:0.6, y:1.2, w:8.8, h:0.5, fontSize:16, color:PPT.WHITE, bold:false, transparency:20 });
    slide.addText(data.titol || 'Unitat Didàctica', { x:0.6, y:1.8, w:8.8, h:1.5, fontSize:36, color:PPT.WHITE, bold:true, breakLine:true, wrap:true });
    slide.addText(data.nivell || '', { x:0.6, y:3.5, w:5, h:0.5, fontSize:16, color:PPT.WHITE, transparency:20 });
    slide.addText('🎵', { x:8.5, y:1.0, w:1, h:1, fontSize:48 });
  }

  function addIndex(pptx, sessions) {
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:1.1, fill:{ color: PPT.TEAL } });
    slide.addShape(pptx.ShapeType.rect, { x:0, y:1.1, w:0.06, h:PPT.SLIDE_H-1.1, fill:{ color: PPT.TEAL } });
    slide.addText('Índex de sessions', { x:0.4, y:0.25, w:9.2, h:0.6, fontSize:24, color:PPT.WHITE, bold:true });
    const items = sessions.map(function(s, i) {
      return { text: (i+1) + '.  ' + (s.nom || 'Sessió ' + (i+1)), options:{ bullet:false, fontSize:16, color:PPT.DARK, paraSpaceAfter:6 } };
    });
    slide.addText(items, { x:0.4, y:1.3, w:9.2, h:PPT.SLIDE_H-1.5, valign:'top' });
  }

  function addObjectives(pptx, objectiusText) {
    if (!objectiusText || !objectiusText.trim()) return;
    const lines = objectiusText.split('\n').map(function(l){ return l.replace(/^[-*•]\s*/,'').trim(); }).filter(Boolean);
    if (!lines.length) return;
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:1.1, fill:{ color: PPT.PURPLE } });
    slide.addShape(pptx.ShapeType.rect, { x:0, y:1.1, w:0.06, h:PPT.SLIDE_H-1.1, fill:{ color: PPT.PURPLE } });
    slide.addText('🎯  Què aprendrem', { x:0.4, y:0.25, w:9.2, h:0.6, fontSize:24, color:PPT.WHITE, bold:true });
    const items = lines.map(function(l) {
      return { text: l, options:{ bullet:{ type:'bullet', indent:15 }, fontSize:15, color:PPT.DARK, paraSpaceAfter:8 } };
    });
    slide.addText(items, { x:0.4, y:1.3, w:9.2, h:PPT.SLIDE_H-1.5, valign:'top' });
  }

  function addSessionTitle(pptx, session) {
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:PPT.SLIDE_H, fill:{ color: PPT.LIGHT } });
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:0.08, fill:{ color: PPT.TEAL } });
    slide.addShape(pptx.ShapeType.rect, { x:0, y:PPT.SLIDE_H-0.08, w:PPT.SLIDE_W, h:0.08, fill:{ color: PPT.ORANGE } });
    slide.addShape(pptx.ShapeType.ellipse, { x:7.5, y:0.8, w:3, h:3, fill:{ color: PPT.TEAL, transparency:88 } });
    slide.addText('Sessió ' + session.idx, { x:0.6, y:1.3, w:7, h:0.6, fontSize:20, color:PPT.TEAL, bold:true });
    slide.addText(session.nom || ('Sessió ' + session.idx), { x:0.6, y:2.0, w:8, h:1.5, fontSize:30, color:PPT.DARK, bold:true, wrap:true });
  }

  function addContentSlides(pptx, session, bullets, slideNum) {
    const chunks = splitBullets(bullets, 5);
    chunks.forEach(function(chunk, ci) {
      const slide = pptx.addSlide();
      slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:1.1, fill:{ color: PPT.DARK } });
      slide.addShape(pptx.ShapeType.rect, { x:0, y:1.1, w:0.06, h:PPT.SLIDE_H-1.1, fill:{ color: PPT.TEAL } });
      const partLabel = chunks.length > 1 ? '  (' + (ci+1) + '/' + chunks.length + ')' : '';
      slide.addText((session.nom || 'Sessió') + partLabel, { x:0.4, y:0.25, w:9.2, h:0.6, fontSize:20, color:PPT.WHITE, bold:true });
      const items = chunk.map(function(b) {
        return { text: b.trim(), options:{ bullet:{ type:'bullet', indent:15 }, fontSize:15, color:PPT.DARK, paraSpaceAfter:10 } };
      });
      slide.addText(items, { x:0.3, y:1.25, w:9.4, h:PPT.SLIDE_H-1.5, valign:'top' });
      // Número de pàgina baix-dreta
      slide.addText(String(slideNum + ci), { x:9.2, y:5.3, w:0.6, h:0.25, fontSize:9, color:PPT.GRAY, align:'right' });
    });
    return chunks.length;
  }

  function addActivitiesSlide(pptx, session) {
    if (!session.exercicis || !session.exercicis.trim()) return 0;
    const lines = session.exercicis.split('\n').map(function(l){ return l.trim(); }).filter(Boolean).slice(0, 6);
    if (!lines.length) return 0;
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:1.1, fill:{ color: PPT.ORANGE } });
    slide.addShape(pptx.ShapeType.rect, { x:0, y:1.1, w:0.06, h:PPT.SLIDE_H-1.1, fill:{ color: PPT.ORANGE } });
    slide.addText('✏️  Activitats · Sessió ' + session.idx, { x:0.4, y:0.25, w:9.2, h:0.6, fontSize:20, color:PPT.WHITE, bold:true });
    const items = lines.map(function(l) {
      return { text: l.replace(/^\d+\.\s*/,'').replace(/^[-*•]\s*/,''), options:{ bullet:{ type:'bullet', indent:15 }, fontSize:14, color:PPT.DARK, paraSpaceAfter:8 } };
    });
    slide.addText(items, { x:0.3, y:1.25, w:9.4, h:PPT.SLIDE_H-1.5, valign:'top' });
    return 1;
  }

  function addMediaSlide(pptx, session) {
    const contingut = session.contingut || '';
    const mediaItems = [];
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = contingut;

    tmpDiv.querySelectorAll('iframe[src*="youtube"]').forEach(function(el) {
      const src = el.src || el.getAttribute('src') || '';
      const m = src.match(/embed\/([\w-]+)/);
      if (m) mediaItems.push({ type:'youtube', url:'https://youtu.be/' + m[1], label:'▶ YouTube' });
    });
    tmpDiv.querySelectorAll('iframe[src*="spotify"]').forEach(function(el) {
      mediaItems.push({ type:'spotify', url:el.src || '', label:'🎵 Spotify' });
    });
    tmpDiv.querySelectorAll('iframe[src*="soundcloud"]').forEach(function(el) {
      const m = (el.src||'').match(/url=([^&]+)/);
      if (m) mediaItems.push({ type:'soundcloud', url:decodeURIComponent(m[1]), label:'🎵 SoundCloud' });
    });
    tmpDiv.querySelectorAll('audio[src]').forEach(function(el) {
      mediaItems.push({ type:'audio', url:el.src||'', label:'🎵 Àudio' });
    });

    if (!mediaItems.length) return 0;

    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:1.1, fill:{ color: PPT.PURPLE } });
    slide.addShape(pptx.ShapeType.rect, { x:0, y:1.1, w:0.06, h:PPT.SLIDE_H-1.1, fill:{ color: PPT.PURPLE } });
    slide.addText('🎬  Recursos · Sessió ' + session.idx, { x:0.4, y:0.25, w:9.2, h:0.6, fontSize:20, color:PPT.WHITE, bold:true });
    const items = mediaItems.map(function(m) {
      return { text: m.label + ' — ' + m.url, options:{ hyperlink:{ url: m.url }, fontSize:13, color:PPT.TEAL, paraSpaceAfter:12, underline:true } };
    });
    slide.addText(items, { x:0.4, y:1.3, w:9.2, h:PPT.SLIDE_H-1.5, valign:'top' });
    return 1;
  }

  function addClosingSlide(pptx, titol) {
    const slide = pptx.addSlide();
    slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:PPT.SLIDE_W, h:PPT.SLIDE_H, fill:{ color: PPT.TEAL } });
    slide.addShape(pptx.ShapeType.rect, { x:4, y:0, w:6, h:PPT.SLIDE_H, fill:{ color: PPT.PURPLE, transparency:30 } });
    slide.addShape(pptx.ShapeType.rect, { x:0, y:PPT.SLIDE_H-0.08, w:PPT.SLIDE_W, h:0.08, fill:{ color: PPT.ORANGE } });
    slide.addShape(pptx.ShapeType.ellipse, { x:-0.5, y:-0.5, w:3, h:3, fill:{ color:PPT.WHITE, transparency:90 } });
    slide.addText('🎶', { x:4.2, y:1.2, w:1.5, h:1.5, fontSize:60 });
    slide.addText('Gràcies!', { x:0.6, y:2.8, w:8.8, h:0.8, fontSize:40, color:PPT.WHITE, bold:true, align:'center' });
    slide.addText(titol || '', { x:0.6, y:3.7, w:8.8, h:0.5, fontSize:16, color:PPT.WHITE, transparency:20, align:'center' });
  }

  async function generatePPTAlumnes(data, btnEl) {
    const originalText = btnEl.textContent;
    btnEl.disabled = true;
    btnEl.textContent = '⏳ Generant PPT (1/' + data.sessions.length + ')...';

    try {
      // Per a cada sessió, demanem a la IA un resum en bullets
      const sessionBullets = [];
      for (let i = 0; i < data.sessions.length; i++) {
        const s = data.sessions[i];
        btnEl.textContent = '⏳ Resumint sessió ' + (i+1) + '/' + data.sessions.length + '...';
        const text = htmlToPlainText(s.contingut || '');
        let bullets = [];
        if (text.length > 80) {
          const prompt = "Ets un docent. Resumeix el contingut d'aquesta sessió en una llista de punts curts (màxim 7 punts) per a projectar a l'aula, en VALENCIÀ. Cada punt: màxim 12 paraules, clar i directe.\n\nContingut:\n---\n" + text.substring(0, 3000) + "\n---\n\nSortida: NOMÉS la llista, un punt per línia, sense numeració, sense guions inicials, sense Markdown.";
          const result = await callAI(prompt, 500);
          bullets = result.split('\n').map(function(l){ return l.replace(/^[-*•\d.]\s*/,'').trim(); }).filter(function(l){ return l.length > 3; });
        }
        if (!bullets.length) {
          bullets = ['Contingut de la sessió ' + s.idx + ': ' + (s.nom || '')];
        }
        sessionBullets.push(bullets);
      }

      btnEl.textContent = '⏳ Creant presentació...';

      loadPptxGen(function() {
        try {
          const pptx = new window.PptxGenJS();
          pptx.layout = 'LAYOUT_16x9';
          pptx.title = data.titol || 'Unitat Didàctica';

          // 1. Portada
          addCover(pptx, data);

          // 2. Índex
          addIndex(pptx, data.sessions);

          // 3. Objectius (de la primera sessió o de l'estat React)
          const rs = (window._udGetAppState && window._udGetAppState()) || {};
          const objectius = rs.objectiusOperatius || data.sessions.map(function(s){ return s.objectius; }).filter(Boolean).join('\n');
          addObjectives(pptx, objectius);

          // 4. Sessions
          data.sessions.forEach(function(session, i) {
            addSessionTitle(pptx, session);
            addContentSlides(pptx, session, sessionBullets[i], i * 4 + 4);
            addMediaSlide(pptx, session);
            addActivitiesSlide(pptx, session);
          });

          // 5. Slide final
          addClosingSlide(pptx, data.titol);

          pptx.writeFile({ fileName: (data.titol || 'unitat').replace(/[^\wÀ-ú\s\-]/g,'').trim() + '_presentacio.pptx' });
          toast('✓ Presentació generada!');
        } catch(e) {
          toast('Error generant el PPTX: ' + e.message, true);
        } finally {
          btnEl.disabled = false;
          btnEl.textContent = originalText;
        }
      });
    } catch(e) {
      toast('Error: ' + e.message, true);
      btnEl.disabled = false;
      btnEl.textContent = originalText;
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. MAPA CONCEPTUAL INTERACTIU
  // ══════════════════════════════════════════════════════════════════

  function renderMindMap(conceptes, container) {
    const W = container.clientWidth || 800;
    const H = 520;
    const CX = W / 2;
    const CY = H / 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.style.cssText = 'display:block;font-family:inherit';

    // Fons suau
    const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('width', W); bg.setAttribute('height', H);
    bg.setAttribute('fill', '#f8fafc'); bg.setAttribute('rx', '12');
    svg.appendChild(bg);

    const colors = ['#0891b2','#7c3aed','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#f97316'];
    const center = conceptes[0];
    const nodes = conceptes.slice(1);
    const angleStep = (2 * Math.PI) / Math.max(nodes.length, 1);
    const radius = Math.min(W, H) * 0.33;

    // Línies des del centre als nodes
    nodes.forEach(function(node, i) {
      const angle = i * angleStep - Math.PI / 2;
      const nx = CX + radius * Math.cos(angle);
      const ny = CY + radius * Math.sin(angle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', CX); line.setAttribute('y1', CY);
      line.setAttribute('x2', nx); line.setAttribute('y2', ny);
      line.setAttribute('stroke', colors[i % colors.length]);
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-opacity', '0.5');
      svg.appendChild(line);

      // Sub-nodes si n'hi ha
      if (node.fills && node.fills.length) {
        const subRadius = 95;
        const subCount = node.fills.length;
        const subAngleStep = Math.PI / Math.max(subCount + 1, 2);
        const baseAngle = angle - Math.PI / 2 + subAngleStep;
        node.fills.forEach(function(fill, j) {
          const sa = baseAngle + j * subAngleStep;
          const sx = nx + subRadius * Math.cos(sa);
          const sy = ny + subRadius * Math.sin(sa);
          const sl = document.createElementNS('http://www.w3.org/2000/svg','line');
          sl.setAttribute('x1', nx); sl.setAttribute('y1', ny);
          sl.setAttribute('x2', sx); sl.setAttribute('y2', sy);
          sl.setAttribute('stroke', colors[i % colors.length]);
          sl.setAttribute('stroke-width', '1.5');
          sl.setAttribute('stroke-opacity', '0.35');
          sl.setAttribute('stroke-dasharray', '4,3');
          svg.appendChild(sl);

          const sg = document.createElementNS('http://www.w3.org/2000/svg','g');
          const sr = document.createElementNS('http://www.w3.org/2000/svg','rect');
          const swMax = 110;
          sr.setAttribute('x', sx - swMax/2); sr.setAttribute('y', sy - 16);
          sr.setAttribute('width', swMax); sr.setAttribute('height', 32);
          sr.setAttribute('rx', 8); sr.setAttribute('fill', 'white');
          sr.setAttribute('stroke', colors[i % colors.length]);
          sr.setAttribute('stroke-width', '1'); sr.setAttribute('stroke-opacity', '0.5');
          sg.appendChild(sr);
          const st = document.createElementNS('http://www.w3.org/2000/svg','text');
          st.setAttribute('x', sx); st.setAttribute('y', sy + 5);
          st.setAttribute('text-anchor','middle');
          st.setAttribute('font-size','11'); st.setAttribute('fill','#334155');
          st.textContent = fill.length > 14 ? fill.substring(0,13) + '…' : fill;
          sg.appendChild(st);
          svg.appendChild(sg);
        });
      }

      // Node secundari
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.style.cursor = 'default';
      const rx = 72, ry = 30;
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      el.setAttribute('cx', nx); el.setAttribute('cy', ny);
      el.setAttribute('rx', rx); el.setAttribute('ry', ry);
      el.setAttribute('fill', colors[i % colors.length]);
      el.setAttribute('fill-opacity', '0.15');
      el.setAttribute('stroke', colors[i % colors.length]);
      el.setAttribute('stroke-width', '2');
      g.appendChild(el);

      const label = node.nom || '';
      const words = label.split(' ');
      if (words.length <= 2 || label.length <= 14) {
        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', nx); t.setAttribute('y', ny + 5);
        t.setAttribute('text-anchor','middle');
        t.setAttribute('font-size','13'); t.setAttribute('font-weight','600');
        t.setAttribute('fill', colors[i % colors.length]);
        t.textContent = label.length > 16 ? label.substring(0,15)+'…' : label;
        g.appendChild(t);
      } else {
        const mid = Math.ceil(words.length / 2);
        [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].forEach(function(line, li) {
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          t.setAttribute('x', nx); t.setAttribute('y', ny + (li === 0 ? -3 : 13));
          t.setAttribute('text-anchor','middle');
          t.setAttribute('font-size','12'); t.setAttribute('font-weight','600');
          t.setAttribute('fill', colors[i % colors.length]);
          t.textContent = line.length > 14 ? line.substring(0,13)+'…' : line;
          g.appendChild(t);
        });
      }
      svg.appendChild(g);
    });

    // Node central (per damunt de tot)
    const cg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const cel = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    cel.setAttribute('cx', CX); cel.setAttribute('cy', CY);
    cel.setAttribute('rx', '95'); cel.setAttribute('ry', '45');
    cel.setAttribute('fill', '#1e293b');
    cg.appendChild(cel);
    const cLabel = center ? (center.nom || '') : '';
    const cWords = cLabel.split(' ');
    if (cWords.length <= 2 || cLabel.length <= 14) {
      const ct = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ct.setAttribute('x', CX); ct.setAttribute('y', CY + 6);
      ct.setAttribute('text-anchor','middle');
      ct.setAttribute('font-size','15'); ct.setAttribute('font-weight','700');
      ct.setAttribute('fill', '#ffffff');
      ct.textContent = cLabel.length > 18 ? cLabel.substring(0,17)+'…' : cLabel;
      cg.appendChild(ct);
    } else {
      const mid = Math.ceil(cWords.length / 2);
      [cWords.slice(0, mid).join(' '), cWords.slice(mid).join(' ')].forEach(function(line, li) {
        const ct = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        ct.setAttribute('x', CX); ct.setAttribute('y', CY + (li === 0 ? -2 : 16));
        ct.setAttribute('text-anchor','middle');
        ct.setAttribute('font-size','14'); ct.setAttribute('font-weight','700');
        ct.setAttribute('fill', '#ffffff');
        ct.textContent = line.length > 14 ? line.substring(0,13)+'…' : line;
        cg.appendChild(ct);
      });
    }
    svg.appendChild(cg);

    container.innerHTML = '';
    container.appendChild(svg);
  }

  async function generateMindMap(btnEl) {
    const originalText = btnEl.textContent;
    btnEl.disabled = true;
    btnEl.textContent = '⏳ Generant mapa...';

    try {
      // Recollim tot el contingut de la unitat
      const rs = (window._udGetAppState && window._udGetAppState()) || {};
      const titol = rs.titol || document.querySelector('input[type=text]')?.value || 'Unitat';
      let allText = 'Unitat: ' + titol + '\n';
      document.querySelectorAll('.session-card').forEach(function(card, i) {
        const nom = card.querySelector('.session-header input[type=text]')?.value || ('Sessió ' + (i+1));
        const editors = card.querySelectorAll('.ud-editor');
        let text = '';
        if (editors.length) text = editors[0].innerText.trim().substring(0, 800);
        if (text) allText += '\n--- ' + nom + ' ---\n' + text;
      });

      const prompt = "Analitza el contingut d'aquesta unitat didàctica i genera un mapa conceptual en format JSON.\n\nContingut:\n---\n" + allText.substring(0, 4000) + "\n---\n\nRetorna ÚNICAMENT un array JSON (sense explicacions, sense Markdown) amb aquest format exacte:\n[\n  {\"nom\": \"Concepte Central\", \"fills\": []},\n  {\"nom\": \"Tema 1\", \"fills\": [\"subtema\", \"subtema\"]},\n  {\"nom\": \"Tema 2\", \"fills\": [\"subtema\"]},\n  {\"nom\": \"Tema 3\", \"fills\": []}\n]\nEl primer element és sempre el concepte central (el títol de la unitat resumit). Els altres elements (entre 4 i 7) són els temes principals. Cada tema pot tenir entre 0 i 3 subtemes. Tot en VALENCIÀ.";

      let result = await callAI(prompt, 800);
      result = result.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const conceptes = JSON.parse(result);

      // Mostrem el modal amb el mapa
      openMindMapModal(conceptes, titol);
    } catch(e) {
      toast('Error generant el mapa: ' + e.message, true);
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = originalText;
    }
  }

  function openMindMapModal(conceptes, titol) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,39,68,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:20px;box-sizing:border-box';

    const box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:16px;padding:24px;width:100%;max-width:900px;box-shadow:0 24px 64px rgba(0,0,0,0.35);display:flex;flex-direction:column;gap:16px';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center';
    header.innerHTML =
      '<h3 style="margin:0;color:#1e293b;font-size:20px;font-weight:700">🧠 Mapa Conceptual · ' + (titol || '') + '</h3>' +
      '<div style="display:flex;gap:8px">' +
      '<button id="ud-map-export" type="button" style="padding:8px 14px;border:1px solid #c8d0e8;border-radius:8px;background:white;color:#1e293b;font-weight:600;font-family:inherit;cursor:pointer;font-size:13px">💾 Descarregar SVG</button>' +
      '<button id="ud-map-close" type="button" style="padding:8px 14px;border:none;border-radius:8px;background:#1e293b;color:white;font-weight:600;font-family:inherit;cursor:pointer;font-size:13px">Tancar</button>' +
      '</div>';

    const mapContainer = document.createElement('div');
    mapContainer.style.cssText = 'width:100%;border-radius:12px;overflow:hidden;min-height:520px';

    box.appendChild(header);
    box.appendChild(mapContainer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    renderMindMap(conceptes, mapContainer);

    box.querySelector('#ud-map-close').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    box.querySelector('#ud-map-export').onclick = function() {
      const svgEl = mapContainer.querySelector('svg');
      if (!svgEl) return;
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (titol || 'mapa_conceptual').replace(/[^\wÀ-ú\s\-]/g,'').trim() + '_mapa.svg';
      a.click();
      URL.revokeObjectURL(url);
      toast('✓ Mapa descarregat!');
    };
  }

  // ══════════════════════════════════════════════════════════════════
  // BOTONS AL HEADER (PPT + Mapa Conceptual)
  // ══════════════════════════════════════════════════════════════════

  function addHeaderButtons() {
    if (document.getElementById('ud-ppt-alumnes-btn') && document.getElementById('ud-mindmap-btn')) return;

    // Amagam el botó antic de Canva si existeix
    const oldCanva = document.getElementById('ud-canva-btn');
    if (oldCanva) oldCanva.style.display = 'none';

    const container = document.querySelector('.header-buttons') ||
                      document.querySelector('[class*="header"] button')?.parentElement;
    if (!container) return;

    // Botó PPT Alumnes
    if (!document.getElementById('ud-ppt-alumnes-btn')) {
      const btnPPT = document.createElement('button');
      btnPPT.id = 'ud-ppt-alumnes-btn';
      btnPPT.className = 'btn btn-sm btn-outline header-btn';
      btnPPT.textContent = '🎓 PPT Alumnes';
      btnPPT.title = 'Genera una presentació visual per a projectar a l\'aula';
      btnPPT.style.cssText = 'border-color:#0891b2;color:#0891b2';
      btnPPT.onmouseover = function() { btnPPT.style.background='#0891b2'; btnPPT.style.color='white'; };
      btnPPT.onmouseout = function() { btnPPT.style.background=''; btnPPT.style.color='#0891b2'; };
      btnPPT.onclick = function() {
        // Reutilitzem collectData del media-editor.js que ja existeix al window
        const collectData = window._udCollectData || (function(){
          const rs = (window._udGetAppState && window._udGetAppState()) || {};
          const sessions = [];
          document.querySelectorAll('.session-card').forEach(function(card, i) {
            const nom = card.querySelector('.session-header input[type=text]')?.value || 'Sessió ' + (i+1);
            const editors = card.querySelectorAll('.ud-editor');
            const contingut = editors[0] ? editors[0].innerHTML : '';
            const exercicis = editors[1] ? editors[1].innerText : '';
            if (contingut || exercicis) sessions.push({ idx: i+1, nom, contingut, exercicis });
          });
          return {
            titol: rs.titol || document.querySelector('input[type=text]')?.value || '',
            assignatura: rs.assignatura || '',
            nivell: rs.nivell || '',
            sessions: sessions
          };
        });
        const data = typeof collectData === 'function' ? collectData() : collectData;
        if (!data.sessions || !data.sessions.length) {
          toast('Genera primer el contingut de les sessions.', true); return;
        }
        generatePPTAlumnes(data, btnPPT);
      };
      container.appendChild(btnPPT);
    }

    // Botó Mapa Conceptual
    if (!document.getElementById('ud-mindmap-btn')) {
      const btnMap = document.createElement('button');
      btnMap.id = 'ud-mindmap-btn';
      btnMap.className = 'btn btn-sm btn-outline header-btn';
      btnMap.textContent = '🧠 Mapa Conceptual';
      btnMap.title = 'Genera un mapa conceptual interactiu de la unitat';
      btnMap.style.cssText = 'border-color:#7c3aed;color:#7c3aed';
      btnMap.onmouseover = function() { btnMap.style.background='#7c3aed'; btnMap.style.color='white'; };
      btnMap.onmouseout = function() { btnMap.style.background=''; btnMap.style.color='#7c3aed'; };
      btnMap.onclick = function() { generateMindMap(btnMap); };
      container.appendChild(btnMap);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // EVENT DELEGATION GLOBAL (botons d'esborrar)
  // ══════════════════════════════════════════════════════════════════

  function setupGlobalClickHandler() {
    document.addEventListener('click', function (e) {
      const adaptedDel = e.target.closest('.ud-adapted-del');
      if (adaptedDel) {
        e.preventDefault(); e.stopPropagation();
        const wrap = adaptedDel.closest('.ud-adapted-block');
        if (wrap && confirm('Esborrar aquesta adaptació?')) {
          const editor = wrap.closest('.ud-editor');
          wrap.remove();
          if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
      const audioDel = e.target.closest('.ud-audio-del');
      if (audioDel) {
        e.preventDefault(); e.stopPropagation();
        const wrap = audioDel.closest('.ud-audio-wrap');
        if (wrap && confirm('Esborrar aquest àudio?')) {
          const editor = wrap.closest('.ud-editor');
          wrap.remove();
          if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
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
    document.querySelectorAll('.session-card').forEach(addAdaptButtons);
    addHeaderButtons();
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
          if ((n.classList && (n.classList.contains('ud-toolbar') || n.classList.contains('session-card') || n.classList.contains('header-buttons'))) ||
            (n.querySelector && n.querySelector('.ud-toolbar, .session-card, .header-buttons'))) {
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
    console.log('[enhancements.js v3] Inicialitzat: Àudio · DUA · PPT Alumnes · Mapa Conceptual');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }
})();
