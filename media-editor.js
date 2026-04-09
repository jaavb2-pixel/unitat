(function () {

  // ── CARREGA PPTXGENJS DINÀMICAMENT ───────────────────────────────
  function loadPptxGen(cb) {
    if (window.PptxGenJS) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  // ── ACCÉS A L'ESTAT DE REACT ─────────────────────────────────────
  function getAppState() {
    const root = document.getElementById('root');
    if (!root) return null;
    function searchFiber(fiber, depth) {
      if (!fiber || depth > 60) return null;
      let s = fiber.memoizedState;
      while (s) {
        const v = s.memoizedState;
        if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.sessions)) return v;
        s = s.next;
      }
      return searchFiber(fiber.child, depth+1) || (depth < 4 ? searchFiber(fiber.sibling, depth+1) : null);
    }
    const key = Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('_reactRootContainer'));
    if (!key) return null;
    return searchFiber(root[key]?.current || root[key], 0);
  }

  function collectData() {
    const rs = getAppState();
    const sa = getSAData();

    // Sempre llegim directament dels editors del DOM per capturar imatges i vídeos
    const editorSessions = [];
    document.querySelectorAll('.session-card').forEach((card, i) => {
      const nom = card.querySelector('.session-header input[type=text]')?.value
        || rs?.sessions?.[i]?.nom
        || `Sessió ${i+1}`;
      let contingut = '', exercicis = '', objectius = '';

      // Llegim dels editors enriquits (innerHTML preserva imatges/vídeos/links)
      const editors = card.querySelectorAll('.ud-editor');
      const textareas = card.querySelectorAll('textarea');

      if (editors.length >= 1) {
        contingut = editors[0].innerHTML;
      } else {
        textareas.forEach(ta => {
          if (parseInt(ta.getAttribute('rows')||0) === 8) contingut = ta.value;
        });
      }
      if (editors.length >= 2) {
        exercicis = editors[1].innerText;
      } else {
        textareas.forEach(ta => {
          if (parseInt(ta.getAttribute('rows')||0) === 6) exercicis = ta.value;
        });
      }

      // Objectius del React state
      objectius = rs?.sessions?.[i]?.objectiusOperatius || '';

      if (contingut || exercicis) {
        editorSessions.push({ idx: i+1, nom, contingut, exercicis, objectius });
      }
    });

    // Dades bàsiques: React state o DOM
    const titol      = rs?.titol || document.querySelector('input[type=text]')?.value || '';
    const assignatura = rs?.assignatura || '';
    const nivell     = rs?.nivell || '';
    const justificacio = rs?.justificacio || '';

    if (editorSessions.length) {
      return { titol, assignatura, nivell, justificacio, sa, sessions: editorSessions };
    }

    // Fallback: si no hi ha editors, usem React state
    if (rs && rs.sessions?.length) {
      return {
        titol, assignatura, nivell, justificacio, sa,
        sessions: rs.sessions
          .filter(s => s.contingutAlumne || s.exercicis)
          .map((s, i) => ({
            idx: i+1,
            nom: s.nom || `Sessió ${i+1}`,
            contingut: s.contingutAlumne || '',
            exercicis: s.exercicis || '',
            objectius: s.objectiusOperatius || ''
          }))
      };
    }
    return { titol, assignatura, nivell, justificacio, sa, sessions: [] };
  }

  // ── LLEGEIX DADES DE LA SA ───────────────────────────────────────
  function getSAData() {
    const get = id => document.getElementById(id)?.value || '';
    return {
      titolSA:     get('sa-titol'),
      narrativa:   get('sa-narrativa'),
      repte:       get('sa-repte'),
      producte:    get('sa-producte'),
      connexio:    get('sa-connexio'),
      arees:       get('sa-arees'),
      temporitzacio: get('sa-temporitzacio'),
    };
  }

  // ── INJECTA LA SECCIÓ DE SA AL DOM ──────────────────────────────
  function injectSASection() {
    if (document.getElementById('ud-sa-section')) return;
    // Busquem el card de configuració (el que conté el títol de la unitat)
    const cards = document.querySelectorAll('.card');
    let targetCard = null;
    cards.forEach(c => {
      if (c.textContent.includes('Títol de la Unitat') || c.textContent.includes('Justific')) {
        targetCard = c;
      }
    });
    if (!targetCard) return;

    const section = document.createElement('div');
    section.id = 'ud-sa-section';
    section.style.cssText = 'background:white;border-radius:12px;border:1.5px solid #e4e8f0;margin-bottom:20px;overflow:hidden';
    section.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1.5px solid #e4e8f0;background:#f8f9fc">
        <span style="font-size:18px">🎯</span>
        <h2 style="font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#1a2744;flex:1;margin:0">Situació d'Aprenentatge</h2>
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#1a2744;background:rgba(200,150,12,.15);border:1px solid rgba(200,150,12,.3);padding:3px 10px;border-radius:20px">LOMLOE · Art. 2</span>
        <button id="sa-ia-btn" style="padding:6px 14px;background:linear-gradient(135deg,#c8960c,#f0b429);color:#1a2744;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">✨ Generar amb IA</button>
      </div>
      <div style="padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="grid-column:1/-1">
          <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#1a2744;margin-bottom:6px">Títol de la Situació d'Aprenentatge</label>
          <input id="sa-titol" type="text" placeholder='Ex: "La música com a mirall del seu temps"' style="width:100%;padding:10px 13px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none">
        </div>
        <div style="grid-column:1/-1">
          <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#1a2744;margin-bottom:6px">Narrativa / Context Motivador</label>
          <textarea id="sa-narrativa" rows="3" placeholder="Explica la situació real que dona sentit a l'aprenentatge. Ha de connectar amb l'experiència de l'alumnat i despertar la seua curiositat..." style="width:100%;padding:10px 13px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:vertical"></textarea>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#1a2744;margin-bottom:6px">Repte o Pregunta Guia</label>
          <textarea id="sa-repte" rows="2" placeholder='Ex: "Com podem usar la música per entendre millor la Història?"' style="width:100%;padding:10px 13px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:vertical"></textarea>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#1a2744;margin-bottom:6px">Producte Final</label>
          <textarea id="sa-producte" rows="2" placeholder='Ex: "Podcast on l\'alumnat explica un període musical als seus companys"' style="width:100%;padding:10px 13px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:vertical"></textarea>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#1a2744;margin-bottom:6px">Connexió amb la Vida Real</label>
          <textarea id="sa-connexio" rows="2" placeholder="Com es relaciona amb situacions reals fora de l'aula?" style="width:100%;padding:10px 13px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:vertical"></textarea>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#1a2744;margin-bottom:6px">Àrees Implicades</label>
          <textarea id="sa-arees" rows="2" placeholder='Ex: "Música, Història, Llengua Valenciana, Tecnologia"' style="width:100%;padding:10px 13px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;resize:vertical"></textarea>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#1a2744;margin-bottom:6px">Temporització Total</label>
          <input id="sa-temporitzacio" type="text" placeholder='Ex: "6 sessions de 50 minuts (3 setmanes)"' style="width:100%;padding:10px 13px;border:1.5px solid #e4e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none">
        </div>
      </div>`;

    // Inserim just després del primer card (dades bàsiques)
    targetCard.parentNode.insertBefore(section, targetCard.nextSibling);

    // Botó generar amb IA
    document.getElementById('sa-ia-btn').onclick = generateSAWithAI;
  }

  // ── GENERA SA AMB IA ─────────────────────────────────────────────
  async function generateSAWithAI() {
    const btn = document.getElementById('sa-ia-btn');
    const rs = getAppState();
    const titol = rs?.titol || document.querySelector('input[type=text]')?.value || '';
    const assignatura = rs?.assignatura || '';
    const nivell = rs?.nivell || '';
    const justificacio = rs?.justificacio || '';

    if (!titol && !justificacio) {
      alert('Omple primer el títol de la unitat i la justificació.');
      return;
    }

    btn.textContent = '⏳ Generant...';
    btn.disabled = true;

    try {
      const prompt = `Ets un expert en didàctica i en la LOMLOE aplicada a la Comunitat Valenciana (Decret 107/2022).

Genera una Situació d'Aprenentatge completa per a la següent unitat didàctica:
- Títol: ${titol}
- Assignatura: ${assignatura}
- Nivell: ${nivell}r ESO
- Justificació: ${justificacio}

Respon ÚNICAMENT en format JSON (sense cap text addicional ni backticks), amb exactament aquestes claus:
{
  "titolSA": "Títol evocador i motivador per a l'alumnat",
  "narrativa": "Context motivador de 3-4 frases que connecta amb la vida real de l'alumnat",
  "repte": "Pregunta guia o repte principal que orienta tota la unitat",
  "producte": "Descripció del producte o tasca final que ha de crear l'alumnat",
  "connexio": "Com es connecta amb situacions reals fora de l'aula (2-3 frases)",
  "arees": "Assignatures i àrees implicades en la SA",
  "temporitzacio": "Nombre de sessions i durada aproximada"
}

Escriu tot en VALENCIÀ. Sigues concret, pràctic i adequat per a ${nivell}r d'ESO.`;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 800 })
      });
      const result = await response.json();
      const text = result.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (parsed.titolSA)       { const el = document.getElementById('sa-titol');         if(el) el.value = parsed.titolSA; }
      if (parsed.narrativa)     { const el = document.getElementById('sa-narrativa');     if(el) el.value = parsed.narrativa; }
      if (parsed.repte)         { const el = document.getElementById('sa-repte');         if(el) el.value = parsed.repte; }
      if (parsed.producte)      { const el = document.getElementById('sa-producte');      if(el) el.value = parsed.producte; }
      if (parsed.connexio)      { const el = document.getElementById('sa-connexio');      if(el) el.value = parsed.connexio; }
      if (parsed.arees)         { const el = document.getElementById('sa-arees');         if(el) el.value = parsed.arees; }
      if (parsed.temporitzacio) { const el = document.getElementById('sa-temporitzacio'); if(el) el.value = parsed.temporitzacio; }

    } catch(e) {
      alert('Error generant la SA: ' + e.message);
    } finally {
      btn.textContent = '✨ Generar amb IA';
      btn.disabled = false;
    }
  }

  // ── NETEJA HTML → TEXT PLA ───────────────────────────────────────
  function htmlToText(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d.innerText || d.textContent || '';
  }

  // ── GENERA PPTX ──────────────────────────────────────────────────
  function generatePptx(data) {
    const pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';
    pptx.title = data.titol || 'Unitat Didàctica';

    const NAVY   = '1a2744';
    const GOLD   = 'c8960c';
    const WHITE  = 'FFFFFF';
    const LIGHT  = 'f5f4f0';
    const COLORS = ['1a2744','c1272d','2d6a4f','6d3a8a','b5461e','1a5f7a'];

    // ── PORTADA ──
    const cover = pptx.addSlide();
    cover.background = { color: NAVY };
    cover.addShape(pptx.ShapeType.rect, { x:0, y:0, w:'100%', h:'100%', fill:{ color: NAVY } });
    // Línia daurada
    cover.addShape(pptx.ShapeType.rect, { x:0.5, y:4.2, w:0.8, h:0.08, fill:{ color: GOLD } });
    // Títol
    cover.addText(data.titol || 'Unitat Didàctica', {
      x:0.5, y:1.0, w:8.5, h:2.5,
      fontSize:36, bold:true, color:WHITE,
      fontFace:'Georgia', valign:'middle', align:'left', wrap:true
    });
    // Subtítol
    const sub = [data.assignatura, data.nivell ? data.nivell+"r d'ESO" : ''].filter(Boolean).join('  ·  ');
    if (sub) cover.addText(sub, {
      x:0.5, y:3.8, w:8.5, h:0.4,
      fontSize:14, color:'aab4c8', align:'left'
    });
    // Decret
    cover.addText('Decret 107/2022 · LOMLOE · Comunitat Valenciana', {
      x:0.5, y:4.9, w:8.5, h:0.3,
      fontSize:10, color:'667788', align:'left', italic:true
    });
    // Data
    cover.addText(new Date().toLocaleDateString('ca-ES',{year:'numeric',month:'long',day:'numeric'}), {
      x:0.5, y:5.3, w:8.5, h:0.3,
      fontSize:10, color:'556677', align:'left'
    });

    // ── DIAPOSITIVA SA ──
    if (data.sa && Object.values(data.sa).some(v=>v)) {
      const saSlide = pptx.addSlide();
      saSlide.background = { color: 'fef9eb' };
      saSlide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.15, h:'100%', fill:{ color: GOLD } });
      saSlide.addText('SITUACIÓ D\'APRENENTATGE · LOMLOE', {
        x:0.3, y:0.12, w:9.2, h:0.3,
        fontSize:9, bold:true, color:'7a5c00', align:'left', charSpacing:2
      });
      if (data.sa.titolSA) saSlide.addText(data.sa.titolSA, {
        x:0.3, y:0.45, w:9.2, h:0.7,
        fontSize:22, bold:true, color:NAVY, fontFace:'Georgia', align:'left', wrap:true
      });
      const saFields = [
        data.sa.repte     ? `❓ Repte: ${data.sa.repte}` : null,
        data.sa.producte  ? `🏆 Producte: ${data.sa.producte}` : null,
        data.sa.connexio  ? `🌍 Connexió: ${data.sa.connexio}` : null,
        data.sa.arees     ? `📚 Àrees: ${data.sa.arees}` : null,
        data.sa.temporitzacio ? `🕐 Temporització: ${data.sa.temporitzacio}` : null,
      ].filter(Boolean);
      if (data.sa.narrativa) saSlide.addText(data.sa.narrativa, {
        x:0.3, y:1.2, w:9.2, h:1.0,
        fontSize:13, color:'444444', italic:true, align:'left', wrap:true, lineSpacingMultiple:1.3
      });
      if (saFields.length) saSlide.addText(
        saFields.map(f => ({ text: f+'\n', options:{ fontSize:12, color:'2c2c2c', paraSpaceAfter:5 } })),
        { x:0.3, y:2.35, w:9.2, h:3.2, valign:'top', align:'left', wrap:true, lineSpacingMultiple:1.4 }
      );
    }

    // ── SESSIÓ: DIAPOSITIVA TÍTOL + CONTINGUT ──
    data.sessions.forEach((s, i) => {
      const color = COLORS[i % COLORS.length];
      const textPlain = htmlToText(s.contingut);
      const paragrafs = textPlain.split('\n').filter(p => p.trim());

      // Diapositiva de títol de sessió
      const titleSlide = pptx.addSlide();
      titleSlide.background = { color: color };
      // Cercle decoratiu
      titleSlide.addShape(pptx.ShapeType.ellipse, {
        x:7.5, y:-1.0, w:3.5, h:3.5,
        fill:{ color: WHITE, transparency:90 }
      });
      // Badge
      titleSlide.addText(`SESSIÓ ${s.idx}`, {
        x:0.5, y:1.5, w:3, h:0.35,
        fontSize:10, bold:true, color:WHITE,
        align:'left', charSpacing:3
      });
      // Títol sessió
      titleSlide.addText(s.nom, {
        x:0.5, y:1.9, w:8.5, h:1.5,
        fontSize:32, bold:true, color:WHITE,
        fontFace:'Georgia', valign:'top', align:'left', wrap:true
      });
      // Objectiu
      if (s.objectius) {
        titleSlide.addText(s.objectius, {
          x:0.5, y:3.6, w:8.5, h:0.8,
          fontSize:13, color:WHITE, italic:true,
          align:'left', wrap:true, transparency:20
        });
      }

      // Diapositives de contingut (màx 200 paraules per diapositiva)
      const WORDS_PER_SLIDE = 120;
      let buffer = [], wordCount = 0;
      const flushSlide = (paras) => {
        if (!paras.length) return;
        const slide = pptx.addSlide();
        slide.background = { color: LIGHT };
        // Franja de color al costat esquerre
        slide.addShape(pptx.ShapeType.rect, {
          x:0, y:0, w:0.12, h:'100%', fill:{ color: color }
        });
        // Nom de la sessió petit
        slide.addText(s.nom, {
          x:0.25, y:0.15, w:9, h:0.3,
          fontSize:9, color:color, bold:true, align:'left', charSpacing:1
        });
        // Contingut
        slide.addText(paras.map(p => ({ text: p+'\n', options:{ fontSize:14, color:'2c2c2c', paraSpaceAfter:6 } })), {
          x:0.25, y:0.55, w:9.2, h:4.9,
          valign:'top', align:'left', wrap:true, lineSpacingMultiple:1.3
        });
      };

      paragrafs.forEach(p => {
        const wc = p.split(' ').length;
        if (wordCount + wc > WORDS_PER_SLIDE && buffer.length) {
          flushSlide(buffer);
          buffer = []; wordCount = 0;
        }
        buffer.push(p);
        wordCount += wc;
      });
      if (buffer.length) flushSlide(buffer);

      // Diapositiva d'exercicis
      if (s.exercicis && s.exercicis.trim()) {
        const exerLines = s.exercicis.split('\n').filter(e => e.trim())
          .map(e => e.replace(/^\d+[\.\)]\s*/, ''));
        const exSlide = pptx.addSlide();
        exSlide.background = { color: LIGHT };
        exSlide.addShape(pptx.ShapeType.rect, {
          x:0, y:0, w:0.12, h:'100%', fill:{ color: color }
        });
        exSlide.addText('✏️  Exercicis i activitats', {
          x:0.25, y:0.15, w:9, h:0.4,
          fontSize:13, bold:true, color:color, align:'left'
        });
        const exItems = exerLines.map((e, ei) => [
          { text:`${ei+1}.  `, options:{ bold:true, color:color, fontSize:13 } },
          { text:e+'\n', options:{ color:'2c2c2c', fontSize:13, paraSpaceAfter:8 } }
        ]).flat();
        exSlide.addText(exItems, {
          x:0.25, y:0.7, w:9.2, h:4.7,
          valign:'top', align:'left', wrap:true, lineSpacingMultiple:1.4
        });
      }
    });

    // Descarrega
    pptx.writeFile({ fileName: (data.titol||'unitat').replace(/[^\w\s\-]/g,'').trim()+'_canva.pptx' });
  }

  // ── GENERA HTML DE PRESENTACIÓ ───────────────────────────────────
  function generateHTML(data) {
    const { titol, assignatura, nivell, justificacio, sessions } = data;
    const nivellText = nivell ? `${nivell}r d'ESO` : '';
    const date = new Date().toLocaleDateString('ca-ES', {year:'numeric',month:'long',day:'numeric'});
    const COLORS = ['#1a2744','#c1272d','#2d6a4f','#6d3a8a','#b5461e','#1a5f7a'];

    const cleanHTML = (html) => {
      if (!html) return '';
      if (!html.includes('<')) return html.split('\n').filter(p=>p.trim()).map(p=>`<p>${p}</p>`).join('');
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      tmp.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
      tmp.querySelectorAll('[data-ud-img],[data-ud-link]').forEach(el=>{
        el.removeAttribute('data-ud-img'); el.removeAttribute('data-ud-link');
      });
      // Convertim iframes de YouTube en targetes clicables (funciona en fitxers locals)
      tmp.querySelectorAll('.ud-video-wrap, [data-ud-vid]').forEach(wrap => {
        const iframe = wrap.querySelector('iframe');
        const caption = wrap.querySelector('.ud-video-caption');
        if (!iframe) return;
        const src = iframe.src || '';
        const vidId = (src.match(/\/embed\/([a-zA-Z0-9_-]{11})/) || [])[1];
        if (!vidId) return;
        const capText = caption ? caption.textContent.replace('▶','').trim() : 'Veure vídeo a YouTube';
        const thumb = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
        const ytUrl = `https://www.youtube.com/watch?v=${vidId}`;
        wrap.outerHTML = `<div class="yt-card">
          <a href="${ytUrl}" target="_blank" class="yt-link">
            <div class="yt-thumb-wrap">
              <img src="${thumb}" class="yt-thumb" alt="${capText}">
              <div class="yt-play"><svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C0 13.05 0 24 0 24s0 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C68 34.95 68 24 68 24s0-10.95-1.48-16.26z" fill="#f00"/><path d="M45 24 27 14v20" fill="#fff"/></svg></div>
            </div>
            <div class="yt-caption">${capText}</div>
          </a>
        </div>`;
      });
      return tmp.innerHTML;
    };

    const tabBtns = sessions.map((s,i)=>
      `<button class="tab-btn${i===0?' act':''}" onclick="showTab(${i})" style="padding:10px 18px;border:none;background:${i===0?COLORS[0]:'transparent'};color:${i===0?'white':'#555'};cursor:pointer;font-size:14px;font-weight:600;font-family:inherit;border-bottom:3px solid ${i===0?COLORS[0]:'transparent'};transition:all .2s">${s.nom}</button>`
    ).join('');

    const tabPanels = sessions.map((s,i)=>{
      const color = COLORS[i % COLORS.length];
      const light = color + '18';
      const cHTML = cleanHTML(s.contingut);
      const exHTML = s.exercicis
        ? s.exercicis.split('\n').filter(e=>e.trim()).map((e,ei)=>
            `<div class="ex-row"><div class="ex-n" style="background:${color}">${ei+1}</div><div class="ex-t">${e.replace(/^\d+[\.\)]\s*/,'')}</div></div>`
          ).join('') : '';
      return `<div class="tab-panel" id="tab-${i}" style="display:${i===0?'block':'none'}">
        <div class="sess-body">
          <div class="sess-text">${cHTML}</div>
          ${exHTML?`<div class="exer-box" style="margin-top:26px;background:${light};border-radius:12px;padding:18px 22px;border-left:4px solid ${color}"><div class="exer-hdr" style="font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.8px;color:${color};margin-bottom:14px">✏️ Exercicis i activitats</div>${exHTML}</div>`:''}
        </div>
      </div>`;
    }).join('');

    const saHTML = data.sa && Object.values(data.sa).some(v=>v) ? `
<div class="sa-section">
  <div class="sa-header"><div class="sa-icon">🎯</div><div>
    <div class="sa-label">Situació d'Aprenentatge</div>
    <h2 class="sa-title">${data.sa.titolSA||''}</h2>
  </div></div>
  <div class="sa-grid">
    ${data.sa.narrativa?`<div class="sa-item sa-full"><div class="sa-item-label">📖 Narrativa</div><p>${data.sa.narrativa}</p></div>`:''}
    ${data.sa.repte?`<div class="sa-item"><div class="sa-item-label">❓ Repte</div><p>${data.sa.repte}</p></div>`:''}
    ${data.sa.producte?`<div class="sa-item"><div class="sa-item-label">🏆 Producte final</div><p>${data.sa.producte}</p></div>`:''}
    ${data.sa.connexio?`<div class="sa-item"><div class="sa-item-label">🌍 Connexió real</div><p>${data.sa.connexio}</p></div>`:''}
    ${data.sa.arees?`<div class="sa-item"><div class="sa-item-label">📚 Àrees</div><p>${data.sa.arees}</p></div>`:''}
    ${data.sa.temporitzacio?`<div class="sa-item"><div class="sa-item-label">🕐 Temporització</div><p>${data.sa.temporitzacio}</p></div>`:''}
  </div>
</div>` : '';

    return `<!DOCTYPE html>
<html lang="ca"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titol||'Unitat Didàctica'}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Source Sans 3',sans-serif;background:#f5f4f0;color:#1e1e1e;font-size:16px;line-height:1.7}
.cover{background:#1a2744;color:white;padding:40px 48px 36px;position:relative;overflow:hidden}
.cover::before{content:'';position:absolute;top:-60px;right:-60px;width:300px;height:300px;border-radius:50%;background:rgba(200,150,12,.12)}
.cover-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:12px}
.cover-title{font-family:'Playfair Display',serif;font-size:clamp(24px,5vw,48px);font-weight:900;line-height:1.15;margin-bottom:16px;max-width:700px}
.cover-line{width:50px;height:4px;background:#c8960c;margin-bottom:16px}
.cover-pills{display:flex;gap:10px;flex-wrap:wrap}
.cover-pill{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:100px;padding:4px 14px;font-size:12px;font-weight:500}
.cover-date{color:rgba(255,255,255,.3);font-size:11px;margin-top:14px}
.just{background:white;border-left:5px solid #c8960c;margin:24px 40px;padding:16px 20px;border-radius:0 8px 8px 0;font-size:15px;color:#555;font-style:italic}
.main-wrap{max-width:900px;margin:0 auto;padding:24px 32px}
.tab-nav{display:flex;flex-wrap:wrap;border-bottom:2px solid #e0ddd6;margin-bottom:0;background:white;border-radius:12px 12px 0 0;overflow:hidden;border:1px solid #e0ddd6;border-bottom:none}
.tab-body{background:white;border:1px solid #e0ddd6;border-top:none;border-radius:0 0 12px 12px;overflow:hidden;margin-bottom:24px}
.sess-body{padding:28px 32px}
.sess-text{font-size:15px;line-height:1.85;color:#2c2c2c}
.sess-text p{margin-bottom:13px}
.sess-text p:last-child{margin-bottom:0}
.sess-text::after{content:'';display:table;clear:both}
.sess-text img{border-radius:8px;border:1px solid #e4e8f0}
.sess-text strong{font-weight:700}
.sess-text em{font-style:italic}
.sess-text u{text-decoration:underline}
.sess-text a{color:#1a2744;font-weight:600;text-decoration:underline}
.ud-video-wrap{margin:16px 0;border-radius:10px;overflow:hidden;border:1px solid #e4e8f0;clear:both}
.ud-video-wrap iframe{width:100%;height:260px;border:none;display:block}
.ud-video-caption{background:#1a2744;color:white;font-size:12px;padding:6px 12px;text-align:center}
.yt-card{margin:16px 0;clear:both}
.yt-link{display:block;text-decoration:none;border-radius:10px;overflow:hidden;border:1px solid #e4e8f0;transition:box-shadow .2s}
.yt-link:hover{box-shadow:0 4px 16px rgba(0,0,0,.15)}
.yt-thumb-wrap{position:relative;background:#000;overflow:hidden;max-height:280px}
.yt-thumb{width:100%;display:block;opacity:.92}
.yt-link:hover .yt-thumb{opacity:1}
.yt-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);transition:transform .2s}
.yt-link:hover .yt-play{transform:translate(-50%,-50%) scale(1.1)}
.yt-caption{background:#1a2744;color:white;font-size:13px;font-weight:500;padding:8px 14px;text-align:center}
.ex-row{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start}
.ex-n{min-width:26px;height:26px;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px}
.ex-t{font-size:14px;color:#2c2c2c;line-height:1.6;flex:1}
.sa-section{background:white;border-radius:12px;border-left:6px solid #c8960c;overflow:hidden;margin-bottom:24px;border:1px solid #e0ddd6;border-left-width:6px}
.sa-header{display:flex;align-items:flex-start;gap:14px;padding:20px 24px 14px;border-bottom:1px solid #f0ede4;background:#fef9eb}
.sa-icon{font-size:28px;flex-shrink:0}
.sa-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#7a5c00;margin-bottom:5px}
.sa-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#1a2744}
.sa-grid{display:grid;grid-template-columns:1fr 1fr}
.sa-item{padding:14px 20px;border-bottom:1px solid #f0ede4;border-right:1px solid #f0ede4}
.sa-item:nth-child(even){border-right:none}
.sa-full{grid-column:1/-1;border-right:none}
.sa-item-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#7a5c00;margin-bottom:6px}
.sa-item p{font-size:13px;color:#2c2c2c;line-height:1.6}
.footer{text-align:center;padding:20px;font-size:11px;color:#bbb;border-top:1px solid #e8e6e0}
@media(max-width:600px){.cover{padding:28px 20px 24px}.main-wrap{padding:16px}.tab-nav button{font-size:12px;padding:8px 12px}.sa-grid{grid-template-columns:1fr}.sa-item{border-right:none}}
@media print{body{background:white}.tab-panel{display:block!important}.tab-nav{display:none}}
</style></head><body>
<div class="cover">
  <div class="cover-label">${[assignatura,nivellText].filter(Boolean).join(' · ')}</div>
  <h1 class="cover-title">${titol||'Unitat Didàctica'}</h1>
  <div class="cover-line"></div>
  <div class="cover-pills">
    <span class="cover-pill">${sessions.length} sessions</span>
  </div>
</div>
<div class="main-wrap">
${saHTML}
${justificacio?`<div class="just">${justificacio}</div>`:''}
<div class="tab-nav">${tabBtns}</div>
<div class="tab-body">${tabPanels}</div>
<div class="footer">${titol||'Unitat Didàctica'} · ${[assignatura,nivellText].filter(Boolean).join(' · ')}</div>
</div>
<script>
function showTab(n){
  document.querySelectorAll('.tab-panel').forEach((p,i)=>p.style.display=i===n?'block':'none');
  document.querySelectorAll('.tab-btn').forEach((b,i)=>{
    const colors=${JSON.stringify(COLORS)};
    b.style.background=i===n?colors[i%colors.length]:'transparent';
    b.style.color=i===n?'white':'#555';
    b.style.borderBottom='3px solid '+(i===n?colors[i%colors.length]:'transparent');
  });
}
<\/script>
</body></html>`;
  }

  // ── MODIFICA LA CAPÇALERA ────────────────────────────────────────
  function setupHeader() {
    const container = document.querySelector('.header-actions');
    if (!container) return;

    // 1. Elimina el botó "App HTML"
    container.querySelectorAll('a, button').forEach(el => {
      if (el.textContent?.includes('App HTML')) el.remove();
    });

    // 2. Botó HTML Presentació
    if (!document.getElementById('ud-html-btn')) {
      const btnHTML = document.createElement('button');
      btnHTML.id = 'ud-html-btn';
      btnHTML.className = 'btn btn-sm btn-outline header-btn';
      btnHTML.textContent = '🌐 HTML Alumnes';
      btnHTML.onclick = () => {
        const data = collectData();
        if (!data.sessions.length) { alert('Genera el contingut de les sessions primer.'); return; }
        const html = generateHTML(data);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (data.titol||'unitat').replace(/[^\w\s\-]/g,'').trim()+'_alumnes.html';
        a.click();
        URL.revokeObjectURL(url);
      };
      container.appendChild(btnHTML);
    }

    // 3. Botó Canva (PPTX)
    if (!document.getElementById('ud-canva-btn')) {
      const btnCanva = document.createElement('button');
      btnCanva.id = 'ud-canva-btn';
      btnCanva.className = 'btn btn-sm btn-outline header-btn';
      btnCanva.textContent = '🎨 Exportar a Canva';
      btnCanva.style.cssText = 'border-color:#7c3aed;color:#7c3aed';
      btnCanva.onmouseover = () => { btnCanva.style.background='#7c3aed'; btnCanva.style.color='white'; };
      btnCanva.onmouseout  = () => { btnCanva.style.background=''; btnCanva.style.color='#7c3aed'; };
      btnCanva.onclick = () => {
        const data = collectData();
        if (!data.sessions.length) { alert('Genera el contingut de les sessions primer.'); return; }
        btnCanva.textContent = '⏳ Generant...';
        btnCanva.disabled = true;
        loadPptxGen(() => {
          try {
            generatePptx(data);
            setTimeout(() => {
              btnCanva.textContent = '🎨 Exportar a Canva';
              btnCanva.disabled = false;
            }, 1500);
          } catch(e) {
            alert('Error generant el PPTX: ' + e.message);
            btnCanva.textContent = '🎨 Exportar a Canva';
            btnCanva.disabled = false;
          }
        });
      };
      container.appendChild(btnCanva);
    }
  }

  // ── BARRA D'EINES MEDIA ──────────────────────────────────────────
  const css = `
    .ud-toolbar{display:flex;gap:5px;flex-wrap:wrap;padding:6px 8px;background:#f0f4ff;border:1.5px solid #c8d0e8;border-bottom:none;border-radius:8px 8px 0 0;align-items:center}
    .ud-toolbar button{padding:5px 10px;border:1px solid #c8d0e8;border-radius:6px;background:white;font-size:12px;font-family:inherit;cursor:pointer;color:#1a2744;font-weight:600}
    .ud-toolbar button:hover{background:#e0e8ff}
    .ud-editor{width:100%;min-height:400px;padding:16px;border:1.5px solid #c8d0e8;border-radius:0 0 8px 8px;font-family:inherit;font-size:15px;line-height:1.85;outline:none;background:#fffdf5;overflow-y:auto}
    .ud-editor:focus{border-color:#1a2744;box-shadow:0 0 0 3px #1a274414}
    .ud-editor p{margin-bottom:12px}
    .ud-img-wrap-outer{position:relative!important;display:inline-block}
    .ud-img-controls{position:absolute;top:4px;left:4px;z-index:100;display:flex;gap:2px;background:rgba(26,39,68,0.85);border-radius:7px;padding:3px 4px}
    .ud-img-ctrl-btn{border:none;background:rgba(255,255,255,0.15);color:white;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;line-height:1}
    .ud-img-ctrl-btn:hover{background:rgba(255,255,255,0.4)}
    .ud-img-del{background:rgba(193,39,45,0.85)!important}
    .ud-img-del:hover{background:#c1272d!important}
    .ud-vid-controls{display:none;position:absolute;top:8px;right:8px;z-index:10;display:none;gap:4px;background:rgba(26,39,68,0.85);border-radius:8px;padding:4px 6px;align-items:center}
    .ud-video-hover:hover .ud-vid-controls{display:flex}
    .ud-vid-move,.ud-del-btn-inline{border:none;border-radius:5px;padding:4px 8px;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit}
    .ud-vid-move{background:rgba(255,255,255,0.15);color:white}
    .ud-vid-move:hover{background:rgba(255,255,255,0.3)}
    .ud-del-btn-inline{background:rgba(193,39,45,0.8);color:white}
    .ud-del-btn-inline:hover{background:#c1272d}
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
  document.head.appendChild(Object.assign(document.createElement('style'), {textContent:css}));

  function ytId(url) {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  function modal(title, fields, onOk) {
    const bg = document.createElement('div'); bg.className='ud-modal-bg';
    bg.innerHTML=`<div class="ud-modal"><h3>${title}</h3>${fields.map(f=>`<label>${f.label}</label><input id="udf-${f.id}" placeholder="${f.ph}">`).join('')}<div class="ud-modal-btns"><button class="ud-btn-cancel">Cancel·lar</button><button class="ud-btn-ok">Inserir</button></div></div>`;
    document.body.appendChild(bg);
    bg.querySelector('.ud-btn-cancel').onclick=()=>bg.remove();
    bg.querySelector('.ud-btn-ok').onclick=()=>{
      const vals=Object.fromEntries(fields.map(f=>[f.id,document.getElementById('udf-'+f.id).value.trim()]));
      bg.remove(); onOk(vals);
    };
    bg.onclick=e=>{if(e.target===bg)bg.remove();};
    setTimeout(()=>document.getElementById('udf-'+fields[0].id)?.focus(),50);
  }

  // Modal avançat per a imatges
  function imageModal(onOk) {
    const bg = document.createElement('div'); bg.className='ud-modal-bg';
    bg.innerHTML=`
    <div class="ud-modal" style="max-width:500px">
      <h3>Inserir imatge</h3>
      <label>URL de la imatge</label>
      <input id="udf-img-url" placeholder="https://upload.wikimedia.org/..." style="margin-bottom:6px">
      <label>Peu de foto (opcional)</label>
      <input id="udf-img-cap" placeholder="Ex: Violí barroc, segle XVIII" style="margin-bottom:14px">
      <label>Posició</label>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="img-pos-btn active" data-pos="center" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid #1a2744;background:#eef2ff;cursor:pointer;font-size:12px;font-weight:600;color:#1a2744">
          ↕ Centrada<br><span style="font-weight:400;font-size:11px">Text dalt i baix</span>
        </button>
        <button class="img-pos-btn" data-pos="left" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid #ddd;background:white;cursor:pointer;font-size:12px;font-weight:600;color:#555">
          ← Esquerra<br><span style="font-weight:400;font-size:11px">Text a la dreta</span>
        </button>
        <button class="img-pos-btn" data-pos="right" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid #ddd;background:white;cursor:pointer;font-size:12px;font-weight:600;color:#555">
          Dreta →<br><span style="font-weight:400;font-size:11px">Text a l'esquerra</span>
        </button>
      </div>
      <label>Mida</label>
      <div style="display:flex;gap:8px;margin-bottom:18px">
        <button class="img-size-btn" data-size="25" style="flex:1;padding:7px;border-radius:8px;border:1.5px solid #ddd;background:white;cursor:pointer;font-size:12px;font-weight:600;color:#555">Petita<br><span style="font-weight:400;font-size:11px">25%</span></button>
        <button class="img-size-btn active" data-size="40" style="flex:1;padding:7px;border-radius:8px;border:1.5px solid #1a2744;background:#eef2ff;cursor:pointer;font-size:12px;font-weight:600;color:#1a2744">Mitjana<br><span style="font-weight:400;font-size:11px">40%</span></button>
        <button class="img-size-btn" data-size="60" style="flex:1;padding:7px;border-radius:8px;border:1.5px solid #ddd;background:white;cursor:pointer;font-size:12px;font-weight:600;color:#555">Gran<br><span style="font-weight:400;font-size:11px">60%</span></button>
        <button class="img-size-btn" data-size="100" style="flex:1;padding:7px;border-radius:8px;border:1.5px solid #ddd;background:white;cursor:pointer;font-size:12px;font-weight:600;color:#555">Completa<br><span style="font-weight:400;font-size:11px">100%</span></button>
      </div>
      <div class="ud-modal-btns">
        <button class="ud-btn-cancel">Cancel·lar</button>
        <button class="ud-btn-ok">Inserir imatge</button>
      </div>
    </div>`;
    document.body.appendChild(bg);

    let selPos = 'center', selSize = '40';

    // Botons posició
    bg.querySelectorAll('.img-pos-btn').forEach(btn => {
      btn.onclick = () => {
        selPos = btn.dataset.pos;
        bg.querySelectorAll('.img-pos-btn').forEach(b => {
          b.style.border='1.5px solid #ddd'; b.style.background='white'; b.style.color='#555';
        });
        btn.style.border='1.5px solid #1a2744'; btn.style.background='#eef2ff'; btn.style.color='#1a2744';
      };
    });

    // Botons mida
    bg.querySelectorAll('.img-size-btn').forEach(btn => {
      btn.onclick = () => {
        selSize = btn.dataset.size;
        bg.querySelectorAll('.img-size-btn').forEach(b => {
          b.style.border='1.5px solid #ddd'; b.style.background='white'; b.style.color='#555';
        });
        btn.style.border='1.5px solid #1a2744'; btn.style.background='#eef2ff'; btn.style.color='#1a2744';
      };
    });

    bg.querySelector('.ud-btn-cancel').onclick = () => bg.remove();
    bg.querySelector('.ud-btn-ok').onclick = () => {
      const url = document.getElementById('udf-img-url').value.trim();
      const cap = document.getElementById('udf-img-cap').value.trim();
      bg.remove();
      if (url) onOk({ url, cap, pos: selPos, size: selSize });
    };
    bg.onclick = e => { if (e.target===bg) bg.remove(); };
    setTimeout(() => document.getElementById('udf-img-url')?.focus(), 50);
  }

  function insertImageFromSrc(editor, src, name, syncFn) {
    // Inserim la imatge centrada per defecte al 50%
    const wrap = document.createElement('div');
    wrap.setAttribute('data-ud-img','1');
    wrap.className='ud-img-wrap-outer';
    wrap.contentEditable='false';
    wrap.style.cssText='text-align:center;clear:both;margin:14px 0;position:relative;display:block;';

    const controls = document.createElement('div');
    controls.className='ud-img-controls';
    controls.innerHTML=`
      <button class="ud-img-ctrl-btn" data-action="up" title="Moure amunt">↑</button>
      <button class="ud-img-ctrl-btn" data-action="down" title="Moure avall">↓</button>
      <button class="ud-img-ctrl-btn" data-action="smaller" title="Reduir">−</button>
      <button class="ud-img-ctrl-btn" data-action="bigger" title="Ampliar">+</button>
      <button class="ud-img-ctrl-btn" data-action="left" title="Esquerra">←</button>
      <button class="ud-img-ctrl-btn" data-action="center" title="Centrada">↕</button>
      <button class="ud-img-ctrl-btn" data-action="right" title="Dreta">→</button>
      <button class="ud-img-ctrl-btn ud-img-del" data-action="del" title="Eliminar">🗑</button>`;

    const img = document.createElement('img');
    img.src = src;
    img.alt = name || '';
    img.style.cssText='max-width:50%;border-radius:8px;border:1px solid #e4e8f0;display:inline-block;';

    wrap.appendChild(controls);
    wrap.appendChild(img);

    // Afegim event listener directament als botons (no delegació)
    controls.querySelectorAll('.ud-img-ctrl-btn').forEach(btn=>{
      btn.addEventListener('mousedown', ev=>{
        ev.preventDefault(); ev.stopPropagation();
        const action = btn.dataset.action;
        const curSz = parseFloat(img.style.maxWidth||img.style.width||'50')||50;
        if(action==='del'){
          let t=wrap;
          while(t&&t.parentElement&&t.parentElement!==editor)t=t.parentElement;
          const p=document.createElement('p');p.innerHTML='<br>';
          if(t&&t!==editor){t.after(p);t.remove();}else{wrap.remove();}
          setTimeout(syncFn,50); return;
        }
        if(action==='smaller'){const ns=Math.max(10,curSz-10)+'%';img.style.maxWidth=ns;img.style.width=ns;}
        if(action==='bigger'){const ns=Math.min(100,curSz+10)+'%';img.style.maxWidth=ns;img.style.width=ns;}
        if(action==='left'){
          wrap.style.cssText='overflow:hidden;margin:4px 0 12px;position:relative;display:block;';
          img.style.cssText=`width:${curSz}%;float:left;margin:0 18px 12px 0;border-radius:8px;border:1px solid #e4e8f0;`;
        }
        if(action==='right'){
          wrap.style.cssText='overflow:hidden;margin:4px 0 12px;position:relative;display:block;';
          img.style.cssText=`width:${curSz}%;float:right;margin:0 0 12px 18px;border-radius:8px;border:1px solid #e4e8f0;`;
        }
        if(action==='center'){
          wrap.style.cssText='text-align:center;clear:both;margin:14px 0;position:relative;display:block;';
          img.style.cssText=`max-width:${curSz}%;display:inline-block;float:none;border-radius:8px;border:1px solid #e4e8f0;`;
        }
        if(action==='up'){
          let t=wrap;while(t&&t.parentElement!==editor)t=t.parentElement;
          if(t?.previousElementSibling)editor.insertBefore(t,t.previousElementSibling);
        }
        if(action==='down'){
          let t=wrap;while(t&&t.parentElement!==editor)t=t.parentElement;
          if(t?.nextElementSibling)editor.insertBefore(t.nextElementSibling,t);
        }
        setTimeout(syncFn,50);
      });
    });

    // Inserim al cursor actual o al final
    const sel=window.getSelection();
    if(sel.rangeCount&&editor.contains(sel.anchorNode)){
      const range=sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrap);
      const p=document.createElement('p');p.innerHTML='<br>';
      wrap.after(p);
      range.setStartAfter(p);range.collapse(true);
      sel.removeAllRanges();sel.addRange(range);
    }else{
      editor.appendChild(wrap);
      const p=document.createElement('p');p.innerHTML='<br>';
      editor.appendChild(p);
    }
    setTimeout(syncFn,50);
  }

  function buildImageHTML(url, cap, pos, size) {
    const sz = size || '40';
    const controls = `<div class="ud-img-controls" contenteditable="false">
      <button class="ud-img-ctrl-btn" data-action="up">↑</button>
      <button class="ud-img-ctrl-btn" data-action="down">↓</button>
      <button class="ud-img-ctrl-btn" data-action="smaller">−</button>
      <button class="ud-img-ctrl-btn" data-action="bigger">+</button>
      <button class="ud-img-ctrl-btn" data-action="left">←</button>
      <button class="ud-img-ctrl-btn" data-action="center">↕</button>
      <button class="ud-img-ctrl-btn" data-action="right">→</button>
      <button class="ud-img-ctrl-btn ud-img-del" data-action="del">🗑</button>
    </div>`;
    if (pos === 'center') {
      return `<div data-ud-img="1" class="ud-img-wrap-outer" style="text-align:center;clear:both;margin:14px 0;position:relative;" contenteditable="false">${controls}<img src="${url}" alt="${cap||''}" style="max-width:${sz}%;border-radius:8px;border:1px solid #e4e8f0;display:inline-block;">${cap?`<div style="font-size:11px;color:#888;font-style:italic;margin-top:4px">${cap}</div>`:''}</div><p><br></p>`;
    }
    const floatDir = pos === 'left' ? 'left' : 'right';
    const margin   = pos === 'left' ? '0 18px 12px 0' : '0 0 12px 18px';
    return `<div data-ud-img="1" class="ud-img-wrap-outer" style="overflow:hidden;margin:4px 0 12px;position:relative;" contenteditable="false">${controls}<img src="${url}" alt="${cap||''}" style="width:${sz}%;float:${floatDir};margin:${margin};border-radius:8px;border:1px solid #e4e8f0;">${cap?`<div style="font-size:11px;color:#888;text-align:${floatDir};font-style:italic;margin-top:3px">${cap}</div>`:''}</div><p style="clear:none"><br></p>`;
  }

  function insertHTML(editor, html, syncFn) {
    editor.focus();
    const sel=window.getSelection();
    if(editor.contains(sel.anchorNode)&&sel.rangeCount){
      const range=sel.getRangeAt(0); range.deleteContents();
      const tpl=document.createElement('div'); tpl.innerHTML=html;
      const frag=document.createDocumentFragment(); let last;
      while(tpl.firstChild) last=frag.appendChild(tpl.firstChild);
      range.insertNode(frag);
      if(last){const r=range.cloneRange();r.setStartAfter(last);r.collapse(true);sel.removeAllRanges();sel.addRange(r);}
    } else { editor.innerHTML+=html; }
    // Sincronitzem manualment perquè els canvis programàtics no disparen 'input'
    if (syncFn) setTimeout(syncFn, 50);
  }

  function makeToolbar(editor, syncFn) {
    const bar=document.createElement('div'); bar.className='ud-toolbar';

    // ── FORMAT TEXT ──
    const fmt = (cmd, val) => { document.execCommand(cmd, false, val); editor.focus(); setTimeout(syncFn, 50); };

    const bBold = document.createElement('button'); bBold.type='button'; bBold.title='Negreta';
    bBold.innerHTML='<strong>N</strong>'; bBold.onclick=()=>fmt('bold');

    const bItal = document.createElement('button'); bItal.type='button'; bItal.title='Cursiva';
    bItal.innerHTML='<em>C</em>'; bItal.onclick=()=>fmt('italic');

    const bUnder = document.createElement('button'); bUnder.type='button'; bUnder.title='Subratllat';
    bUnder.innerHTML='<u>S</u>'; bUnder.onclick=()=>fmt('underline');

    const szSel = document.createElement('select'); szSel.title='Mida de la font';
    szSel.style.cssText='padding:4px 6px;border:1px solid #c8d0e8;border-radius:6px;font-size:12px;background:white;color:#1a2744;cursor:pointer;height:28px';
    [['Petita','1'],['Normal','3'],['Gran','5'],['Molt gran','6']].forEach(([lbl,val])=>{
      const o=document.createElement('option'); o.value=val; o.textContent=lbl;
      if(val==='3') o.selected=true;
      szSel.appendChild(o);
    });
    szSel.onchange=()=>{fmt('fontSize',szSel.value); szSel.value='3';};

    const sep = ()=>{ const s=document.createElement('span'); s.style.cssText='width:1px;background:#c8d0e8;margin:0 2px;align-self:stretch'; return s; };

    // ── MEDIA ──
    const bVid=document.createElement('button'); bVid.type='button'; bVid.textContent='▶ YouTube';
    bVid.onclick=()=>modal('Inserir vídeo de YouTube',[
      {id:'url',label:'URL del vídeo',ph:'https://www.youtube.com/watch?v=...'},
      {id:'cap',label:'Títol (opcional)',ph:"Ex: Els instruments de l'orquestra"},
    ],({url,cap})=>{
      if(!url)return; const id=ytId(url);
      if(!id){alert('URL de YouTube no vàlida');return;}
      insertHTML(editor,`<div data-ud-vid="${id}" class="ud-video-hover ud-video-wrap" contenteditable="false" draggable="true"><div class="ud-vid-controls"><button class="ud-vid-move" data-dir="up" title="Moure amunt">↑</button><button class="ud-vid-move" data-dir="down" title="Moure avall">↓</button><button class="ud-del-btn-inline" title="Eliminar">🗑</button></div><iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0" allowfullscreen allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"></iframe>${cap?`<div class="ud-video-caption">▶ ${cap}</div>`:''}</div><p><br></p>`, syncFn);
    });

    // Botó imatge: obre selector de fitxer local O accepta enganxar
    const bImg=document.createElement('button'); bImg.type='button'; bImg.textContent='🖼 Imatge';
    bImg.title='Clica per triar una foto, o copia una imatge i prem Ctrl+V al quadre de text';
    bImg.onclick=()=>{
      const input=document.createElement('input');
      input.type='file'; input.accept='image/*';
      input.onchange=()=>{
        const file=input.files[0]; if(!file)return;
        const reader=new FileReader();
        reader.onload=ev=>{
          insertImageFromSrc(editor, ev.target.result, file.name, syncFn);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };

    const bLink=document.createElement('button'); bLink.type='button'; bLink.textContent='🔗 Enllaç';
    bLink.onclick=()=>modal('Inserir enllaç',[
      {id:'url',label:'URL',ph:'https://...'},
      {id:'txt',label:'Text de l\'enllaç',ph:'Ex: Més informació'},
    ],({url,txt})=>{
      if(!url)return;
      const label=txt||url;
      insertHTML(editor,`<a data-ud-link="1" href="${url}" target="_blank" style="color:#1a2744;font-weight:600;text-decoration:underline">${label}</a> `, syncFn);
    });

    [bBold,bItal,bUnder,szSel,sep(),bVid,bImg,bLink].forEach(el=>bar.appendChild(el));
    return bar;
  }
  function convertToEditor(textarea) {
    if(textarea.dataset.udDone)return; textarea.dataset.udDone='true';
    const editor=document.createElement('div'); editor.className='ud-editor'; editor.contentEditable='true';
    const init=textarea.value;
    editor.innerHTML=init?init.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join(''):'<p><br></p>';

    // Sincronitza innerHTML (preserva links, imatges i vídeos)
    // Usem el setter natiu per forçar que React detecte el canvi
    const nativeInputSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    const syncToTextarea = () => {
      if (nativeInputSetter) {
        nativeInputSetter.call(textarea, editor.innerHTML);
      } else {
        textarea.value = editor.innerHTML;
      }
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    };
    editor.addEventListener('input', syncToTextarea);

    // Enganxar imatges (Ctrl+V)
    editor.addEventListener('paste', ev=>{
      const items=[...(ev.clipboardData?.items||[])];
      const imgItem=items.find(it=>it.type.startsWith('image/'));
      if(!imgItem)return;
      ev.preventDefault();
      const file=imgItem.getAsFile();
      if(!file)return;
      const reader=new FileReader();
      reader.onload=e=>insertImageFromSrc(editor,e.target.result,'imatge',syncToTextarea);
      reader.readAsDataURL(file);
    });

    // Quan React actualitza el textarea externament (IA genera contingut)
    let lastVal=textarea.value;
    setInterval(()=>{
      if(textarea.value!==lastVal&&textarea.value!==editor.innerHTML){
        lastVal=textarea.value;
        // Si ve text pla (de la IA), convertim a paràgrafs
        const v=textarea.value;
        if(!v.includes('<')){
          editor.innerHTML=v.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('')||'<p><br></p>';
        } else {
          editor.innerHTML=v;
        }
      }
    },300);

    // Element seleccionat (imatge o video)
    let selectedEl = null;
    function selectElement(el) {
      if (selectedEl) { selectedEl.style.outline=''; selectedEl.style.boxShadow=''; }
      selectedEl = el;
      if (el) { el.style.outline='3px solid #c8960c'; el.style.boxShadow='0 0 0 6px rgba(200,150,12,0.18)'; }
    }
    function removeSelected() {
      if (!selectedEl) return;
      let target = selectedEl;
      while (target && target.parentElement && target.parentElement !== editor) target = target.parentElement;
      if (target && target !== editor) {
        const p = document.createElement('p'); p.innerHTML='<br>';
        target.after(p); target.remove();
      } else { selectedEl.remove(); }
      selectedEl = null;
      document.querySelectorAll('.ud-img-panel').forEach(p=>p.remove());
      syncToTextarea();
    }

    editor.addEventListener('click', e => {
      // Controls d'imatge (overlay buttons)
      const ctrlBtn = e.target.closest('.ud-img-ctrl-btn');
      if (ctrlBtn) {
        e.preventDefault(); e.stopPropagation();
        const wrap = ctrlBtn.closest('[data-ud-img]');
        const img = wrap?.querySelector('img');
        if (!wrap || !img) return;
        const action = ctrlBtn.dataset.action;
        const curSz = parseFloat(img.style.width || img.style.maxWidth) || 40;

        if (action === 'del') {
          let target = wrap;
          while (target && target.parentElement && target.parentElement !== editor) target = target.parentElement;
          const p = document.createElement('p'); p.innerHTML='<br>';
          if (target && target !== editor) { target.after(p); target.remove(); }
          else { wrap.remove(); }
          syncToTextarea(); return;
        }
        if (action === 'smaller') {
          const ns = Math.max(10, curSz - 10) + '%';
          img.style.width = ns; img.style.maxWidth = ns;
        }
        if (action === 'bigger') {
          const ns = Math.min(100, curSz + 10) + '%';
          img.style.width = ns; img.style.maxWidth = ns;
        }
        if (action === 'left') {
          wrap.style.cssText = 'overflow:hidden;margin:4px 0 12px;position:relative;';
          img.style.cssText = `width:${curSz}%;float:left;margin:0 18px 12px 0;border-radius:8px;border:1px solid #e4e8f0;`;
        }
        if (action === 'right') {
          wrap.style.cssText = 'overflow:hidden;margin:4px 0 12px;position:relative;';
          img.style.cssText = `width:${curSz}%;float:right;margin:0 0 12px 18px;border-radius:8px;border:1px solid #e4e8f0;`;
        }
        if (action === 'center') {
          wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;';
          img.style.cssText = `max-width:${curSz}%;display:inline-block;float:none;border-radius:8px;border:1px solid #e4e8f0;`;
        }
        if (action === 'up') {
          let el = wrap;
          while (el && el.parentElement !== editor) el = el.parentElement;
          if (el?.previousElementSibling) editor.insertBefore(el, el.previousElementSibling);
        }
        if (action === 'down') {
          let el = wrap;
          while (el && el.parentElement !== editor) el = el.parentElement;
          if (el?.nextElementSibling) editor.insertBefore(el.nextElementSibling, el);
        }
        syncToTextarea(); return;
      }

      const imgWrap = e.target.closest('[data-ud-img]');
      const imgEl   = e.target.closest('img');
      if (imgWrap || imgEl) { e.preventDefault(); return; } // controls ja gestionats
      const vidWrap = e.target.closest('[data-ud-vid]');
      if (vidWrap) {
        e.preventDefault();
        if (e.target.closest('.ud-del-btn-inline')) { selectElement(vidWrap); removeSelected(); return; }
        if (e.target.closest('.ud-vid-move')) {
          const dir = e.target.closest('.ud-vid-move').dataset.dir;
          let el = vidWrap;
          while (el && el.parentElement !== editor) el = el.parentElement;
          if (!el) return;
          if (dir==='up' && el.previousElementSibling) editor.insertBefore(el, el.previousElementSibling);
          else if (dir==='down' && el.nextElementSibling) editor.insertBefore(el.nextElementSibling, el);
          syncToTextarea(); return;
        }
        selectElement(vidWrap); return;
      }
      const link = e.target.closest('[data-ud-link]');
      if (link) { e.preventDefault(); showLinkEditPanel(link, syncToTextarea); return; }
      selectElement(null);
      document.querySelectorAll('.ud-img-panel').forEach(p=>p.remove());
    });

    // Supr / Delete elimina l'element seleccionat
    editor.addEventListener('keydown', e => {
      if ((e.key==='Delete'||e.key==='Backspace') && selectedEl) {
        e.preventDefault(); removeSelected();
      }
    });

    textarea.style.display='none';
    textarea.parentNode.insertBefore(makeToolbar(editor, syncToTextarea), textarea);
    textarea.parentNode.insertBefore(editor, textarea);
  }

  // Panel flotant per editar imatges inserides
  function showImageEditPanel(container, editor, syncFn, removeFn) {
    document.querySelectorAll('.ud-img-panel').forEach(p=>p.remove());
    const img = container.querySelector('img');
    if (!img) return;

    const curWidth = img.style.width || img.style.maxWidth || '40%';
    const curFloat = img.style.float || (container.style.textAlign==='center'?'center':'');
    const curSize = parseInt(curWidth)||40;
    const curAlt = img.alt || '';

    const panel = document.createElement('div');
    panel.className = 'ud-img-panel';
    panel.style.cssText = 'position:absolute;z-index:9000;background:#1a2744;color:white;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:inherit;font-size:12px;min-width:220px;';

    panel.innerHTML = `
      <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.6)">Editar imatge</div>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:11px;opacity:0.7;flex-shrink:0">Mida:</span>
        ${[25,40,60,100].map(s=>`<button data-sz="${s}" style="flex:1;padding:4px 2px;border-radius:6px;border:1px solid rgba(255,255,255,${curSize===s?'0.8':'0.25'});background:${curSize===s?'rgba(255,255,255,0.2)':'transparent'};color:white;cursor:pointer;font-size:11px;font-weight:600">${s}%</button>`).join('')}
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:11px;opacity:0.7;flex-shrink:0">Pos:</span>
        <button data-pos="left" style="flex:1;padding:4px;border-radius:6px;border:1px solid rgba(255,255,255,${curFloat==='left'?'0.8':'0.25'});background:${curFloat==='left'?'rgba(255,255,255,0.2)':'transparent'};color:white;cursor:pointer;font-size:11px">← Esq.</button>
        <button data-pos="center" style="flex:1;padding:4px;border-radius:6px;border:1px solid rgba(255,255,255,${(!curFloat||curFloat==='center')?'0.8':'0.25'});background:${(!curFloat||curFloat==='center')?'rgba(255,255,255,0.2)':'transparent'};color:white;cursor:pointer;font-size:11px">↕ Ctr.</button>
        <button data-pos="right" style="flex:1;padding:4px;border-radius:6px;border:1px solid rgba(255,255,255,${curFloat==='right'?'0.8':'0.25'});background:${curFloat==='right'?'rgba(255,255,255,0.2)':'transparent'};color:white;cursor:pointer;font-size:11px">Dta. →</button>
      </div>
      <div style="display:flex;gap:6px">
        <button data-action="alt" style="flex:1;padding:5px;border-radius:6px;border:1px solid rgba(255,255,255,0.25);background:transparent;color:white;cursor:pointer;font-size:11px">✏️ Peu de foto</button>
        <button data-action="del" style="flex:1;padding:5px;border-radius:6px;border:1px solid rgba(255,30,30,0.5);background:rgba(255,30,30,0.15);color:#ff9999;cursor:pointer;font-size:11px;font-weight:700">🗑 Eliminar</button>
      </div>
    `;

    const rect = container.getBoundingClientRect();
    panel.style.top = (rect.top + window.scrollY - 10) + 'px';
    panel.style.left = Math.max(8, rect.left) + 'px';
    document.body.appendChild(panel);

    // Un sol listener per a tots els botons del panel
    panel.addEventListener('click', e => {
      e.stopPropagation();
      const sz_btn = e.target.closest('[data-sz]');
      const pos_btn = e.target.closest('[data-pos]');
      const action = e.target.closest('[data-action]')?.dataset.action;

      if (sz_btn) {
        const sz = sz_btn.dataset.sz + '%';
        img.style.width = sz; img.style.maxWidth = sz;
        syncFn(); panel.remove(); return;
      }
      if (pos_btn) {
        const pos = pos_btn.dataset.pos;
        if (pos === 'center') {
          container.style.cssText = 'text-align:center;clear:both;margin:14px 0;';
          img.style.cssText = `max-width:${curWidth};border-radius:8px;border:1px solid #e4e8f0;display:inline-block;float:none;`;
        } else {
          const margin = pos==='left'?'0 18px 12px 0':'0 0 12px 18px';
          container.style.cssText = 'overflow:hidden;margin:4px 0 12px;';
          img.style.cssText = `width:${curWidth};float:${pos};margin:${margin};border-radius:8px;border:1px solid #e4e8f0;`;
        }
        syncFn(); panel.remove(); return;
      }
      if (action === 'alt') {
        const newAlt = prompt('Peu de foto:', curAlt);
        if (newAlt !== null) {
          img.alt = newAlt;
          const caption = container.querySelector('.ud-img-caption, [style*="font-style:italic"]');
          if (caption) caption.textContent = newAlt;
          syncFn();
        }
        panel.remove(); return;
      }
      if (action === 'del') {
        // Eliminem NOMÉS el contenidor de la imatge — mai l'editor sencer
        let target = container;
        while (target && target.parentElement && target.parentElement !== editor) {
          target = target.parentElement;
        }
        if (target && target !== editor) {
          const p = document.createElement('p'); p.innerHTML = '<br>';
          target.after(p);
          target.remove();
        } else {
          img.remove();
        }
        syncFn(); panel.remove(); return;
      }
    });

    // Tancar en clicar fora (amb stopPropagation al panel per no interferir)
    setTimeout(() => {
      const closeOutside = ev => {
        if (!panel.contains(ev.target) && !container.contains(ev.target)) {
          panel.remove();
          document.removeEventListener('click', closeOutside);
        }
      };
      document.addEventListener('click', closeOutside);
    }, 150);
  }

  function showVideoEditPanel(container, syncFn) {
    document.querySelectorAll('.ud-img-panel').forEach(p=>p.remove());
    const panel = document.createElement('div');
    panel.className = 'ud-img-panel';
    panel.style.cssText = 'position:absolute;z-index:9000;background:#1a2744;color:white;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:inherit;font-size:12px;min-width:180px;';
    panel.innerHTML = `
      <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.6)">Vídeo YouTube</div>
      <button id="ud-vid-delete" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,30,30,0.5);background:rgba(255,30,30,0.15);color:#ff9999;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit">🗑 Eliminar vídeo</button>
    `;
    const rect = container.getBoundingClientRect();
    panel.style.top = (rect.top + window.scrollY + 10) + 'px';
    panel.style.left = Math.max(8, rect.left) + 'px';
    document.body.appendChild(panel);
    document.getElementById('ud-vid-delete').onclick = () => { container.remove(); syncFn(); panel.remove(); };
    setTimeout(() => {
      document.addEventListener('click', function cp(e) {
        if (!panel.contains(e.target) && !container.contains(e.target)) { panel.remove(); document.removeEventListener('click',cp); }
      });
    }, 100);
  }

  function showLinkEditPanel(link, syncFn) {
    document.querySelectorAll('.ud-img-panel').forEach(p=>p.remove());
    const panel = document.createElement('div');
    panel.className = 'ud-img-panel';
    panel.style.cssText = 'position:absolute;z-index:9000;background:#1a2744;color:white;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);font-family:inherit;font-size:12px;min-width:220px;';
    panel.innerHTML = `
      <div style="font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.6)">Enllaç</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.5);word-break:break-all">${link.href}</div>
      <button id="ud-lnk-edit" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.25);background:transparent;color:white;cursor:pointer;font-size:12px;font-family:inherit">✏️ Editar text</button>
      <button id="ud-lnk-delete" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(255,30,30,0.5);background:rgba(255,30,30,0.15);color:#ff9999;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit">🗑 Eliminar enllaç</button>
    `;
    const rect = link.getBoundingClientRect();
    panel.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    panel.style.left = Math.max(8, rect.left) + 'px';
    document.body.appendChild(panel);
    document.getElementById('ud-lnk-edit').onclick = () => {
      const newTxt = prompt('Text de l\'enllaç:', link.textContent);
      if (newTxt !== null && newTxt.trim()) { link.textContent = newTxt.trim(); syncFn(); }
      panel.remove();
    };
    document.getElementById('ud-lnk-delete').onclick = () => { link.remove(); syncFn(); panel.remove(); };
    setTimeout(() => {
      document.addEventListener('click', function cp(e) {
        if (!panel.contains(e.target) && !link.contains(e.target)) { panel.remove(); document.removeEventListener('click',cp); }
      });
    }, 100);
  }

  // ── OBSERVADOR ───────────────────────────────────────────────────
  function init() {
    // Fix sessions guardades: deduplicar per títol
    fixSavedSessions();

    new MutationObserver(()=>{
      document.querySelectorAll('textarea').forEach(ta=>{
        if(ta.dataset.udDone)return;
        if(parseInt(ta.getAttribute('rows')||0)>=7) convertToEditor(ta);
      });
      setupHeader();
      injectSASection();
      interceptSaveButton();
    }).observe(document.body,{childList:true,subtree:true});

    [500,1000,2000,3000].forEach(t=>setTimeout(()=>{setupHeader();injectSASection();interceptSaveButton();},t));
  }

  // Intercepta el botó Desar per actualitzar en lloc de crear una entrada nova
  function interceptSaveButton() {
    document.querySelectorAll('button').forEach(btn => {
      const txt = btn.textContent?.trim() || '';
      if ((txt.includes('💾') || txt.toLowerCase().includes('desar')) && !btn.dataset.udSaveFixed) {
        btn.dataset.udSaveFixed = 'true';
        btn.addEventListener('click', () => {
          // Esperem que React guarde primer, llavors deduplicam
          setTimeout(fixSavedSessions, 300);
        }, true);
      }
    });
  }

  // Elimina duplicats del localStorage, mantenint només l'entrada més recent per títol
  function fixSavedSessions() {
    try {
      const keys = ['ud_units', 'savedUnits', 'unitats'];
      keys.forEach(key => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const units = JSON.parse(raw);
        if (!Array.isArray(units)) return;
        // Deduplicam per títol, quedant-nos amb la més recent (primera del array, ja que s'insereix al davant)
        const seen = new Set();
        const deduped = units.filter(u => {
          const k = (u.titol || u.title || u.nom || '').toLowerCase().trim() || u.id;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        if (deduped.length !== units.length) {
          localStorage.setItem(key, JSON.stringify(deduped));
        }
      });
    } catch(e) {}
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
