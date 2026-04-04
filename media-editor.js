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
    if (rs && rs.sessions?.length) {
      return {
        titol: rs.titol || '',
        assignatura: rs.assignatura || '',
        nivell: rs.nivell || '',
        justificacio: rs.justificacio || '',
        sessions: rs.sessions
          .filter(s => s.contingutAlumne || s.exercicis)
          .map((s, i) => ({
            idx: i + 1,
            nom: s.nom || `Sessió ${i+1}`,
            contingut: s.contingutAlumne || '',
            exercicis: s.exercicis || '',
            objectius: s.objectiusOperatius || ''
          }))
      };
    }
    // Fallback DOM
    const data = { titol:'', assignatura:'', nivell:'', justificacio:'', sessions:[] };
    document.querySelectorAll('input[type=text]').forEach(inp => {
      const lbl = inp.closest('div')?.querySelector('label')?.textContent?.toLowerCase()||'';
      if (lbl.includes('títol')||lbl.includes('titol')) data.titol = inp.value;
    });
    document.querySelectorAll('.session-card').forEach((card, i) => {
      const nom = card.querySelector('.session-header input[type=text]')?.value || `Sessió ${i+1}`;
      let contingut='', exercicis='';
      card.querySelectorAll('textarea').forEach(ta => {
        if (parseInt(ta.getAttribute('rows')||0) === 8) contingut = ta.value;
        if (parseInt(ta.getAttribute('rows')||0) === 6) exercicis = ta.value;
      });
      card.querySelectorAll('.ud-editor').forEach(ed => { contingut = ed.innerText; });
      if (contingut||exercicis) data.sessions.push({idx:i+1,nom,contingut,exercicis,objectius:''});
    });
    return data;
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
    const sessionsHTML = sessions.map((s, i) => {
      const color = COLORS[i % COLORS.length];
      const light = color + '18';
      let cHTML = s.contingut;
      if (!s.contingut.includes('<'))
        cHTML = s.contingut.split('\n').filter(p=>p.trim()).map(p=>`<p>${p}</p>`).join('');
      const exHTML = s.exercicis
        ? s.exercicis.split('\n').filter(e=>e.trim()).map((e,ei)=>
            `<div class="ex-row"><div class="ex-n" style="background:${color}">${ei+1}</div><div class="ex-t">${e.replace(/^\d+[\.\)]\s*/,'')}</div></div>`
          ).join('') : '';
      return `<section class="sess" style="--c:${color};--cl:${light}">
        <div class="sess-hero"><div class="sess-badge">Sessió ${s.idx}</div>
          <h2 class="sess-title">${s.nom}</h2>
          ${s.objectius?`<p class="sess-obj">${s.objectius}</p>`:''}
        </div>
        <div class="sess-body">
          <div class="sess-text">${cHTML}</div>
          ${exHTML?`<div class="exer-box"><div class="exer-hdr">✏️ Exercicis i activitats</div>${exHTML}</div>`:''}
        </div></section>`;
    }).join('');
    return `<!DOCTYPE html>
<html lang="ca"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titol||'Unitat Didàctica'}</title>
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
.ex-n{min-width:26px;height:26px;border-radius:50%;color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;margin-top:2px}
.ex-t{font-size:15px;color:#2c2c2c;line-height:1.6;flex:1}
.footer{text-align:center;padding:22px;font-size:11px;color:#bbb;letter-spacing:.5px;text-transform:uppercase;border-top:1px solid #e8e6e0;margin:0 40px}
@media(max-width:600px){.cover{padding:28px 20px 24px}.sess,.just,.footer{margin-left:12px;margin-right:12px}.sess-hero{padding:18px 18px 14px}.sess-body{padding:20px 18px}}
@media print{body{background:white}.sess{box-shadow:none;break-inside:avoid}}
</style></head><body>
<div class="cover">
  <div class="cover-meta">Decret 107/2022 · LOMLOE · Comunitat Valenciana</div>
  <h1 class="cover-title">${titol||'Unitat Didàctica'}</h1>
  <div class="cover-line"></div>
  <div class="cover-pills">
    ${assignatura?`<span class="cover-pill">${assignatura}</span>`:''}
    ${nivellText?`<span class="cover-pill">${nivellText}</span>`:''}
    <span class="cover-pill">${sessions.length} sessions</span>
  </div>
  <div class="cover-date">${date}</div>
</div>
${justificacio?`<div class="just">${justificacio}</div>`:''}
${sessionsHTML}
<div class="footer">Material didàctic · Decret 107/2022 · Comunitat Valenciana</div>
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
    .ud-toolbar{display:flex;gap:6px;flex-wrap:wrap;padding:6px 10px;background:#f0f4ff;border:1.5px solid #c8d0e8;border-bottom:none;border-radius:8px 8px 0 0}
    .ud-toolbar button{padding:5px 12px;border:1px solid #c8d0e8;border-radius:6px;background:white;font-size:12px;font-family:inherit;cursor:pointer;color:#1a2744;font-weight:600}
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
  function insertHTML(editor, html) {
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
  }
  function makeToolbar(editor) {
    const bar=document.createElement('div'); bar.className='ud-toolbar';
    const bVid=document.createElement('button'); bVid.type='button'; bVid.textContent='▶ Vídeo YouTube';
    bVid.onclick=()=>modal('Inserir vídeo de YouTube',[
      {id:'url',label:'URL del vídeo',ph:'https://www.youtube.com/watch?v=...'},
      {id:'cap',label:'Títol (opcional)',ph:"Ex: Els instruments de l'orquestra"},
    ],({url,cap})=>{
      if(!url)return; const id=ytId(url);
      if(!id){alert('URL de YouTube no vàlida');return;}
      insertHTML(editor,`<div class="ud-video-wrap" contenteditable="false"><iframe src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe>${cap?`<div class="ud-video-caption">▶ ${cap}</div>`:''}</div><p><br></p>`);
    });
    const bImg=document.createElement('button'); bImg.type='button'; bImg.textContent='🖼 Imatge';
    bImg.onclick=()=>modal('Inserir imatge',[
      {id:'url',label:'URL de la imatge',ph:'https://...'},
      {id:'cap',label:'Peu de foto (opcional)',ph:''},
    ],({url,cap})=>{
      if(!url)return;
      insertHTML(editor,`<div class="ud-img-wrap" contenteditable="false"><img src="${url}" alt="${cap}">${cap?`<div class="ud-img-caption">${cap}</div>`:''}</div><p><br></p>`);
    });
    const bLink=document.createElement('button'); bLink.type='button'; bLink.textContent='🔗 Enllaç';
    bLink.onclick=()=>modal('Inserir enllaç',[
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
    if(textarea.dataset.udDone)return; textarea.dataset.udDone='true';
    const editor=document.createElement('div'); editor.className='ud-editor'; editor.contentEditable='true';
    const init=textarea.value;
    editor.innerHTML=init?init.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join(''):'<p><br></p>';
    editor.addEventListener('input',()=>{
      textarea.value=editor.innerText;
      textarea.dispatchEvent(new Event('input',{bubbles:true}));
      textarea.dispatchEvent(new Event('change',{bubbles:true}));
    });
    let lastVal=textarea.value;
    setInterval(()=>{
      if(textarea.value!==lastVal&&textarea.value!==editor.innerText){
        lastVal=textarea.value;
        editor.innerHTML=textarea.value.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('')||'<p><br></p>';
      }
    },300);
    textarea.style.display='none';
    textarea.parentNode.insertBefore(makeToolbar(editor),textarea);
    textarea.parentNode.insertBefore(editor,textarea);
  }

  // ── OBSERVADOR ───────────────────────────────────────────────────
  function init() {
    new MutationObserver(()=>{
      document.querySelectorAll('textarea').forEach(ta=>{
        if(ta.dataset.udDone)return;
        if(parseInt(ta.getAttribute('rows')||0)>=7) convertToEditor(ta);
      });
      setupHeader();
    }).observe(document.body,{childList:true,subtree:true});

    [500,1000,2000,3000].forEach(t=>setTimeout(setupHeader,t));
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
