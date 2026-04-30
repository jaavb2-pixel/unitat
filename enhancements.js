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
  // ══════════════════════════════════════════════════════════════════

  // Plantilla: Do Major, 2/4, línia melòdica única
  var SCORE_TEMPLATE = 'C4/q D4/q | E4/q F4/q | G4/h | C5/h';

  // Carrega abcjs per a la renderització
  function loadAbcjs(cb) {
    if (window.ABCJS) { cb(); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/abcjs@6.4.0/dist/abcjs-basic-min.js';
    s.onload = function () { cb(); };
    s.onerror = function () { cb(new Error('No s\'ha pogut carregar abcjs')); };
    document.head.appendChild(s);
  }

  // ── Conversió de notes ────────────────────────────────────────────

  var NOTE_SEMI = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

  function noteToMidi(name, octave) {
    var base = NOTE_SEMI[name[0]] || 0;
    var acc = name.length > 1 ? (name[1] === '#' ? 1 : -1) : 0;
    return (octave + 1) * 12 + base + acc;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Durades en beats (negra = 1 beat)
  var DUR_BEATS = {
    'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25,
    'w.': 6, 'h.': 3, 'q.': 1.5, '8.': 0.75, '16.': 0.375
  };

  // Durades en ABC (L:1/16)
  var DUR_ABC = {
    'w': '16', 'h': '8', 'q': '4', '8': '2', '16': '1',
    'w.': '24', 'h.': '12', 'q.': '6', '8.': '3', '16.': '3/2'
  };

  // Analitza el format de l'usuari: "C4/q D4/q | E4/h"
  function parseScoreInput(input) {
    var bars = input.split('|').map(function (b) { return b.trim(); }).filter(Boolean);
    var notes = [];
    var barEnds = [];

    bars.forEach(function (bar) {
      // Captura nota normal o silenci
      var re = /([A-G][#b]?)(\d)\/(w\.|h\.|q\.|8\.|16\.|w|h|q|8|16)|[Rr]\/(w\.|h\.|q\.|8\.|16\.|w|h|q|8|16)/g;
      var m;
      while ((m = re.exec(bar)) !== null) {
        if (/^[Rr]/.test(m[0])) {
          // Silenci
          notes.push({ rest: true, dur: m[0].split('/')[1] });
        } else {
          var name = m[1];
          var octave = parseInt(m[2], 10);
          var dur = m[3];
          notes.push({ name: name, octave: octave, dur: dur, midi: noteToMidi(name, octave) });
        }
      }
      barEnds.push(notes.length);
    });

    return { notes: notes, barEnds: barEnds };
  }

  // Converteix una nota al nom ABC
  // ABC (clau de sol): C3=C D3=D ... B3=B / C4=c D4=d ... / C5=c' ...
  function noteToAbcName(name, octave) {
    var acc = name.length > 1 ? (name[1] === '#' ? '^' : '_') : '';
    var L = name[0];
    if (octave <= 2) {
      return acc + L.toUpperCase() + new Array(3 - Math.max(octave, -1) + 1).join(',');
    }
    if (octave === 3) return acc + L.toUpperCase();
    if (octave === 4) return acc + L.toLowerCase();
    // octave >= 5
    return acc + L.toLowerCase() + new Array(octave - 4 + 1).join("'");
  }

  // Construeix el string ABC complet
  function buildAbcString(parsed, ts) {
    ts = ts || '2/4';
    var s = '';
    parsed.notes.forEach(function (note, i) {
      var d = DUR_ABC[note.dur] || '4';
      if (note.rest) {
        s += 'z' + d + ' ';
      } else {
        s += noteToAbcName(note.name, note.octave) + d + ' ';
      }
      if (parsed.barEnds.indexOf(i + 1) !== -1 && i < parsed.notes.length - 1) {
        s += '| ';
      }
    });
    return 'X:1\nT:\nM:' + ts + '\nL:1/16\nQ:1/4=80\nK:C\n' + s + '|';
  }

  // ── Síntesi Web Audio ─────────────────────────────────────────────

  var _scoreAudioCtx = null;
  var _scoreOscs = [];
  var _scorePlaying = false;

  function getScoreCtx() {
    if (!_scoreAudioCtx) {
      _scoreAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return _scoreAudioCtx;
  }

  function stopScorePlayback() {
    _scoreOscs.forEach(function (o) { try { o.stop(); } catch (e) {} });
    _scoreOscs = [];
    _scorePlaying = false;
  }

  function playScoreNotes(parsed, bpm, onEnd) {
    stopScorePlayback();
    var ctx = getScoreCtx();
    if (ctx.state === 'suspended') ctx.resume();

    var masterGain = ctx.createGain();
    masterGain.gain.value = 0.65;
    masterGain.connect(ctx.destination);

    var spb = 60 / (bpm || 80); // segons per beat (negra)
    var t = ctx.currentTime + 0.1;
    var total = 0;
    _scorePlaying = true;

    parsed.notes.forEach(function (note) {
      var beats = DUR_BEATS[note.dur] || 1;
      var dur = beats * spb;

      if (!note.rest) {
        var osc = ctx.createOscillator();
        var ng = ctx.createGain();
        osc.connect(ng);
        ng.connect(masterGain);
        osc.type = 'triangle'; // so més càlid que 'sine'
        osc.frequency.value = midiToFreq(note.midi);

        // Envelope ràpid tipo piano
        ng.gain.setValueAtTime(0, t);
        ng.gain.linearRampToValueAtTime(0.5, t + 0.015);
        ng.gain.exponentialRampToValueAtTime(0.001, t + Math.max(dur * 0.9, 0.06));

        osc.start(t);
        osc.stop(t + dur + 0.06);
        _scoreOscs.push(osc);
      }
      t += dur;
      total += dur;
    });

    setTimeout(function () {
      _scorePlaying = false;
      if (onEnd) onEnd();
    }, (total + 0.5) * 1000);
  }

  // ── Modal de l'editor de partitura ───────────────────────────────

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
      // Capçalera
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
      '<h3 style="margin:0;color:#1e293b;font-size:20px;font-weight:700">🎼 Editor de partitura</h3>' +
      '<button id="sc-close" type="button" style="padding:8px 14px;border:none;border-radius:8px;' +
      'background:#1e293b;color:white;font-weight:600;font-family:inherit;cursor:pointer">✕ Tancar</button>' +
      '</div>' +

      // Guia plegable
      '<details style="background:#f8fafc;border-radius:10px;padding:12px;border:1px solid #e2e8f0">' +
      '<summary style="cursor:pointer;font-weight:600;color:#1e293b;font-size:13px">📖 Guia ràpida de format (clica per obrir)</summary>' +
      '<div style="margin-top:10px;font-size:12px;color:#334155;line-height:2">' +
      '<b>Format de cada nota:</b> <code style="background:#e2e8f0;padding:1px 6px;border-radius:4px">NOTA + OCTAVA / DURADA</code>' +
      '&nbsp;&nbsp;ex: <code style="background:#e2e8f0;padding:1px 6px;border-radius:4px">C4/q</code> = Do central, negra<br>' +
      '<b>Notes:</b> C=Do · D=Re · E=Mi · F=Fa · G=Sol · A=La · B=Si<br>' +
      '<b>Octaves:</b> 3 = greu &nbsp;·&nbsp; 4 = central (Do central) &nbsp;·&nbsp; 5 = aguda<br>' +
      '<b>Alteracions:</b> C#4 = Do♯ &nbsp;·&nbsp; Bb4 = Si♭ &nbsp;·&nbsp; Eb4 = Mi♭ &nbsp;·&nbsp; F#4 = Fa♯<br>' +
      '<table style="border-collapse:collapse;margin-top:4px">' +
      '<tr><td style="padding:2px 10px 2px 0"><b>Durades:</b></td>' +
      '<td style="padding:2px 6px">w = rodona</td><td style="padding:2px 6px">h = blanca</td>' +
      '<td style="padding:2px 6px">q = negra</td><td style="padding:2px 6px">8 = corxera</td><td style="padding:2px 6px">16 = semicorxera</td></tr>' +
      '<tr><td style="padding:2px 10px 2px 0"><b>Amb puntet:</b></td>' +
      '<td style="padding:2px 6px">w. &nbsp; h. &nbsp; q. &nbsp; 8. &nbsp; 16.</td></tr>' +
      '</table>' +
      '<b>Silenci:</b> R/q &nbsp; R/h &nbsp; R/w &nbsp; R/8 &nbsp; (mateixa sintaxi que les notes)<br>' +
      '<b>Separador de compàs:</b> <code style="background:#e2e8f0;padding:1px 6px;border-radius:4px">|</code><br>' +
      '<b>Exemple:</b> <code style="background:#e2e8f0;padding:1px 6px;border-radius:4px">C4/q D4/q | E4/q F4/q | G4/h | C5/h</code>' +
      '</div></details>' +

      // Controls: compàs + tempo
      '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
      '<label style="font-weight:600;color:#1e293b;font-size:13px">Compàs:</label>' +
      '<select id="sc-ts" style="padding:7px 10px;border:1.5px solid #c8d0e8;border-radius:8px;font-family:inherit;font-size:13px">' +
      '<option value="2/4" selected>2/4</option>' +
      '<option value="3/4">3/4</option>' +
      '<option value="4/4">4/4</option>' +
      '<option value="6/8">6/8</option>' +
      '</select>' +
      '<label style="font-weight:600;color:#1e293b;font-size:13px;margin-left:8px">Tempo:</label>' +
      '<input id="sc-bpm" type="number" value="80" min="40" max="200" ' +
      'style="width:72px;padding:7px 10px;border:1.5px solid #c8d0e8;border-radius:8px;font-family:inherit;font-size:13px"> BPM' +
      '</div>' +

      // Textarea d'entrada
      '<div>' +
      '<label style="display:block;margin-bottom:6px;font-weight:600;color:#1e293b;font-size:13px">Seqüència de notes:</label>' +
      '<textarea id="sc-input" rows="3" spellcheck="false" ' +
      'style="width:100%;padding:10px 12px;border:1.5px solid #c8d0e8;border-radius:8px;' +
      'font-size:14px;font-family:monospace;box-sizing:border-box;resize:vertical;line-height:1.7">' +
      SCORE_TEMPLATE + '</textarea>' +
      '</div>' +

      // Botons d'acció
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button id="sc-render" type="button" style="padding:9px 16px;border:none;border-radius:8px;background:#0891b2;color:white;font-weight:600;font-family:inherit;cursor:pointer">🎼 Renderitzar</button>' +
      '<button id="sc-play" type="button" style="padding:9px 16px;border:1.5px solid #10b981;border-radius:8px;background:white;color:#10b981;font-weight:600;font-family:inherit;cursor:pointer">▶ Reproduir</button>' +
      '<button id="sc-stop" type="button" style="padding:9px 16px;border:1.5px solid #ef4444;border-radius:8px;background:white;color:#ef4444;font-weight:600;font-family:inherit;cursor:pointer;display:none">⏹ Aturar</button>' +
      '</div>' +

      // Àrea de renderització
      '<div id="sc-area" style="min-height:160px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:12px;overflow-x:auto">' +
      '<p style="color:#94a3b8;text-align:center;margin:50px 0;font-size:14px">Clica "Renderitzar" per veure la partitura ↑</p>' +
      '</div>' +

      // Error
      '<div id="sc-err" style="display:none;padding:10px;background:#fef2f2;border-radius:8px;color:#c1272d;font-size:13px"></div>' +

      // Botó inserir
      '<div style="display:flex;justify-content:flex-end">' +
      '<button id="sc-insert" type="button" ' +
      'style="padding:9px 18px;border:none;border-radius:8px;background:#1e293b;color:white;font-weight:600;font-family:inherit;cursor:pointer;display:none">' +
      '✅ Inserir partitura a la sessió</button>' +
      '</div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    var parsedScore = null;
    var btnPlay = box.querySelector('#sc-play');
    var btnStop = box.querySelector('#sc-stop');
    var btnInsert = box.querySelector('#sc-insert');
    var errEl = box.querySelector('#sc-err');
    var area = box.querySelector('#sc-area');

    function showErr(msg) { errEl.textContent = msg; errEl.style.display = msg ? 'block' : 'none'; }
    function closeModal() { stopScorePlayback(); overlay.remove(); }

    box.querySelector('#sc-close').onclick = closeModal;
    overlay.onclick = function (e) { if (e.target === overlay) closeModal(); };

    // Renderitzar
    box.querySelector('#sc-render').onclick = function () {
      showErr('');
      loadAbcjs(function (err) {
        if (err) { showErr('No s\'ha pogut carregar la llibreria de notació musical.'); return; }
        var input = box.querySelector('#sc-input').value.trim();
        if (!input) { showErr('Escriu algunes notes primer.'); return; }
        try {
          parsedScore = parseScoreInput(input);
          if (!parsedScore.notes.length) {
            showErr('No s\'han reconegut notes. Comprova el format. Exemple: C4/q D4/q | E4/q F4/q');
            return;
          }
          var ts = box.querySelector('#sc-ts').value;
          var abc = buildAbcString(parsedScore, ts);
          window.ABCJS.renderAbc(area, abc, {
            scale: 1.5,
            staffwidth: Math.min((area.clientWidth || 700) - 30, 720),
            add_classes: true
          });
          btnInsert.style.display = '';
        } catch (e) {
          showErr('Error en la renderització: ' + e.message);
        }
      });
    };

    // Reproduir
    btnPlay.onclick = function () {
      if (!parsedScore || !parsedScore.notes.length) { showErr('Renderitza la partitura primer.'); return; }
      btnPlay.style.display = 'none';
      btnStop.style.display = '';
      var bpm = parseInt(box.querySelector('#sc-bpm').value, 10) || 80;
      playScoreNotes(parsedScore, bpm, function () {
        btnPlay.style.display = '';
        btnStop.style.display = 'none';
      });
    };

    // Aturar
    btnStop.onclick = function () {
      stopScorePlayback();
      btnPlay.style.display = '';
      btnStop.style.display = 'none';
    };

    // Inserir partitura a l'editor (controls autònoms, sense interferències)
    btnInsert.onclick = function () {
      var svgEl = area.querySelector('svg');
      if (!svgEl) { showErr('Renderitza la partitura primer.'); return; }

      // Wrapper — sense ud-img-wrap-outer per evitar interferències del media-editor.js
      var wrap = document.createElement('div');
      wrap.className = 'ud-score-wrap';
      wrap.setAttribute('contenteditable', 'false');
      wrap.setAttribute('data-ud-score', '1');
      wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';

      // Botons de control amb estils 100% inline (autònoms)
      var CBTN = 'border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px;' +
        'font-weight:700;font-family:inherit;line-height:1.2;color:white;background:rgba(255,255,255,0.2);';
      var CDEL = 'border:none;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px;' +
        'font-weight:700;font-family:inherit;line-height:1.2;color:white;background:rgba(193,39,45,0.9);';

      var controls = document.createElement('div');
      controls.setAttribute('contenteditable', 'false');
      controls.style.cssText =
        'position:absolute;top:4px;left:4px;z-index:500;display:flex;gap:2px;' +
        'background:rgba(26,39,68,0.92);border-radius:7px;padding:3px 4px;pointer-events:auto;';

      [
        { a:'up',      l:'↑', t:'Moure amunt',     d:false },
        { a:'down',    l:'↓', t:'Moure avall',      d:false },
        { a:'smaller', l:'−', t:'Fer més menuda',   d:false },
        { a:'bigger',  l:'+', t:'Fer més gran',      d:false },
        { a:'left',    l:'←', t:'Alinear esquerra', d:false },
        { a:'center',  l:'↕', t:'Centrar',          d:false },
        { a:'right',   l:'→', t:'Alinear dreta',    d:false },
        { a:'del',     l:'🗑', t:'Esborrar',         d:true  }
      ].forEach(function(def) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = def.l;
        b.title = def.t;
        b.setAttribute('data-sc-action', def.a);
        b.style.cssText = def.d ? CDEL : CBTN;
        controls.appendChild(b);
      });

      // SVG clonat — mida inicial 80%, centrada
      var clone = svgEl.cloneNode(true);
      clone.setAttribute('width', '80%');
      clone.removeAttribute('height');
      clone.style.cssText = 'max-width:80%;display:inline-block;border-radius:4px;vertical-align:top;';

      wrap.appendChild(controls);
      wrap.appendChild(clone);

      function syncEd() {
        var ed = wrap.closest ? wrap.closest('.ud-editor') : null;
        if (!ed) { ed = wrap.parentElement; while(ed && !ed.classList.contains('ud-editor')) ed = ed.parentElement; }
        if (ed) ed.dispatchEvent(new Event('input', { bubbles: true }));
      }

      controls.querySelectorAll('button').forEach(function (btn) {
        btn.addEventListener('mousedown', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          var action = btn.getAttribute('data-sc-action');
          var curSz = parseFloat(clone.getAttribute('width') || '80') || 80;

          if (action === 'del') {
            if (confirm('Esborrar aquesta partitura?')) {
              var p = document.createElement('p'); p.innerHTML = '<br>';
              if (wrap.parentElement) { wrap.parentElement.insertBefore(p, wrap.nextSibling); }
              wrap.remove();
              setTimeout(syncEd, 50);
            }
            return;
          }
          if (action === 'smaller') {
            var ns = Math.max(15, curSz - 10) + '%';
            clone.setAttribute('width', ns);
            clone.style.maxWidth = ns;
            if (clone.style.float && clone.style.float !== '') clone.style.width = ns;
          }
          if (action === 'bigger') {
            var nb = Math.min(100, curSz + 10) + '%';
            clone.setAttribute('width', nb);
            clone.style.maxWidth = nb;
            if (clone.style.float && clone.style.float !== '') clone.style.width = nb;
          }
          if (action === 'left') {
            wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;clear:both;';
            clone.style.cssText = 'width:' + curSz + '%;max-width:' + curSz + '%;float:left;margin:0 18px 8px 0;border-radius:4px;';
            clone.setAttribute('width', curSz + '%');
          }
          if (action === 'right') {
            wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;clear:both;';
            clone.style.cssText = 'width:' + curSz + '%;max-width:' + curSz + '%;float:right;margin:0 0 8px 18px;border-radius:4px;';
            clone.setAttribute('width', curSz + '%');
          }
          if (action === 'center') {
            wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';
            clone.style.cssText = 'max-width:' + curSz + '%;width:' + curSz + '%;display:inline-block;float:none;border-radius:4px;';
            clone.setAttribute('width', curSz + '%');
          }
          if (action === 'up') {
            var prev = wrap.previousElementSibling;
            while (prev && !prev.textContent.trim() && !prev.querySelector('img,iframe,[data-ud-score],[data-ud-audio]')) {
              prev = prev.previousElementSibling;
            }
            if (prev && wrap.parentElement) wrap.parentElement.insertBefore(wrap, prev);
          }
          if (action === 'down') {
            var next = wrap.nextElementSibling;
            while (next && !next.textContent.trim() && !next.querySelector('img,iframe,[data-ud-score],[data-ud-audio]')) {
              next = next.nextElementSibling;
            }
            if (next && next.nextSibling && wrap.parentElement) {
              wrap.parentElement.insertBefore(wrap, next.nextSibling);
            } else if (next && wrap.parentElement) {
              wrap.parentElement.appendChild(wrap);
            }
          }
          setTimeout(syncEd, 50);
        });
      });

      insertElementInEditor(editor, wrap);
      closeModal();
      toast('✓ Partitura inserida');
    };
  }

  function makeScoreButton(toolbar) {
    if (toolbar._scoreBtnAdded) return;
    var editor = toolbar.nextElementSibling;
    if (!editor || !editor.classList.contains('ud-editor')) return;
    toolbar._scoreBtnAdded = true;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '🎼 Partitura';
    btn.title = 'Inserir un fragment de partitura (amb so)';
    btn.onclick = function () { openScoreModal(editor); };
    toolbar.appendChild(btn);
  }

  // ══════════════════════════════════════════════════════════════════
  // 4. ELIMINAR BOTÓ "EXPORTAR A CANVA"
  // ══════════════════════════════════════════════════════════════════

  function hideCanvaButton() {
    var btn = document.getElementById('ud-canva-btn');
    if (btn) { btn.style.display = 'none'; btn.style.visibility = 'hidden'; }
  }

  // ══════════════════════════════════════════════════════════════════
  // EVENT DELEGATION GLOBAL (botons d'esborrar)
  // ══════════════════════════════════════════════════════════════════

  function setupGlobalClickHandler() {
    document.addEventListener('click', function (e) {

      // Esborrar adaptació (DUA)
      var adaptedDel = e.target.closest('.ud-adapted-del');
      if (adaptedDel) {
        e.preventDefault(); e.stopPropagation();
        var wrapA = adaptedDel.closest('.ud-adapted-block');
        if (wrapA && confirm('Esborrar aquesta adaptació?')) {
          var edA = wrapA.closest('.ud-editor');
          wrapA.remove();
          if (edA) edA.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      // Esborrar àudio
      var audioDel = e.target.closest('.ud-audio-del');
      if (audioDel) {
        e.preventDefault(); e.stopPropagation();
        var wrapAu = audioDel.closest('.ud-audio-wrap');
        if (wrapAu && confirm('Esborrar aquest àudio?')) {
          var edAu = wrapAu.closest('.ud-editor');
          wrapAu.remove();
          if (edAu) edAu.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

      // Esborrar partitura
      var scoreDel = e.target.closest('.ud-score-del');
      if (scoreDel) {
        e.preventDefault(); e.stopPropagation();
        var wrapSc = scoreDel.closest('.ud-score-wrap');
        if (wrapSc && confirm('Esborrar aquesta partitura?')) {
          var edSc = wrapSc.closest('.ud-editor');
          wrapSc.remove();
          if (edSc) edSc.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }

    }, true); // useCapture = true → s'executa abans que altres handlers
  }

  // ══════════════════════════════════════════════════════════════════
  // INICIALITZACIÓ I OBSERVACIÓ DEL DOM
  // ══════════════════════════════════════════════════════════════════

  function processNewElements() {
    document.querySelectorAll('.ud-toolbar').forEach(makeAudioButton);
    document.querySelectorAll('.ud-toolbar').forEach(makeScoreButton);
    document.querySelectorAll('.session-card').forEach(addAdaptButtons);
    hideCanvaButton();
  }

  function init() {
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
            n.classList.contains('session-card')
          )) || (n.querySelector && n.querySelector('.ud-toolbar,.session-card'))) {
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
    console.log('[enhancements.js v4] Àudio · DUA · Partitura · Elimina Canva');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }

})();
