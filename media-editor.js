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
    // Provem totes les variants de claus que React usa segons la versió
    const key = Object.keys(root).find(k =>
      k.startsWith('__reactFiber') ||
      k.startsWith('__reactContainer') ||
      k.startsWith('_reactRootContainer')
    );
    if (!key) return null;
    const fiber = root[key]?.current || root[key]?._internalRoot?.current || root[key];
    return searchFiber(fiber, 0);
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
        // Restaurem les imatges reals des del magatzem
        const editorHTML = editors[0].cloneNode(true);
        editorHTML.querySelectorAll('img[data-udid]').forEach(img => {
          const id = img.getAttribute('data-udid');
          if (window._udImgStore && window._udImgStore[id]) img.src = window._udImgStore[id];
        });
        editorHTML.querySelectorAll('.ud-img-controls,.ud-vid-controls').forEach(el=>el.remove());
        contingut = editorHTML.innerHTML;
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

  // ── PERSISTÈNCIA DE LA SA ────────────────────────────────────────
  // La SA es guarda per unitat. Identifiquem la unitat pel títol actual.
  function getCurrentUnitKey() {
    const rs = getAppState();
    const titol = rs?.titol || document.querySelector('input[type=text]')?.value || '';
    return 'ud_sa_' + (titol.toLowerCase().trim().replace(/\s+/g,'_') || 'default');
  }

  function saveSAData() {
    const data = getSAData();
    // Si tots els camps estan buits, no guardem res
    if (!Object.values(data).some(v => v)) return;
    try { localStorage.setItem(getCurrentUnitKey(), JSON.stringify(data)); } catch(e){}
  }

  function loadSAData() {
    try {
      const raw = localStorage.getItem(getCurrentUnitKey());
      if (!raw) return;
      const data = JSON.parse(raw);
      const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
      set('sa-titol', data.titolSA);
      set('sa-narrativa', data.narrativa);
      set('sa-repte', data.repte);
      set('sa-producte', data.producte);
      set('sa-connexio', data.connexio);
      set('sa-arees', data.arees);
      set('sa-temporitzacio', data.temporitzacio);
    } catch(e){}
  }

  // ── RÚBRICA: ESTAT I PERSISTÈNCIA ────────────────────────────────
  const RUBRIC_LEVELS = [
    { key: 'exc', label: 'Excel·lent', range: '9-10', color: '#2d6a4f' },
    { key: 'not', label: 'Notable',    range: '7-8',  color: '#0d6efd' },
    { key: 'be',  label: 'Bé',         range: '5-6',  color: '#b8860b' },
    { key: 'ins', label: 'Insuficient',range: '<5',   color: '#c1272d' }
  ];

  const RUBRIC_DEFAULT_DIMENSIONS = [
    'Continguts i coneixements',
    'Procediments i destreses',
    'Actitud i implicació',
    'Producte final / presentació',
    'Expressió i comunicació'
  ];

  function getRubricKey() {
    const rs = getAppState();
    const titol = rs?.titol || document.querySelector('input[type=text]')?.value || '';
    return 'ud_rub_' + (titol.toLowerCase().trim().replace(/\s+/g,'_') || 'default');
  }

  function getRubricData() {
    const rows = document.querySelectorAll('.rub-row');
    const data = { dimensions: [] };
    rows.forEach(row => {
      const dim = row.querySelector('.rub-dim')?.value?.trim() || '';
      const cells = {};
      RUBRIC_LEVELS.forEach(lvl => {
        cells[lvl.key] = row.querySelector(`.rub-cell-${lvl.key}`)?.value?.trim() || '';
      });
      if (dim || Object.values(cells).some(v => v)) {
        data.dimensions.push({ nom: dim, ...cells });
      }
    });
    return data;
  }

  function saveRubricData() {
    const data = getRubricData();
    if (!data.dimensions.length) return;
    try { localStorage.setItem(getRubricKey(), JSON.stringify(data)); } catch(e){}
  }

  function loadRubricData() {
    try {
      const raw = localStorage.getItem(getRubricKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e){ return null; }
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

    // Carreguem dades guardades de la SA
    loadSAData();

    // Auto-guarda cada vegada que canvia un camp de la SA
    ['sa-titol','sa-narrativa','sa-repte','sa-producte','sa-connexio','sa-arees','sa-temporitzacio'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', saveSAData);
        el.addEventListener('change', saveSAData);
      }
    });

    // Quan canvia el títol de la unitat, recarreguem la SA associada
    const titleInput = document.querySelector('input[type=text]');
    if (titleInput && !titleInput._udSAWatched) {
      titleInput._udSAWatched = true;
      titleInput.addEventListener('change', () => setTimeout(loadSAData, 100));
    }
  }

  // ── INJECTA LA SECCIÓ DE RÚBRICA AL DOM ─────────────────────────
  function injectRubricSection() {
    if (document.getElementById('ud-rubric-section')) return;

    // Busquem la secció de la SA per inserir-nos a continuació
    const saSection = document.getElementById('ud-sa-section');
    if (!saSection) return; // esperem que la SA s'haja injectat primer

    const section = document.createElement('div');
    section.id = 'ud-rubric-section';
    section.className = 'card';
    section.style.cssText = 'margin-top:20px;padding:22px;background:white;border-radius:12px;border:1.5px solid #e4e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.04)';

    const saved = loadRubricData();
    const dims = saved?.dimensions?.length ? saved.dimensions : RUBRIC_DEFAULT_DIMENSIONS.map(n => ({nom:n, exc:'', not:'', be:'', ins:''}));

    section.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <div style="font-size:28px">📊</div>
        <div style="flex:1">
          <div style="font-size:11px;font-weight:700;color:#7a5c00;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:2px">Avaluació · LOMLOE</div>
          <h3 style="margin:0;font-size:18px;color:#1a2744;font-weight:700">Rúbrica d'avaluació</h3>
        </div>
        <button id="rub-ia-btn" type="button" style="background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:white;border:none;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">✨ Generar amb IA</button>
      </div>
      <div style="color:#64748b;font-size:13px;margin-bottom:14px">Defineix els descriptors per a cada dimensió i nivell d'assoliment.</div>
      <div style="overflow-x:auto">
        <table id="rub-table" style="width:100%;border-collapse:separate;border-spacing:0;font-size:13px;min-width:820px">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:10px;border:1px solid #e4e8f0;border-radius:8px 0 0 0;text-align:left;min-width:160px;font-weight:700;color:#1a2744">Dimensió</th>
              ${RUBRIC_LEVELS.map((l,i) => `<th style="padding:10px;border:1px solid #e4e8f0;border-left:none;${i===RUBRIC_LEVELS.length-1?'border-radius:0 8px 0 0;':''}text-align:center;font-weight:700;color:white;background:${l.color}"><div>${l.label}</div><div style="font-size:10px;opacity:.9;font-weight:500">${l.range}</div></th>`).join('')}
            </tr>
          </thead>
          <tbody id="rub-tbody"></tbody>
        </table>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button id="rub-add-row" type="button" style="background:#f0f4ff;color:#1a2744;border:1px solid #c8d0e8;padding:7px 14px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">+ Afegir dimensió</button>
        <button id="rub-reset" type="button" style="background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:7px 14px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit">↺ Reiniciar per defecte</button>
      </div>
    `;

    saSection.parentNode.insertBefore(section, saSection.nextSibling);

    const tbody = document.getElementById('rub-tbody');
    const renderRow = (dim) => {
      const tr = document.createElement('tr');
      tr.className = 'rub-row';
      tr.innerHTML = `
        <td style="padding:6px;border:1px solid #e4e8f0;vertical-align:top;background:#fafbfc">
          <input class="rub-dim" type="text" value="${(dim.nom||'').replace(/"/g,'&quot;')}" placeholder="Nom de la dimensió" style="width:100%;padding:7px 9px;border:1px solid #e4e8f0;border-radius:6px;font-size:13px;font-family:inherit;font-weight:600;color:#1a2744">
          <button class="rub-del" type="button" title="Eliminar dimensió" style="margin-top:6px;background:none;border:none;color:#991b1b;cursor:pointer;font-size:11px;padding:2px">🗑 Eliminar</button>
        </td>
        ${RUBRIC_LEVELS.map(l=>`<td style="padding:4px;border:1px solid #e4e8f0;vertical-align:top"><textarea class="rub-cell-${l.key}" placeholder="Descriptor per ${l.label.toLowerCase()}..." rows="3" style="width:100%;padding:7px 9px;border:1px solid #e4e8f0;border-radius:6px;font-size:13px;font-family:inherit;resize:vertical;min-height:64px">${(dim[l.key]||'').replace(/</g,'&lt;')}</textarea></td>`).join('')}
      `;
      tbody.appendChild(tr);
      // Listeners de guardat automàtic
      tr.querySelectorAll('input, textarea').forEach(el => {
        el.addEventListener('input', saveRubricData);
        el.addEventListener('change', saveRubricData);
      });
      tr.querySelector('.rub-del').addEventListener('click', () => {
        if (tbody.children.length > 1) { tr.remove(); saveRubricData(); }
        else alert('Has de mantenir almenys una dimensió.');
      });
    };

    dims.forEach(renderRow);

    document.getElementById('rub-add-row').onclick = () => {
      renderRow({ nom: '', exc:'', not:'', be:'', ins:'' });
    };
    document.getElementById('rub-reset').onclick = () => {
      if (!confirm('Vols reiniciar la rúbrica amb les dimensions per defecte? Es perdran els canvis actuals.')) return;
      tbody.innerHTML = '';
      RUBRIC_DEFAULT_DIMENSIONS.forEach(n => renderRow({nom:n, exc:'', not:'', be:'', ins:''}));
      saveRubricData();
    };
    document.getElementById('rub-ia-btn').onclick = generateRubricWithAI;
  }

  // ── GENERA RÚBRICA AMB IA ────────────────────────────────────────
  async function generateRubricWithAI() {
    const btn = document.getElementById('rub-ia-btn');
    const rs = getAppState();
    const titol = rs?.titol || document.querySelector('input[type=text]')?.value || '';
    const assignatura = rs?.assignatura || '';
    const nivell = rs?.nivell || '';
    const justificacio = rs?.justificacio || '';
    const criteris = (rs?.selectedCA || []).map(c => typeof c==='object' ? `${c.codi}: ${c.text}` : c).join('\n');

    if (!titol) { alert('Omple primer el títol de la unitat.'); return; }

    btn.textContent = '⏳ Generant...';
    btn.disabled = true;

    try {
      const prompt = `Ets un expert en didàctica i avaluació competencial LOMLOE (Decret 107/2022 Comunitat Valenciana).

Crea una rúbrica d'avaluació per a la següent unitat didàctica:
- Títol: ${titol}
- Àrea: ${assignatura}
- Nivell: ${nivell}r d'ESO
- Justificació: ${justificacio}
${criteris ? `- Criteris d'avaluació:\n${criteris}` : ''}

Genera entre 4 i 6 dimensions d'avaluació rellevants per a aquesta unitat. Per a cada dimensió, escriu un descriptor breu (1-2 frases) per a cada un dels 4 nivells d'assoliment:
- exc: Excel·lent (9-10)
- not: Notable (7-8)
- be: Bé (5-6)
- ins: Insuficient (<5)

Els descriptors han de ser concrets, observables i graduals (demostrar progressió clara entre nivells). Escriu en valencià.

Respon NOMÉS amb JSON vàlid amb aquesta estructura exacta (sense text addicional, sense markdown):
{
  "dimensions": [
    { "nom": "Nom de la dimensió", "exc": "descriptor...", "not": "descriptor...", "be": "descriptor...", "ins": "descriptor..." }
  ]
}`;

      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) throw new Error('Error del servidor');
      const result = await response.json();
      const text = result.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      if (!parsed.dimensions || !Array.isArray(parsed.dimensions)) throw new Error('Format invàlid');

      // Reomplim la taula amb les dimensions generades
      const tbody = document.getElementById('rub-tbody');
      tbody.innerHTML = '';
      parsed.dimensions.forEach(dim => {
        const tr = document.createElement('tr');
        tr.className = 'rub-row';
        tr.innerHTML = `
          <td style="padding:6px;border:1px solid #e4e8f0;vertical-align:top;background:#fafbfc">
            <input class="rub-dim" type="text" value="${(dim.nom||'').replace(/"/g,'&quot;')}" placeholder="Nom de la dimensió" style="width:100%;padding:7px 9px;border:1px solid #e4e8f0;border-radius:6px;font-size:13px;font-family:inherit;font-weight:600;color:#1a2744">
            <button class="rub-del" type="button" title="Eliminar dimensió" style="margin-top:6px;background:none;border:none;color:#991b1b;cursor:pointer;font-size:11px;padding:2px">🗑 Eliminar</button>
          </td>
          ${RUBRIC_LEVELS.map(l=>`<td style="padding:4px;border:1px solid #e4e8f0;vertical-align:top"><textarea class="rub-cell-${l.key}" rows="3" style="width:100%;padding:7px 9px;border:1px solid #e4e8f0;border-radius:6px;font-size:13px;font-family:inherit;resize:vertical;min-height:64px">${(dim[l.key]||'').replace(/</g,'&lt;')}</textarea></td>`).join('')}
        `;
        tbody.appendChild(tr);
        tr.querySelectorAll('input, textarea').forEach(el => {
          el.addEventListener('input', saveRubricData);
          el.addEventListener('change', saveRubricData);
        });
        tr.querySelector('.rub-del').addEventListener('click', () => {
          if (tbody.children.length > 1) { tr.remove(); saveRubricData(); }
        });
      });
      saveRubricData();

    } catch(e) {
      alert('Error generant la rúbrica: ' + e.message);
    } finally {
      btn.textContent = '✨ Generar amb IA';
      btn.disabled = false;
    }
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

      // Guarda la SA al localStorage
      saveSAData();

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
    // Signatura
    cover.addText('Josep Antoni fecit me', {
      x:0.5, y:4.9, w:8.5, h:0.3,
      fontSize:10, color:'667788', align:'left', italic:true
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

  // ── RECOLLIDA DE DADES COMPLETA PER AL PROFESSOR ───────────────
  function collectDataForTeacher() {
    const base = collectData();
    const rs = getAppState();
    if (!rs) return base;

    // Resol els CE/SB/CA (objectes amb codi + text) a HTML amb llista
    const resolveCompList = (items) => {
      if (!items || !Array.isArray(items) || !items.length) return '';
      return items.map(item => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object') {
          const codi = item.codi || '';
          const text = item.text || item.nom || '';
          return codi ? `<strong>${codi}</strong> — ${text}` : text;
        }
        return String(item);
      }).map(line => `<p style="margin-bottom:6pt;padding-left:8pt;border-left:2px solid var(--gold);">${line}</p>`).join('');
    };

    // Resol l'objecte DUA amb les 3 claus (rep, acc, imp)
    const resolveDUA = (dua) => {
      if (!dua || typeof dua !== 'object') return '';
      const labels = {
        rep: '🧠 Representació (el què)',
        acc: '✋ Acció i expressió (el com)',
        imp: '💛 Implicació (el perquè)'
      };
      const parts = [];
      for (const key of ['rep','acc','imp']) {
        const val = dua[key];
        if (val && val.trim()) {
          parts.push(`<div style="margin-bottom:10pt"><div style="font-weight:700;color:var(--gold);font-size:10pt;margin-bottom:3pt">${labels[key]||key}</div><div>${val.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('')}</div></div>`);
        }
      }
      return parts.join('');
    };

    const extras = {
      competenciesEspecifiques: resolveCompList(rs.selectedCE),
      sabersBasics: resolveCompList(rs.selectedSB),
      criterisAvaluacio: resolveCompList(rs.selectedCA),
      dua: resolveDUA(rs.dua),
      metodologia: rs.metodologia || '',
      avaluacio: rs.avaluacio || '',
      atencioDiversitat: rs.atencioDiversitat || rs.diversitat || '',
      recursos: rs.recursos || '',
      temporitzacio: rs.temporitzacio || '',
      objectiusGenerals: rs.objectiusGenerals || rs.objectius || '',
      rubrica: loadRubricData(),
    };

    // Per cada sessió, recollim més detall
    const sessionsExt = (rs.sessions || []).map((s, i) => ({
      idx: i+1,
      nom: s.nom || `Sessió ${i+1}`,
      objectiusOperatius: s.objectiusOperatius || '',
      contingutProfessor: s.contingutProfessor || s.guioClasse || '',
      contingutAlumne: base.sessions[i]?.contingut || s.contingutAlumne || '',
      exercicis: base.sessions[i]?.exercicis || s.exercicis || '',
      metodologia: s.metodologia || '',
      recursos: s.recursos || s.materials || '',
      avaluacio: s.avaluacio || s.criteris || '',
      temporitzacio: s.temporitzacio || s.duracio || '',
    }));

    return { ...base, ...extras, sessionsProf: sessionsExt };
  }

  // ── GENERA HTML DE LA UD PER AL PROFESSOR (PDF) ────────────────
  function generateTeacherHTML(data) {
    const { titol, assignatura, nivell, justificacio, sa, sessionsProf, sessions } = data;
    const nivellText = nivell ? `${nivell}r d'ESO` : '';
    const date = new Date().toLocaleDateString('ca-ES', {year:'numeric',month:'long',day:'numeric'});
    const sessList = (sessionsProf && sessionsProf.length) ? sessionsProf : sessions.map((s,i)=>({...s, idx:i+1}));

    const cleanContent = (html) => {
      if (!html) return '';
      if (!html.includes('<')) return html.split('\n').filter(p=>p.trim()).map(p=>`<p>${p}</p>`).join('');
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      tmp.querySelectorAll('.ud-img-controls,.ud-vid-controls,.ud-img-ctrl-btn').forEach(el=>el.remove());
      tmp.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
      tmp.querySelectorAll('[data-ud-img],[data-ud-vid],[data-ud-link]').forEach(el=>{
        el.removeAttribute('data-ud-img');el.removeAttribute('data-ud-vid');el.removeAttribute('data-ud-link');
      });
      // Vídeos com a targetes
      tmp.querySelectorAll('[data-ud-vid],.ud-video-wrap,.ud-video-hover').forEach(wrap=>{
        const iframe=wrap.querySelector('iframe');
        if(!iframe)return;
        const vidId=(iframe.src.match(/\/embed\/([a-zA-Z0-9_-]{11})/)||[])[1];
        if(!vidId)return;
        const caption=wrap.querySelector('.ud-video-caption');
        const capText=caption?caption.textContent.replace('▶','').trim():'Veure al YouTube';
        const card=document.createElement('div');
        card.style.cssText='margin:12px 0;padding:10px 14px;background:#f9f8f4;border-left:3px solid #b8860b;border-radius:4px;font-size:13px';
        card.innerHTML=`<div style="font-weight:600;color:#0d1526;margin-bottom:2px">🎥 ${capText}</div><div style="font-family:monospace;font-size:11px;color:#666">https://www.youtube.com/watch?v=${vidId}</div>`;
        wrap.replaceWith(card);
      });
      return tmp.innerHTML;
    };

    const fmt = (text) => text ? text.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('') : '';

    return `<!DOCTYPE html>
<html lang="ca"><head><meta charset="UTF-8">
<title>${titol||'Unitat Didàctica'} - Guia del professorat</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0d1526;--ink-soft:#2c3548;--muted:#6b7280;--line:#e5e1d6;--bg:#ffffff;--gold:#b8860b;--gold-soft:#fef6dc}
body{font-family:'Inter',sans-serif;background:white;color:var(--ink);font-size:11pt;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* PORTADA */
.cover{min-height:95vh;display:flex;flex-direction:column;justify-content:space-between;padding:60mm 20mm 20mm;background:linear-gradient(135deg,#0d1526 0%,#1a2744 100%);color:white;position:relative;overflow:hidden;page-break-after:always}
.cover::before{content:'';position:absolute;top:-100px;right:-100px;width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(184,134,11,.25),transparent 70%)}
.cover-top{position:relative;z-index:2}
.cover-eyebrow{display:flex;align-items:center;gap:12px;font-size:10pt;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:28px;font-weight:500}
.cover-eyebrow::before{content:'';width:32px;height:1px;background:var(--gold)}
.cover-title{font-family:'Fraunces',serif;font-size:42pt;font-weight:800;line-height:1.05;letter-spacing:-.02em;margin-bottom:16pt;max-width:90%}
.cover-subtitle{font-family:'Fraunces',serif;font-size:16pt;font-weight:400;color:rgba(255,255,255,.75);font-style:italic}
.cover-meta{position:relative;z-index:2;padding-top:22pt;border-top:1px solid rgba(255,255,255,.15);display:grid;grid-template-columns:repeat(3,1fr);gap:20pt}
.cover-meta-item{}
.cover-meta-label{font-size:8pt;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);font-weight:600;margin-bottom:4pt}
.cover-meta-value{font-size:12pt;color:white;font-weight:500}
.cover-footer{font-size:9pt;color:rgba(255,255,255,.35);letter-spacing:1px;text-transform:uppercase;margin-top:18pt}

/* PÀGINES INTERIORS */
.page{page-break-after:always}
.page:last-child{page-break-after:auto}
.page-header{display:flex;align-items:baseline;justify-content:space-between;padding-bottom:10pt;border-bottom:1.5px solid var(--ink);margin-bottom:18pt}
.page-title{font-family:'Fraunces',serif;font-size:22pt;font-weight:700;color:var(--ink);letter-spacing:-.01em}
.page-tag{font-size:9pt;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold);font-weight:700}

/* SECCIONS */
h2.section-title{font-family:'Fraunces',serif;font-size:16pt;font-weight:700;color:var(--ink);margin:18pt 0 10pt;padding-bottom:4pt;border-bottom:1px solid var(--line);letter-spacing:-.01em}
h2.section-title:first-child{margin-top:0}
h3.sub-title{font-size:11pt;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--gold);margin:14pt 0 6pt}

.box{background:#faf7f0;border:1px solid var(--line);border-radius:6pt;padding:12pt 16pt;margin-bottom:12pt}
.box-gold{background:var(--gold-soft);border:1px solid #e8dfb5;border-left:4px solid var(--gold)}
.box-label{font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold);margin-bottom:6pt}
.box-text{font-size:11pt;line-height:1.6;color:var(--ink-soft)}
.box-text p{margin-bottom:6pt}
.box-text p:last-child{margin-bottom:0}
.box-text strong{color:var(--ink);font-weight:700}
.box-text a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--gold)}
.box-text img{max-width:100%;border-radius:4pt;border:1px solid var(--line);margin:6pt 0}
.box-text ul, .box-text ol{margin:6pt 0 6pt 18pt}
.box-text li{margin-bottom:3pt}

/* GRAELLA SA */
.sa-grid{display:grid;grid-template-columns:1fr 1fr;gap:10pt;margin-bottom:12pt}
.sa-grid .sa-cell.full{grid-column:1/-1}

/* SESSIONS - CAPÇALERA */
.sess-header{display:flex;align-items:center;gap:14pt;padding-bottom:12pt;border-bottom:2px solid var(--ink);margin-bottom:16pt}
.sess-num{min-width:44pt;height:44pt;background:var(--ink);color:white;border-radius:8pt;display:flex;align-items:center;justify-content:center;font-family:'Fraunces',serif;font-size:22pt;font-weight:800}
.sess-head-text{flex:1}
.sess-eyebrow{font-size:8pt;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:3pt}
.sess-title{font-family:'Fraunces',serif;font-size:18pt;font-weight:700;color:var(--ink);line-height:1.15}

/* PEU */
.footer{text-align:center;padding-top:16pt;margin-top:16pt;border-top:1px solid var(--line);font-size:8pt;color:var(--muted);letter-spacing:1px;text-transform:uppercase}

/* PRINT */
@page{size:A4;margin:18mm 20mm}
@media print{
  body{background:white}
  /* La portada i les pàgines principals sempre comencen en pàgina nova */
  .cover{break-after:page;min-height:auto;padding:60mm 20mm 20mm}
  .page{break-after:page;padding:0}
  .page:last-child{break-after:auto}
  /* Les caixes poden partir-se, però els títols es queden amb el contingut */
  .box{break-inside:auto}
  h3.sub-title{break-after:avoid;break-inside:avoid}
  h2.section-title{break-after:avoid;break-inside:avoid}
  .sess-header{break-inside:avoid;break-after:avoid}
  /* Un grup "títol + caixa" ha de mantenir-se junt SI CAP en una pàgina */
  .keep-with-next{break-after:avoid}
  /* Si la caixa es parteix, la part que passa a la següent pàgina respecta el marge @page */
  .box, .box-text{orphans:3;widows:3}
  a{color:var(--ink);text-decoration:underline}
}

/* En pantalla, reduïm els espais per veure-ho més còmode */
@media screen{
  .page{padding:18mm 20mm}
  .cover{min-height:95vh;padding:60mm 20mm 20mm}
}

/* TAULA D'ÍNDEX */
.toc{margin-top:10pt}
.toc-item{display:flex;align-items:baseline;gap:8pt;padding:6pt 0;border-bottom:1px dotted var(--line);font-size:11pt}
.toc-num{font-family:'Fraunces',serif;font-weight:700;color:var(--gold);min-width:30pt}
.toc-title{flex:1;color:var(--ink-soft)}
.toc-dots{flex:1;border-bottom:1px dotted var(--muted);height:0;margin:0 8pt 4pt}

/* RÚBRICA */
.rubric-table{width:100%;border-collapse:separate;border-spacing:0;font-size:9.5pt;margin-top:10pt;table-layout:fixed}
.rubric-table thead tr{background:#0d1526}
.rubric-table .rub-dim-head{padding:8pt 10pt;color:white;font-weight:700;text-align:left;width:18%;border-radius:6pt 0 0 0;font-size:10pt}
.rubric-table .rub-lvl-head{padding:8pt 6pt;color:white;font-weight:700;text-align:center;font-size:10pt;line-height:1.2}
.rubric-table .rub-lvl-head:last-child{border-radius:0 6pt 0 0}
.rubric-table .rub-lvl-head span{font-size:8pt;font-weight:500;opacity:.85;display:block;margin-top:2pt}
.rubric-table tbody tr{page-break-inside:avoid;break-inside:avoid}
.rubric-table tbody tr:nth-child(even) td{background:#fafaf6}
.rubric-table tbody td{padding:8pt 10pt;border:1px solid var(--line);vertical-align:top;line-height:1.45;color:var(--ink-soft)}
.rubric-table .rub-dim-cell{font-weight:700;color:var(--ink);background:#f0ede4!important;font-family:'Fraunces',serif;font-size:10pt}
</style>
</head><body>

<!-- PORTADA -->
<section class="cover">
  <div class="cover-top">
    <div class="cover-eyebrow">Unitat Didàctica · Programació d'Aula</div>
    <h1 class="cover-title">${titol||'Unitat Didàctica'}</h1>
    <div class="cover-subtitle">Guia del professorat</div>
  </div>
  <div>
    <div class="cover-meta">
      ${assignatura?`<div class="cover-meta-item"><div class="cover-meta-label">Àrea</div><div class="cover-meta-value">${assignatura}</div></div>`:''}
      ${nivellText?`<div class="cover-meta-item"><div class="cover-meta-label">Nivell</div><div class="cover-meta-value">${nivellText}</div></div>`:''}
      <div class="cover-meta-item"><div class="cover-meta-label">Sessions</div><div class="cover-meta-value">${sessList.length} sessions</div></div>
    </div>
    <div class="cover-footer">Josep Antoni fecit me</div>
  </div>
</section>

<!-- ÍNDEX I MARC GENERAL -->
<section class="page">
  <div class="page-header">
    <h1 class="page-title">Marc general</h1>
    <div class="page-tag">Programació</div>
  </div>

  ${justificacio ? `
  <h2 class="section-title">Justificació</h2>
  <div class="box box-gold">
    <div class="box-text">${fmt(justificacio)}</div>
  </div>` : ''}

  ${sa && Object.values(sa).some(v=>v) ? `
  <h2 class="section-title">Situació d'aprenentatge</h2>
  ${sa.titolSA ? `<div class="box box-gold"><div class="box-label">Títol</div><div class="box-text" style="font-family:'Fraunces',serif;font-size:13pt;font-weight:600">${sa.titolSA}</div></div>` : ''}
  <div class="sa-grid">
    ${sa.narrativa?`<div class="sa-cell full"><div class="box"><div class="box-label">📖 Narrativa</div><div class="box-text">${fmt(sa.narrativa)}</div></div></div>`:''}
    ${sa.repte?`<div class="sa-cell"><div class="box"><div class="box-label">❓ Repte</div><div class="box-text">${fmt(sa.repte)}</div></div></div>`:''}
    ${sa.producte?`<div class="sa-cell"><div class="box"><div class="box-label">🏆 Producte final</div><div class="box-text">${fmt(sa.producte)}</div></div></div>`:''}
    ${sa.connexio?`<div class="sa-cell"><div class="box"><div class="box-label">🌍 Connexió real</div><div class="box-text">${fmt(sa.connexio)}</div></div></div>`:''}
    ${sa.arees?`<div class="sa-cell"><div class="box"><div class="box-label">📚 Àrees implicades</div><div class="box-text">${fmt(sa.arees)}</div></div></div>`:''}
    ${sa.temporitzacio?`<div class="sa-cell full"><div class="box"><div class="box-label">🕐 Temporització</div><div class="box-text">${fmt(sa.temporitzacio)}</div></div></div>`:''}
  </div>` : ''}

  ${data.objectiusGenerals ? `<h2 class="section-title">Objectius</h2><div class="box"><div class="box-text">${fmt(data.objectiusGenerals)}</div></div>` : ''}
  ${data.competenciesEspecifiques ? `<h2 class="section-title">Competències específiques</h2><div class="box"><div class="box-text">${data.competenciesEspecifiques}</div></div>` : ''}
  ${data.criterisAvaluacio ? `<h2 class="section-title">Criteris d'avaluació</h2><div class="box"><div class="box-text">${data.criterisAvaluacio}</div></div>` : ''}
  ${data.sabersBasics ? `<h2 class="section-title">Sabers bàsics</h2><div class="box"><div class="box-text">${data.sabersBasics}</div></div>` : ''}
  ${data.metodologia ? `<h2 class="section-title">Metodologia</h2><div class="box"><div class="box-text">${fmt(data.metodologia)}</div></div>` : ''}
  ${data.avaluacio ? `<h2 class="section-title">Avaluació</h2><div class="box"><div class="box-text">${fmt(data.avaluacio)}</div></div>` : ''}
  ${data.dua ? `<h2 class="section-title">DUA · Disseny Universal d'Aprenentatge</h2><div class="box box-gold"><div class="box-text">${data.dua}</div></div>` : ''}
  ${data.atencioDiversitat ? `<h2 class="section-title">Atenció a la diversitat</h2><div class="box"><div class="box-text">${fmt(data.atencioDiversitat)}</div></div>` : ''}
  ${data.recursos ? `<h2 class="section-title">Recursos</h2><div class="box"><div class="box-text">${fmt(data.recursos)}</div></div>` : ''}
  ${data.temporitzacio ? `<h2 class="section-title">Temporització</h2><div class="box"><div class="box-text">${fmt(data.temporitzacio)}</div></div>` : ''}
</section>

${data.rubrica && data.rubrica.dimensions && data.rubrica.dimensions.length ? `
<!-- RÚBRICA D'AVALUACIÓ -->
<section class="page">
  <div class="page-header">
    <h1 class="page-title">Rúbrica d'avaluació</h1>
    <div class="page-tag">Avaluació</div>
  </div>
  <table class="rubric-table">
    <thead>
      <tr>
        <th class="rub-dim-head">Dimensió</th>
        <th class="rub-lvl-head" style="background:#2d6a4f">Excel·lent<br><span>9-10</span></th>
        <th class="rub-lvl-head" style="background:#0d6efd">Notable<br><span>7-8</span></th>
        <th class="rub-lvl-head" style="background:#b8860b">Bé<br><span>5-6</span></th>
        <th class="rub-lvl-head" style="background:#c1272d">Insuficient<br><span>&lt;5</span></th>
      </tr>
    </thead>
    <tbody>
      ${data.rubrica.dimensions.map(d => `
        <tr>
          <td class="rub-dim-cell">${d.nom || ''}</td>
          <td>${(d.exc||'').replace(/\n/g,'<br>')}</td>
          <td>${(d.not||'').replace(/\n/g,'<br>')}</td>
          <td>${(d.be ||'').replace(/\n/g,'<br>')}</td>
          <td>${(d.ins||'').replace(/\n/g,'<br>')}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</section>` : ''}

<!-- ÍNDEX DE SESSIONS EN PÀGINA PRÒPIA -->
<section class="page">
  <div class="page-header">
    <h1 class="page-title">Índex de sessions</h1>
    <div class="page-tag">Contingut</div>
  </div>
  <div class="toc">
    ${sessList.map((s,i)=>`<div class="toc-item"><span class="toc-num">${i+1}.</span><span class="toc-title">${s.nom||('Sessió '+(i+1))}</span></div>`).join('')}
  </div>
</section>

<!-- SESSIONS -->
${sessList.map((s,i)=>`
<section class="page">
  <div class="sess-header">
    <div class="sess-num">${i+1}</div>
    <div class="sess-head-text">
      <div class="sess-eyebrow">Sessió ${i+1} de ${sessList.length}</div>
      <h2 class="sess-title">${s.nom||('Sessió '+(i+1))}</h2>
    </div>
  </div>

  ${s.objectiusOperatius ? `<h3 class="sub-title">Objectius operatius</h3><div class="box"><div class="box-text">${fmt(s.objectiusOperatius)}</div></div>` : ''}
  ${s.temporitzacio ? `<h3 class="sub-title">Temporització</h3><div class="box"><div class="box-text">${fmt(s.temporitzacio)}</div></div>` : ''}
  ${s.metodologia ? `<h3 class="sub-title">Metodologia</h3><div class="box"><div class="box-text">${fmt(s.metodologia)}</div></div>` : ''}
  ${s.contingutProfessor ? `<h3 class="sub-title">Notes per al professorat</h3><div class="box box-gold"><div class="box-text">${fmt(s.contingutProfessor)}</div></div>` : ''}

  <div class="keep-with-next"><h3 class="sub-title">Desenvolupament / continguts per a l'alumnat</h3></div>
  <div class="box"><div class="box-text">${cleanContent(s.contingutAlumne||s.contingut||'')}</div></div>

  ${s.exercicis ? `<h3 class="sub-title">Exercicis i activitats</h3><div class="box"><div class="box-text">${fmt(s.exercicis)}</div></div>` : ''}
  ${s.recursos ? `<h3 class="sub-title">Recursos de la sessió</h3><div class="box"><div class="box-text">${fmt(s.recursos)}</div></div>` : ''}
  ${s.avaluacio ? `<h3 class="sub-title">Avaluació de la sessió</h3><div class="box"><div class="box-text">${fmt(s.avaluacio)}</div></div>` : ''}

  <div class="footer">${titol||'Unitat Didàctica'} · Sessió ${i+1}</div>
</section>`).join('')}

</body></html>`;
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
      // Eliminar tots els controls d'edició
      tmp.querySelectorAll('.ud-img-controls,.ud-vid-controls,.ud-img-ctrl-btn,.ud-vid-move,.ud-del-btn-inline').forEach(el=>el.remove());
      tmp.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
      tmp.querySelectorAll('[data-ud-img],[data-ud-link],[data-ud-vid]').forEach(el=>{
        el.removeAttribute('data-ud-img'); el.removeAttribute('data-ud-link'); el.removeAttribute('data-ud-vid');
      });
      // Arreglem els contenidors d'imatge: overflow:hidden impedeix el float
      tmp.querySelectorAll('.ud-img-wrap-outer').forEach(wrap=>{
        wrap.classList.remove('ud-img-wrap-outer');
        // Si la imatge té float, el wrapper no pot tenir overflow:hidden
        const img = wrap.querySelector('img');
        if(img && (img.style.float==='left'||img.style.float==='right')) {
          wrap.style.overflow = 'visible';
        }
      });
      // Convertim iframes de YouTube en targetes clicables
      tmp.querySelectorAll('.ud-video-wrap,[data-ud-vid],.ud-video-hover').forEach(wrap => {
        const iframe = wrap.querySelector('iframe');
        const caption = wrap.querySelector('.ud-video-caption');
        if (!iframe) return;
        const src = iframe.src || '';
        const vidId = (src.match(/\/embed\/([a-zA-Z0-9_-]{11})/) || [])[1];
        if (!vidId) return;
        const capText = caption ? caption.textContent.replace('▶','').trim() : 'Veure vídeo a YouTube';
        const thumb = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
        const ytUrl = `https://www.youtube.com/watch?v=${vidId}`;
        // Mida i posició del vidBox
        const vidBox = wrap.querySelector('.ud-vid-box');
        const w = vidBox ? vidBox.style.width || '40%' : '40%';
        const isLeft  = vidBox && vidBox.style.float === 'left';
        const isRight = vidBox && vidBox.style.float === 'right';
        const floatStyle = isLeft ? `float:left;margin:0 18px 8px 0;` : isRight ? `float:right;margin:0 0 8px 18px;` : `display:inline-block;`;
        const card = document.createElement('div');
        card.style.cssText = isLeft||isRight ? `overflow:visible;margin:8px 0;` : `text-align:center;clear:both;margin:14px 0;`;
        card.innerHTML = `<a href="${ytUrl}" target="_blank" style="${floatStyle}width:${w};text-decoration:none;">
          <div style="position:relative;width:100%;padding-bottom:56.25%;border-radius:8px;overflow:hidden;border:1px solid #e4e8f0;">
            <img src="${thumb}" alt="${capText}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)"><svg viewBox="0 0 68 48" width="48" height="34"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C0 13.05 0 24 0 24s0 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C68 34.95 68 24 68 24s0-10.95-1.48-16.26z" fill="#f00"/><path d="M45 24 27 14v20" fill="#fff"/></svg></div>
          </div>
          ${capText ? `<div style="background:#1a2744;color:white;font-size:12px;padding:5px 10px;text-align:center;border-radius:0 0 8px 8px;">${capText}</div>` : ''}
        </a>`;
        wrap.replaceWith(card);
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
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800;9..144,900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0d1526;--ink-soft:#2c3548;--muted:#6b7280;--line:#e5e1d6;--bg:#faf7f0;--gold:#b8860b;--gold-soft:#fef6dc}
html{scroll-behavior:smooth}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--ink);font-size:16px;line-height:1.7;-webkit-font-smoothing:antialiased}

/* ─── PORTADA ────────────────────────────────── */
.cover{position:relative;padding:72px 56px 56px;background:linear-gradient(135deg,#0d1526 0%,#1a2744 100%);color:white;overflow:hidden}
.cover::before{content:'';position:absolute;top:-80px;right:-80px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(184,134,11,.25),transparent 65%)}
.cover::after{content:'';position:absolute;bottom:-100px;left:-100px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.06),transparent 65%)}
.cover-inner{position:relative;z-index:2;max-width:1100px;margin:0 auto}
.cover-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:22px;font-weight:500}
.cover-eyebrow::before{content:'';width:28px;height:1px;background:var(--gold)}
.cover-title{font-family:'Fraunces',serif;font-size:clamp(32px,5.5vw,54px);font-weight:800;line-height:1.08;letter-spacing:-.02em;margin-bottom:24px}
.cover-meta{display:flex;gap:24px;flex-wrap:wrap;padding-top:22px;border-top:1px solid rgba(255,255,255,.12)}
.cover-meta-item{display:flex;flex-direction:column;gap:3px}
.cover-meta-label{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.4);font-weight:600}
.cover-meta-value{font-size:15px;color:white;font-weight:500}

/* ─── CONTENIDOR PRINCIPAL ───────────────────── */
.main-wrap{max-width:1200px;margin:0 auto;padding:48px 48px 64px}

/* ─── JUSTIFICACIÓ ───────────────────────────── */
.just{background:white;padding:28px 32px;border-radius:14px;border:1px solid var(--line);margin-bottom:32px;position:relative}
.just-label{font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:10px;display:block}
.just-text{font-size:16px;line-height:1.75;color:var(--ink-soft);font-family:'Fraunces',serif;font-weight:500}

/* ─── SITUACIÓ D'APRENENTATGE ────────────────── */
.sa{background:white;border-radius:14px;overflow:hidden;margin-bottom:32px;border:1px solid var(--line);box-shadow:0 1px 2px rgba(0,0,0,.02)}
.sa-top{padding:26px 32px;background:linear-gradient(to right,var(--gold-soft),#fefcf4);border-bottom:1px solid #f0e9d3}
.sa-eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:6px}
.sa-title{font-family:'Fraunces',serif;font-size:24px;font-weight:700;color:var(--ink);line-height:1.25;letter-spacing:-.01em}
.sa-grid{display:grid;grid-template-columns:1fr 1fr}
.sa-cell{padding:22px 28px;border-bottom:1px solid var(--line);border-right:1px solid var(--line)}
.sa-cell:nth-child(even){border-right:none}
.sa-cell:nth-last-child(-n+2){border-bottom:none}
.sa-full{grid-column:1/-1;border-right:none}
.sa-cell-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--gold);margin-bottom:10px}
.sa-cell-text{font-size:14px;color:var(--ink-soft);line-height:1.65}

/* ─── NAVEGACIÓ DE SESSIONS ───────────────────── */
.sess-index{margin-bottom:28px}
.sess-index-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:14px;padding-left:2px}
.tab-nav{display:flex;flex-wrap:wrap;gap:6px;background:white;border:1px solid var(--line);border-radius:12px;padding:6px}
.tab-btn{flex:1;min-width:120px;padding:11px 16px;border:none;background:transparent;color:var(--ink-soft);cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;border-radius:8px;transition:all .18s;text-align:center}
.tab-btn:hover{background:#f5f2ea}
.tab-btn.act{color:white;box-shadow:0 2px 4px rgba(0,0,0,.1)}

/* ─── CONTINGUT DE SESSIÓ ─────────────────────── */
.tab-panel{background:white;border:1px solid var(--line);border-radius:14px;overflow:hidden;margin-bottom:40px}
.sess-head{padding:26px 34px 22px;border-bottom:1px solid var(--line);background:#fcfaf4;display:flex;align-items:center;gap:18px}
.sess-num{min-width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:white;font-family:'Fraunces',serif;font-size:20px;font-weight:800;flex-shrink:0}
.sess-head-text{flex:1}
.sess-eyebrow{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:4px}
.sess-title{font-family:'Fraunces',serif;font-size:22px;font-weight:700;color:var(--ink);line-height:1.25;letter-spacing:-.01em}
.sess-body{padding:32px 40px 36px}

/* ─── TEXT DE LA SESSIÓ ───────────────────────── */
.sess-text{font-size:16px;line-height:1.82;color:var(--ink-soft)}
.sess-text p{margin-bottom:15px}
.sess-text p:last-child{margin-bottom:0}
.sess-text::after{content:'';display:table;clear:both}
.sess-text strong{font-weight:700;color:var(--ink)}
.sess-text em{font-style:italic}
.sess-text u{text-decoration:underline;text-decoration-thickness:1.5px;text-underline-offset:2px}
.sess-text a{color:var(--ink);font-weight:600;border-bottom:1.5px solid var(--gold);text-decoration:none;transition:color .15s}
.sess-text a:hover{color:var(--gold)}

/* ─── IMATGES ────────────────────────────────── */
.sess-text img{border-radius:10px;border:1px solid var(--line);max-width:100%;height:auto}
.sess-text div[style*="float:left"],.sess-text div[style*="float:right"]{overflow:visible!important}
.sess-text img[style*="float:left"]{float:left;margin:4px 24px 12px 0!important}
.sess-text img[style*="float:right"]{float:right;margin:4px 0 12px 24px!important}

/* ─── VÍDEO YOUTUBE ───────────────────────────── */
.yt-card{margin:24px 0;clear:both}
a[style*="width"] .yt-thumb-wrap,.yt-thumb-wrap{position:relative;overflow:hidden;border-radius:10px;border:1px solid var(--line);background:#000;transition:transform .25s,box-shadow .25s}
.yt-thumb-wrap:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(0,0,0,.18)}
.yt-caption{background:linear-gradient(to right,var(--ink),#1a2744);color:white;font-size:13px;font-weight:500;padding:10px 16px;text-align:center;border-radius:0 0 10px 10px;margin-top:-1px}

/* ─── EXERCICIS ──────────────────────────────── */
.exer-box{margin-top:32px;padding:26px 30px;border-radius:12px;position:relative}
.exer-hdr{display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:14px;border-bottom:1.5px solid}
.exer-hdr-icon{font-size:18px}
.exer-hdr-text{font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:1.5px}
.ex-row{display:flex;gap:16px;margin-bottom:14px;align-items:flex-start}
.ex-row:last-child{margin-bottom:0}
.ex-n{min-width:30px;height:30px;border-radius:8px;color:white;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;margin-top:1px;font-family:'Fraunces',serif}
.ex-t{font-size:15px;color:var(--ink-soft);line-height:1.65;flex:1;padding-top:4px}

/* ─── PEU ────────────────────────────────────── */
.footer{text-align:center;padding:32px 20px;font-size:11px;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase;border-top:1px solid var(--line);margin-top:20px}
.footer strong{display:block;font-size:13px;color:var(--ink);margin-bottom:4px;letter-spacing:0;text-transform:none;font-family:'Fraunces',serif;font-weight:700}

/* ─── RESPONSIVE ─────────────────────────────── */
@media(max-width:700px){
  .cover{padding:44px 24px 36px}
  .main-wrap{padding:28px 18px 40px}
  .sess-body{padding:22px 22px 26px}
  .sess-head{padding:20px 22px 18px}
  .sa-grid{grid-template-columns:1fr}
  .sa-cell{border-right:none!important}
  .tab-btn{min-width:auto;font-size:12px;padding:9px 10px}
  .cover-meta{gap:16px}
  .just{padding:20px 22px}
  .sa-top{padding:22px 24px}
  .sa-cell{padding:18px 22px}
}

/* ─── PRINT / PDF ────────────────────────────── */
@media print{
  @page{size:A4;margin:16mm 14mm}
  body{background:white;font-size:12pt;line-height:1.6}
  .cover{padding:40px;page-break-after:always;min-height:240mm}
  .cover-title{font-size:36pt}
  .main-wrap{padding:0;max-width:100%}
  .tab-nav,.sess-index{display:none}
  .tab-panel{display:block!important;page-break-after:always;border:none;margin:0 0 20mm;border-radius:0;box-shadow:none}
  .tab-panel:last-child{page-break-after:auto}
  .sess-head{background:white;border-bottom:2px solid var(--ink);padding:0 0 14px}
  .sess-body{padding:18px 0 0}
  .sa{page-break-inside:avoid;border:1.5px solid var(--line)}
  .exer-box{page-break-inside:avoid;border:1px solid var(--line)}
  .footer{display:none}
  a{color:var(--ink)!important;border-bottom:1px solid var(--gold)!important}
  .yt-thumb-wrap{box-shadow:none!important;transform:none!important}
}
</style></head><body>

<section class="cover">
  <div class="cover-inner">
    <div class="cover-eyebrow">Josep Antoni fecit me</div>
    <h1 class="cover-title">${titol||'Unitat Didàctica'}</h1>
    <div class="cover-meta">
      ${assignatura?`<div class="cover-meta-item"><span class="cover-meta-label">Àrea</span><span class="cover-meta-value">${assignatura}</span></div>`:''}
      ${nivellText?`<div class="cover-meta-item"><span class="cover-meta-label">Nivell</span><span class="cover-meta-value">${nivellText}</span></div>`:''}
      <div class="cover-meta-item"><span class="cover-meta-label">Sessions</span><span class="cover-meta-value">${sessions.length} sessions</span></div>
    </div>
  </div>
</section>

<main class="main-wrap">
  ${justificacio ? `<div class="just"><span class="just-label">Introducció</span><div class="just-text">${justificacio}</div></div>` : ''}

  ${data.sa && Object.values(data.sa).some(v=>v) ? `
  <section class="sa">
    <div class="sa-top">
      <div class="sa-eyebrow">Situació d'Aprenentatge</div>
      <h2 class="sa-title">${data.sa.titolSA||''}</h2>
    </div>
    <div class="sa-grid">
      ${data.sa.narrativa?`<div class="sa-cell sa-full"><div class="sa-cell-label">Narrativa</div><div class="sa-cell-text">${data.sa.narrativa}</div></div>`:''}
      ${data.sa.repte?`<div class="sa-cell"><div class="sa-cell-label">Repte</div><div class="sa-cell-text">${data.sa.repte}</div></div>`:''}
      ${data.sa.producte?`<div class="sa-cell"><div class="sa-cell-label">Producte final</div><div class="sa-cell-text">${data.sa.producte}</div></div>`:''}
      ${data.sa.connexio?`<div class="sa-cell"><div class="sa-cell-label">Connexió real</div><div class="sa-cell-text">${data.sa.connexio}</div></div>`:''}
      ${data.sa.arees?`<div class="sa-cell"><div class="sa-cell-label">Àrees implicades</div><div class="sa-cell-text">${data.sa.arees}</div></div>`:''}
      ${data.sa.temporitzacio?`<div class="sa-cell"><div class="sa-cell-label">Temporització</div><div class="sa-cell-text">${data.sa.temporitzacio}</div></div>`:''}
    </div>
  </section>` : ''}

  <div class="sess-index">
    <div class="sess-index-label">Sessions de la unitat</div>
    <div class="tab-nav">
      ${sessions.map((s,i)=>`<button class="tab-btn${i===0?' act':''}" onclick="showTab(${i})" data-idx="${i}">${s.nom}</button>`).join('')}
    </div>
  </div>

  ${sessions.map((s,i)=>{
    const color = COLORS[i % COLORS.length];
    const lightBg = color + '10';
    const cHTML = cleanHTML(s.contingut);
    const exHTML = s.exercicis
      ? s.exercicis.split('\n').filter(e=>e.trim()).map((e,ei)=>
          `<div class="ex-row"><div class="ex-n" style="background:${color}">${ei+1}</div><div class="ex-t">${e.replace(/^\d+[\.\)]\s*/,'')}</div></div>`
        ).join('') : '';
    return `<section class="tab-panel" id="tab-${i}" style="display:${i===0?'block':'none'}">
      <div class="sess-head">
        <div class="sess-num" style="background:${color}">${i+1}</div>
        <div class="sess-head-text">
          <div class="sess-eyebrow">Sessió ${i+1} de ${sessions.length}</div>
          <h3 class="sess-title">${s.nom}</h3>
        </div>
      </div>
      <div class="sess-body">
        <div class="sess-text">${cHTML}</div>
        ${exHTML?`<div class="exer-box" style="background:${lightBg};border:1px solid ${color}33"><div class="exer-hdr" style="border-color:${color}44;color:${color}"><span class="exer-hdr-icon">✏️</span><span class="exer-hdr-text">Exercicis i activitats</span></div>${exHTML}</div>`:''}
      </div>
    </section>`;
  }).join('')}

  <footer class="footer">
    <strong>${titol||'Unitat Didàctica'}</strong>
    ${[assignatura,nivellText].filter(Boolean).join(' · ')}
  </footer>
</main>

<script>
const _colors=${JSON.stringify(COLORS)};
function showTab(n){
  document.querySelectorAll('.tab-panel').forEach((p,i)=>p.style.display=i===n?'block':'none');
  document.querySelectorAll('.tab-btn').forEach((b,i)=>{
    if(i===n){ b.classList.add('act'); b.style.background=_colors[i%_colors.length]; }
    else { b.classList.remove('act'); b.style.background='transparent'; }
  });
  window.scrollTo({top:document.querySelector('.tab-panel').offsetTop-20,behavior:'smooth'});
}
// Inicialitza el color del primer botó
document.addEventListener('DOMContentLoaded',()=>{
  const first=document.querySelector('.tab-btn.act');
  if(first) first.style.background=_colors[0];
});
<\/script>
</body></html>`;
  }

  // ── EXPORTAR / IMPORTAR UNITATS ─────────────────────────────────
  function exportUnits() {
    const units = localStorage.getItem('ud_units') || '[]';
    const blob = new Blob([units], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'unitats_didactiques_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToastUD('📦 Unitats exportades!');
  }

  function importUnits() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      const file = input.files[0];
      document.body.removeChild(input);
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const units = JSON.parse(e.target.result);
          if (!Array.isArray(units)) throw new Error('Format incorrecte');
          // Fusiona: afegim les unitats importades sense sobreescriure les existents
          const existing = JSON.parse(localStorage.getItem('ud_units') || '[]');
          const existingIds = new Set(existing.map(u => u.id));
          const news = units.filter(u => !existingIds.has(u.id));
          const merged = [...news, ...existing];
          localStorage.setItem('ud_units', JSON.stringify(merged));
          showToastUD(`✅ ${news.length} unitats importades!`);
        } catch(err) {
          showToastUD('❌ Fitxer invàlid', true);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function showToastUD(msg, isErr) {
    let t = document.getElementById('ud-toast-drive');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ud-toast-drive';
      t.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;font-family:inherit;box-shadow:0 4px 16px rgba(0,0,0,0.2);transition:opacity .3s';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = isErr ? '#c1272d' : '#1a2744';
    t.style.color = 'white';
    t.style.opacity = '1';
    clearTimeout(t._to);
    t._to = setTimeout(() => { t.style.opacity = '0'; }, 3000);
  }

  // ── MODIFICA LA CAPÇALERA ────────────────────────────────────────
  function setupHeader() {
    const container = document.querySelector('.header-actions');
    if (!container) return;

    // Elimina botons originals de l'app React en TOT el document
    // Els botons tenen emojis i espais (ex: "⬇ HTML", "📄 DOC"), per això usem includes
    document.querySelectorAll('button, a').forEach(el => {
      if (el.id && el.id.startsWith('ud-')) return; // no toquem els nostres
      const txt = (el.textContent || '').trim().toLowerCase();
      // Protegim els botons que volem conservar
      if (txt.includes('alumnes') || txt.includes('canva') || txt.includes('exportar') || txt.includes('importar')) return;
      // Eliminem els botons originals
      if (txt.includes('html') || txt.includes(' doc') || txt === 'doc' || txt.includes('pdf') || txt.includes('app html')) {
        el.remove();
      }
    });

    // Botons exportar / importar
    if (!document.getElementById('ud-export-btn')) {
      const btnExp = document.createElement('button');
      btnExp.id = 'ud-export-btn';
      btnExp.className = 'btn btn-sm btn-outline header-btn';
      btnExp.textContent = '📦 Exportar';
      btnExp.title = 'Exporta totes les unitats a un fitxer .json';
      btnExp.onclick = exportUnits;
      container.appendChild(btnExp);
    }

    if (!document.getElementById('ud-import-btn')) {
      const btnImp = document.createElement('button');
      btnImp.id = 'ud-import-btn';
      btnImp.className = 'btn btn-sm btn-outline header-btn';
      btnImp.textContent = '📂 Importar';
      btnImp.title = 'Importa unitats des d\'un fitxer .json';
      btnImp.onclick = importUnits;
      container.appendChild(btnImp);
    }

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

    // 4. Botó PDF Professor
    if (!document.getElementById('ud-pdf-prof-btn')) {
      const btnPDF = document.createElement('button');
      btnPDF.id = 'ud-pdf-prof-btn';
      btnPDF.className = 'btn btn-sm btn-outline header-btn';
      btnPDF.textContent = '📕 PDF Professor';
      btnPDF.title = 'Genera un PDF complet per al professor (tots els camps)';
      btnPDF.style.cssText = 'border-color:#0d1526;color:#0d1526';
      btnPDF.onmouseover = () => { btnPDF.style.background='#0d1526'; btnPDF.style.color='white'; };
      btnPDF.onmouseout  = () => { btnPDF.style.background=''; btnPDF.style.color='#0d1526'; };
      btnPDF.onclick = () => {
        const data = collectDataForTeacher();
        if (!data.sessions.length) { alert('Genera el contingut de les sessions primer.'); return; }
        try {
          const html = generateTeacherHTML(data);
          // Descarreguem com a fitxer HTML (l'usuari pot obrir-lo i imprimir-lo com a PDF)
          const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = (data.titol||'unitat').replace(/[^\w\s\-àáèéíòóúïüç]/gi,'').trim()+'_professor.html';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          // També intentem obrir-lo en una pestanya nova
          setTimeout(() => {
            const win = window.open('', '_blank');
            if (win) {
              win.document.write(html);
              win.document.close();
              setTimeout(() => { try { win.focus(); win.print(); } catch(e){} }, 1000);
            }
          }, 200);
        } catch(e) {
          alert('Error generant el PDF: ' + e.message);
          console.error(e);
        }
      };
      container.appendChild(btnPDF);
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
    .ud-img-wrap-outer{position:relative!important;display:block}
    .ud-img-wrap-outer img[src^="data:image/gif"]{display:none!important;height:0!important}
    .ud-img-wrap-outer.ud-broken{display:none!important}
    .ud-img-controls{position:absolute;top:4px;left:4px;z-index:100;display:flex;gap:2px;background:rgba(26,39,68,0.9);border-radius:7px;padding:3px 4px}
    .ud-img-ctrl-btn{border:none;background:rgba(255,255,255,0.2);color:white;border-radius:5px;padding:3px 7px;cursor:pointer;font-size:11px;font-weight:700;font-family:inherit;line-height:1}
    .ud-img-ctrl-btn:hover{background:rgba(255,255,255,0.4)}
    .ud-img-del{background:rgba(193,39,45,0.9)!important}
    .ud-img-del:hover{background:#c1272d!important}
    .ud-video-hover{position:relative;display:block;margin:14px 0}
    .ud-vid-controls{display:flex;position:absolute;top:8px;right:8px;z-index:100;gap:4px;background:rgba(26,39,68,0.9);border-radius:8px;padding:4px 6px;align-items:center}
    .ud-vid-move,.ud-del-btn-inline{border:none;border-radius:5px;padding:4px 10px;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit}
    .ud-vid-move{background:rgba(255,255,255,0.2);color:white}
    .ud-vid-move:hover{background:rgba(255,255,255,0.4)}
    .ud-del-btn-inline{background:rgba(193,39,45,0.9);color:white}
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

  function makeImgWrap(src, altText, syncFn, editor) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-ud-img','1');
    wrap.className = 'ud-img-wrap-outer';
    wrap.contentEditable = 'false';
    wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';

    const controls = document.createElement('div');
    controls.className = 'ud-img-controls';
    controls.innerHTML =
      '<button class="ud-img-ctrl-btn" data-action="up">↑</button>' +
      '<button class="ud-img-ctrl-btn" data-action="down">↓</button>' +
      '<button class="ud-img-ctrl-btn" data-action="smaller">−</button>' +
      '<button class="ud-img-ctrl-btn" data-action="bigger">+</button>' +
      '<button class="ud-img-ctrl-btn" data-action="left">←</button>' +
      '<button class="ud-img-ctrl-btn" data-action="center">↕</button>' +
      '<button class="ud-img-ctrl-btn" data-action="right">→</button>' +
      '<button class="ud-img-ctrl-btn ud-img-del" data-action="del">🗑</button>';

    const img = document.createElement('img');
    img.src = src;
    img.alt = altText || '';
    img.style.cssText = 'max-width:50%;border-radius:8px;border:1px solid #e4e8f0;display:inline-block;';

    wrap.appendChild(controls);
    wrap.appendChild(img);

    controls.querySelectorAll('.ud-img-ctrl-btn').forEach(btn => {
      btn.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const action = btn.dataset.action;
        const curSz = parseFloat(img.style.maxWidth || img.style.width || '50') || 50;
        if (action === 'del') {
          let t = wrap;
          while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
          const p = document.createElement('p'); p.innerHTML = '<br>';
          if (t && t !== editor) { t.after(p); t.remove(); } else { wrap.remove(); }
          setTimeout(syncFn, 50); return;
        }
        if (action === 'smaller') { const ns = Math.max(10, curSz-10)+'%'; img.style.maxWidth=ns; img.style.width=ns; }
        if (action === 'bigger')  { const ns = Math.min(100,curSz+10)+'%'; img.style.maxWidth=ns; img.style.width=ns; }
        if (action === 'left') {
          wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
          img.style.cssText = 'width:'+curSz+'%;float:left;margin:0 18px 8px 0;border-radius:8px;border:1px solid #e4e8f0;';
        }
        if (action === 'right') {
          wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
          img.style.cssText = 'width:'+curSz+'%;float:right;margin:0 0 8px 18px;border-radius:8px;border:1px solid #e4e8f0;';
        }
        if (action === 'center') {
          wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';
          img.style.cssText = 'max-width:'+curSz+'%;display:inline-block;float:none;border-radius:8px;border:1px solid #e4e8f0;';
        }
        if (action === 'up') {
          let t = wrap;
          while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
          if (!t || t === editor) return;
          let prev = t.previousElementSibling;
          while (prev && !prev.textContent.trim() && !prev.querySelector('img,iframe,[data-ud-vid],[data-ud-img]')) {
            prev = prev.previousElementSibling;
          }
          if (prev) t.parentElement.insertBefore(t, prev);
        }
        if (action === 'down') {
          let t = wrap;
          while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
          if (!t || t === editor) return;
          let next = t.nextElementSibling;
          while (next && !next.textContent.trim() && !next.querySelector('img,iframe,[data-ud-vid],[data-ud-img]')) {
            next = next.nextElementSibling;
          }
          if (next && next.nextElementSibling) {
            t.parentElement.insertBefore(t, next.nextElementSibling);
          } else if (next) {
            t.parentElement.appendChild(t);
          }
        }
        setTimeout(syncFn, 50);
      });
    });
    return wrap;
  }

  // Comprimeix imatges grans per no saturar el localStorage
  function compressImageSrc(src, maxWidth = 1200, quality = 0.82) {
    return new Promise(resolve => {
      // Només comprimim base64 (no URLs externes)
      if (!src.startsWith('data:image')) { resolve(src); return; }
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white'; ctx.fillRect(0, 0, w, h); // fons blanc per PNG transparents
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        // Només usem la versió comprimida si realment és més petita
        resolve(compressed.length < src.length ? compressed : src);
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  function insertImageFromSrc(editor, src, name, syncFn) {
    // Comprimim abans d'inserir
    compressImageSrc(src).then(compressed => {
      const wrap = makeImgWrap(compressed, name, syncFn, editor);
      editor.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(wrap);
        const p = document.createElement('p'); p.innerHTML = '<br>';
        wrap.after(p);
        range.setStartAfter(p); range.collapse(true);
        sel.removeAllRanges(); sel.addRange(range);
      } else {
        editor.appendChild(wrap);
        const p = document.createElement('p'); p.innerHTML = '<br>';
        editor.appendChild(p);
      }
      setTimeout(syncFn, 50);
    });
  }

  function makeVidWrap(id, cap, syncFn, editor) {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-ud-vid', id);
    wrap.className = 'ud-img-wrap-outer';
    wrap.contentEditable = 'false';
    wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';

    const controls = document.createElement('div');
    controls.className = 'ud-img-controls ud-vid-controls';
    controls.innerHTML =
      '<button class="ud-img-ctrl-btn" data-action="up">↑</button>' +
      '<button class="ud-img-ctrl-btn" data-action="down">↓</button>' +
      '<button class="ud-img-ctrl-btn" data-action="smaller">−</button>' +
      '<button class="ud-img-ctrl-btn" data-action="bigger">+</button>' +
      '<button class="ud-img-ctrl-btn" data-action="left">←</button>' +
      '<button class="ud-img-ctrl-btn" data-action="center">↕</button>' +
      '<button class="ud-img-ctrl-btn" data-action="right">→</button>' +
      '<button class="ud-img-ctrl-btn ud-img-del" data-action="del">🗑</button>';

    // Miniatura clicable (no iframe)
    const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    const ytUrl = `https://www.youtube.com/watch?v=${id}`;

    const vidBox = document.createElement('div');
    vidBox.className = 'ud-vid-box';
    vidBox.style.cssText = 'display:inline-block;width:40%;position:relative;cursor:pointer;';

    const thumbWrap = document.createElement('div');
    thumbWrap.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;border:1px solid #e4e8f0;';

    const thumbImg = document.createElement('img');
    thumbImg.src = thumb;
    thumbImg.alt = cap || 'Vídeo YouTube';
    thumbImg.style.cssText = 'width:100%;display:block;';

    // Botó de play
    const playBtn = document.createElement('div');
    playBtn.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;';
    playBtn.innerHTML = '<svg viewBox="0 0 68 48" width="56" height="40"><path d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C0 13.05 0 24 0 24s0 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C68 34.95 68 24 68 24s0-10.95-1.48-16.26z" fill="rgba(0,0,0,0.7)"/><path d="M45 24 27 14v20" fill="#fff"/></svg>';

    thumbWrap.appendChild(thumbImg);
    thumbWrap.appendChild(playBtn);

    // Clic obre YouTube
    thumbWrap.addEventListener('click', () => window.open(ytUrl, '_blank'));

    vidBox.appendChild(thumbWrap);

    if (cap) {
      const capEl = document.createElement('div');
      capEl.style.cssText = 'background:#1a2744;color:white;font-size:12px;padding:5px 10px;text-align:center;border-radius:0 0 8px 8px;';
      capEl.textContent = '▶ ' + cap;
      vidBox.appendChild(capEl);
    }

    wrap.appendChild(controls);
    wrap.appendChild(vidBox);

    const getCurSz = () => parseFloat(vidBox.style.width) || 40;

    controls.querySelectorAll('.ud-img-ctrl-btn').forEach(btn => {
      btn.addEventListener('mousedown', ev => {
        ev.preventDefault(); ev.stopPropagation();
        const action = btn.dataset.action;
        const curSz = getCurSz();
        if (action === 'del') {
          let t = wrap;
          while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
          const p = document.createElement('p'); p.innerHTML = '<br>';
          if (t && t !== editor) { t.after(p); t.remove(); } else { wrap.remove(); }
          setTimeout(syncFn, 50); return;
        }
        if (action === 'smaller') vidBox.style.width = Math.max(15, curSz-10)+'%';
        if (action === 'bigger')  vidBox.style.width = Math.min(100,curSz+10)+'%';
        if (action === 'left') {
          wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
          vidBox.style.cssText = `display:block;width:${curSz}%;float:left;margin:0 18px 8px 0;cursor:pointer;`;
        }
        if (action === 'right') {
          wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
          vidBox.style.cssText = `display:block;width:${curSz}%;float:right;margin:0 0 8px 18px;cursor:pointer;`;
        }
        if (action === 'center') {
          wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';
          vidBox.style.cssText = `display:inline-block;width:${curSz}%;float:none;cursor:pointer;`;
        }
        if (action === 'up') {
          let t = wrap;
          while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
          if (!t || t === editor) return;
          let prev = t.previousElementSibling;
          while (prev && !prev.textContent.trim() && !prev.querySelector('img,iframe,[data-ud-vid],[data-ud-img]')) {
            prev = prev.previousElementSibling;
          }
          if (prev) t.parentElement.insertBefore(t, prev);
        }
        if (action === 'down') {
          let t = wrap;
          while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
          if (!t || t === editor) return;
          let next = t.nextElementSibling;
          while (next && !next.textContent.trim() && !next.querySelector('img,iframe,[data-ud-vid],[data-ud-img]')) {
            next = next.nextElementSibling;
          }
          if (next && next.nextElementSibling) {
            t.parentElement.insertBefore(t, next.nextElementSibling);
          } else if (next) {
            t.parentElement.appendChild(t);
          }
        }
        setTimeout(syncFn, 50);
      });
    });
    return wrap;
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
    return `<div data-ud-img="1" class="ud-img-wrap-outer" style="overflow:visible;margin:4px 0 12px;position:relative;" contenteditable="false">${controls}<img src="${url}" alt="${cap||''}" style="width:${sz}%;float:${floatDir};margin:${margin};border-radius:8px;border:1px solid #e4e8f0;">${cap?`<div style="font-size:11px;color:#888;text-align:${floatDir};font-style:italic;margin-top:3px">${cap}</div>`:''}</div><p style="clear:none"><br></p>`;
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
      const vidWrap = makeVidWrap(id, cap, syncFn, editor);
      // Inserim al cursor, igual que les imatges
      editor.focus();
      const sel = window.getSelection();
      if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(vidWrap);
        const p = document.createElement('p'); p.innerHTML = '<br>';
        vidWrap.after(p);
        range.setStartAfter(p); range.collapse(true);
        sel.removeAllRanges(); sel.addRange(range);
      } else {
        editor.appendChild(vidWrap);
        const p = document.createElement('p'); p.innerHTML = '<br>';
        editor.appendChild(p);
      }
      setTimeout(syncFn, 50);
    });

    const bImg=document.createElement('button'); bImg.type='button'; bImg.textContent='🖼 Imatge';
    bImg.title='Clica per triar una foto del teu ordinador, o copia i prem Ctrl+V al quadre de text';
    bImg.onclick=()=>{
      const input=document.createElement('input');
      input.type='file'; input.accept='image/*';
      input.style.display='none';
      document.body.appendChild(input);
      input.onchange=()=>{
        const file=input.files[0];
        document.body.removeChild(input);
        if(!file)return;
        const reader=new FileReader();
        reader.onload=ev=>insertImageFromSrc(editor, ev.target.result, file.name, syncFn);
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

    // Magatzem d'imatges base64 al localStorage
    if (!window._udImgStore) {
      try { window._udImgStore = JSON.parse(localStorage.getItem('_udImgStore') || '{}'); }
      catch(e) { window._udImgStore = {}; }
    }

    const syncToTextarea = () => {
      const tmp = document.createElement('div');
      tmp.innerHTML = editor.innerHTML;
      tmp.querySelectorAll('.ud-img-controls,.ud-vid-controls').forEach(el => el.remove());
      // Al clon per a React: substituïm base64 per ID curt
      tmp.querySelectorAll('img').forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.startsWith('data:image/gif')) return; // ja processat
        if (!src.startsWith('data:')) return; // imatges externes no cal processar-les
        let id = img.getAttribute('data-udid');
        if (!id || !window._udImgStore[id]) {
          id = 'udimg_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
          window._udImgStore[id] = src;
          try { localStorage.setItem('_udImgStore', JSON.stringify(window._udImgStore)); } catch(e){}
          img.setAttribute('data-udid', id);
          // També l'element real de l'editor
          editor.querySelectorAll('img').forEach(realImg => {
            if (realImg.getAttribute('src') === src && !realImg.getAttribute('data-udid')) {
              realImg.setAttribute('data-udid', id);
            }
          });
        }
        img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
      });
      const val = tmp.innerHTML;
      if (nativeInputSetter) nativeInputSetter.call(textarea, val);
      else textarea.value = val;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // Reconstrueix els controls per a un vídeo existent (quan es recarrega una sessió)
    const rebuildVideoControls = (wrap) => {
      if (wrap._udVidControlsBuilt) return;
      wrap._udVidControlsBuilt = true;
      const vidBox = wrap.querySelector('.ud-vid-box');
      if (!vidBox) return;

      // Elimina controls antics
      wrap.querySelectorAll('.ud-img-controls, .ud-vid-controls').forEach(c => c.remove());

      const controls = document.createElement('div');
      controls.className = 'ud-img-controls ud-vid-controls';
      controls.contentEditable = 'false';
      controls.innerHTML =
        '<button class="ud-img-ctrl-btn" data-action="up">↑</button>' +
        '<button class="ud-img-ctrl-btn" data-action="down">↓</button>' +
        '<button class="ud-img-ctrl-btn" data-action="smaller">−</button>' +
        '<button class="ud-img-ctrl-btn" data-action="bigger">+</button>' +
        '<button class="ud-img-ctrl-btn" data-action="left">←</button>' +
        '<button class="ud-img-ctrl-btn" data-action="center">↕</button>' +
        '<button class="ud-img-ctrl-btn" data-action="right">→</button>' +
        '<button class="ud-img-ctrl-btn ud-img-del" data-action="del">🗑</button>';
      wrap.insertBefore(controls, wrap.firstChild);

      controls.querySelectorAll('.ud-img-ctrl-btn').forEach(btn => {
        btn.addEventListener('mousedown', ev => {
          ev.preventDefault(); ev.stopPropagation();
          const action = btn.dataset.action;
          const curSz = parseFloat(vidBox.style.width) || 40;
          if (action === 'del') {
            let t = wrap;
            while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
            const p = document.createElement('p'); p.innerHTML = '<br>';
            if (t && t !== editor) { t.after(p); t.remove(); } else { wrap.remove(); }
            setTimeout(syncToTextarea, 50); return;
          }
          if (action === 'smaller') vidBox.style.width = Math.max(15, curSz-10)+'%';
          if (action === 'bigger')  vidBox.style.width = Math.min(100,curSz+10)+'%';
          if (action === 'left') {
            wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
            vidBox.style.cssText = 'display:block;width:'+curSz+'%;float:left;margin:0 18px 8px 0;cursor:pointer;';
          }
          if (action === 'right') {
            wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
            vidBox.style.cssText = 'display:block;width:'+curSz+'%;float:right;margin:0 0 8px 18px;cursor:pointer;';
          }
          if (action === 'center') {
            wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';
            vidBox.style.cssText = 'display:inline-block;width:'+curSz+'%;float:none;cursor:pointer;';
          }
          if (action === 'up') {
            let t = wrap;
            while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
            if (!t || t === editor) return;
            // Busquem el germà anterior no buit
            let prev = t.previousElementSibling;
            while (prev && !prev.textContent.trim() && !prev.querySelector('img,iframe,[data-ud-vid],[data-ud-img]')) {
              prev = prev.previousElementSibling;
            }
            if (prev) t.parentElement.insertBefore(t, prev);
          }
          if (action === 'down') {
            let t = wrap;
            while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
            if (!t || t === editor) return;
            let next = t.nextElementSibling;
            while (next && !next.textContent.trim() && !next.querySelector('img,iframe,[data-ud-vid],[data-ud-img]')) {
              next = next.nextElementSibling;
            }
            if (next && next.nextElementSibling) {
              t.parentElement.insertBefore(t, next.nextElementSibling);
            } else if (next) {
              t.parentElement.appendChild(t);
            }
          }
          setTimeout(syncToTextarea, 50);
        });
      });

      // Re-afegeix el click per obrir YouTube (es perd al recarregar)
      const thumbWrap = vidBox.querySelector('div[style*="padding-bottom"]') || vidBox.firstElementChild;
      const vidId = wrap.getAttribute('data-ud-vid');
      if (thumbWrap && vidId && !thumbWrap._udClickHandled) {
        thumbWrap._udClickHandled = true;
        thumbWrap.style.cursor = 'pointer';
        thumbWrap.addEventListener('click', () => window.open('https://www.youtube.com/watch?v='+vidId, '_blank'));
      }
    };

    // Reconstrueix els controls per a una imatge existent (quan es recarrega una sessió)
    const rebuildImageControls = (wrap) => {
      if (wrap._udControlsBuilt) return;
      wrap._udControlsBuilt = true;
      const img = wrap.querySelector('img');
      if (!img) return;

      // Elimina controls antics si existeixen
      wrap.querySelectorAll('.ud-img-controls').forEach(c => c.remove());

      const controls = document.createElement('div');
      controls.className = 'ud-img-controls';
      controls.contentEditable = 'false';
      controls.innerHTML =
        '<button class="ud-img-ctrl-btn" data-action="up">↑</button>' +
        '<button class="ud-img-ctrl-btn" data-action="down">↓</button>' +
        '<button class="ud-img-ctrl-btn" data-action="smaller">−</button>' +
        '<button class="ud-img-ctrl-btn" data-action="bigger">+</button>' +
        '<button class="ud-img-ctrl-btn" data-action="left">←</button>' +
        '<button class="ud-img-ctrl-btn" data-action="center">↕</button>' +
        '<button class="ud-img-ctrl-btn" data-action="right">→</button>' +
        '<button class="ud-img-ctrl-btn ud-img-del" data-action="del">🗑</button>';
      wrap.insertBefore(controls, wrap.firstChild);

      controls.querySelectorAll('.ud-img-ctrl-btn').forEach(btn => {
        btn.addEventListener('mousedown', ev => {
          ev.preventDefault(); ev.stopPropagation();
          const action = btn.dataset.action;
          const curSz = parseFloat(img.style.maxWidth || img.style.width || '50') || 50;
          if (action === 'del') {
            let t = wrap;
            while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
            const p = document.createElement('p'); p.innerHTML = '<br>';
            if (t && t !== editor) { t.after(p); t.remove(); } else { wrap.remove(); }
            setTimeout(syncToTextarea, 50); return;
          }
          if (action === 'smaller') { const ns = Math.max(10, curSz-10)+'%'; img.style.maxWidth=ns; img.style.width=ns; }
          if (action === 'bigger')  { const ns = Math.min(100,curSz+10)+'%'; img.style.maxWidth=ns; img.style.width=ns; }
          if (action === 'left') {
            wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
            img.style.cssText = 'width:'+curSz+'%;float:left;margin:0 18px 8px 0;border-radius:8px;border:1px solid #e4e8f0;';
          }
          if (action === 'right') {
            wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
            img.style.cssText = 'width:'+curSz+'%;float:right;margin:0 0 8px 18px;border-radius:8px;border:1px solid #e4e8f0;';
          }
          if (action === 'center') {
            wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';
            img.style.cssText = 'max-width:'+curSz+'%;display:inline-block;float:none;border-radius:8px;border:1px solid #e4e8f0;';
          }
          if (action === 'up') {
            let t = wrap;
            while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
            if (!t || t === editor) return;
            let prev = t.previousElementSibling;
            while (prev && !prev.textContent.trim() && !prev.querySelector('img,iframe,[data-ud-vid],[data-ud-img]')) {
              prev = prev.previousElementSibling;
            }
            if (prev) t.parentElement.insertBefore(t, prev);
          }
          if (action === 'down') {
            let t = wrap;
            while (t && t.parentElement && t.parentElement !== editor) t = t.parentElement;
            if (!t || t === editor) return;
            let next = t.nextElementSibling;
            while (next && !next.textContent.trim() && !next.querySelector('img,iframe,[data-ud-vid],[data-ud-img]')) {
              next = next.nextElementSibling;
            }
            if (next && next.nextElementSibling) {
              t.parentElement.insertBefore(t, next.nextElementSibling);
            } else if (next) {
              t.parentElement.appendChild(t);
            }
          }
          setTimeout(syncToTextarea, 50);
        });
      });
    };

    // Restaura imatges reals: substitueix GIF transparent pel base64 real del magatzem
    const restoreImages = () => {
      editor.querySelectorAll('img[data-udid]').forEach(img => {
        const id = img.getAttribute('data-udid');
        const real = window._udImgStore[id];
        if (real && img.src.includes('R0lGODlh')) {
          img.src = real;
        }
      });
      // Reconstruïm els controls per a TOTES les imatges de l'editor
      editor.querySelectorAll('.ud-img-wrap-outer').forEach(wrap => {
        if (wrap.hasAttribute('data-ud-vid')) {
          rebuildVideoControls(wrap);
        } else {
          rebuildImageControls(wrap);
        }
      });
      // També per als vídeos que no tenen la classe ud-img-wrap-outer
      editor.querySelectorAll('[data-ud-vid]').forEach(wrap => {
        if (!wrap.classList.contains('ud-img-wrap-outer')) {
          wrap.classList.add('ud-img-wrap-outer');
        }
        rebuildVideoControls(wrap);
      });
      // També per a imatges soltes que no tenen wrap (de sessions antigues)
      editor.querySelectorAll('img').forEach(img => {
        if (img.closest('.ud-img-wrap-outer')) return;
        if (img.closest('[data-ud-vid]')) return; // els vídeos no
        if (img.src.includes('R0lGODlh')) return; // GIF transparent sense magatzem
        // Embolcalla la imatge en un wrap amb controls
        const wrap = document.createElement('div');
        wrap.setAttribute('data-ud-img', '1');
        wrap.className = 'ud-img-wrap-outer';
        wrap.contentEditable = 'false';
        const float = img.style.float;
        if (float === 'left' || float === 'right') {
          wrap.style.cssText = 'margin:8px 0;position:relative;display:block;min-height:10px;';
        } else {
          wrap.style.cssText = 'text-align:center;clear:both;margin:14px 0;position:relative;display:block;';
        }
        img.parentElement.insertBefore(wrap, img);
        wrap.appendChild(img);
        rebuildImageControls(wrap);
      });
    };

    // Executem restoreImages cada vegada que el contingut de l'editor canvia
    const imgObserver = new MutationObserver(() => {
      restoreImages();
    });
    imgObserver.observe(editor, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });

    // Restaurem també periòdicament per cobrir canvis externs
    [100, 300, 600, 1000, 2000].forEach(t => setTimeout(restoreImages, t));

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
    let lastVal = textarea.value;
    let isTyping = false;
    let typingTimer = null;

    editor.addEventListener('keydown', () => {
      isTyping = true;
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => { isTyping = false; }, 1000);
    });

    setInterval(() => {
      if (isTyping) return;
      if (textarea.value !== lastVal) {
        lastVal = textarea.value;
        const v = textarea.value;
        // Sempre actualitzem l'editor amb el nou contingut del textarea
        if (!v.includes('<')) {
          editor.innerHTML = v.split('\n').filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('') || '<p><br></p>';
        } else {
          editor.innerHTML = v;
        }
        // Després restaurem les imatges des del magatzem
        setTimeout(restoreImages, 50);
        setTimeout(restoreImages, 200);
        setTimeout(restoreImages, 500);
      }
    }, 300);

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
          wrap.style.cssText = 'overflow:visible;margin:4px 0 12px;position:relative;';
          img.style.cssText = `width:${curSz}%;float:left;margin:0 18px 12px 0;border-radius:8px;border:1px solid #e4e8f0;`;
        }
        if (action === 'right') {
          wrap.style.cssText = 'overflow:visible;margin:4px 0 12px;position:relative;';
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
        // Els controls ja estan gestionats per mousedown dins makeVidWrap
        return;
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
          container.style.cssText = 'overflow:visible;margin:4px 0 12px;';
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

    const processTextareas = () => {
      // Primer: netegem editors orfes (sense textarea germà)
      document.querySelectorAll('.ud-editor').forEach(ed => {
        const ta = ed.nextElementSibling;
        if (!ta || ta.tagName !== 'TEXTAREA') {
          const toolbar = ed.previousElementSibling;
          if (toolbar && toolbar.classList.contains('ud-toolbar')) toolbar.remove();
          ed.remove();
        }
      });
      // Després: processem textareas
      document.querySelectorAll('textarea').forEach(ta => {
        // Cas 1: textarea nou (sense udDone)
        if (!ta.dataset.udDone) {
          if (parseInt(ta.getAttribute('rows') || 0) >= 7) convertToEditor(ta);
          return;
        }
        // Cas 2: textarea amb udDone però visible (React l'ha recreat)
        if (ta.style.display !== 'none') {
          // Netegem editor i toolbar previs si estan orfes
          const prev = ta.previousElementSibling;
          if (prev && prev.classList.contains('ud-editor')) {
            const tb = prev.previousElementSibling;
            prev.remove();
            if (tb && tb.classList.contains('ud-toolbar')) tb.remove();
          }
          delete ta.dataset.udDone;
          if (parseInt(ta.getAttribute('rows') || 0) >= 7) convertToEditor(ta);
          return;
        }
        // Cas 3: textarea ocult amb udDone però sense editor germà (editor perdut)
        const prev = ta.previousElementSibling;
        if (!prev || !prev.classList.contains('ud-editor')) {
          delete ta.dataset.udDone;
          if (parseInt(ta.getAttribute('rows') || 0) >= 7) convertToEditor(ta);
        }
      });
      setupHeader();
      injectSASection();
      injectRubricSection();
    };

    new MutationObserver(processTextareas).observe(document.body, { childList: true, subtree: true });

    // També polling cada 500ms per capturar casos on el MutationObserver no es dispara
    setInterval(processTextareas, 500);

    [500,1000,2000,3000].forEach(t => setTimeout(() => { setupHeader(); injectSASection(); injectRubricSection(); }, t));

    // Netegem magatzem d'imatges orfes (IDs que no estan en cap unitat guardada)
    cleanOrphanImages();
    // Neteja automàtica cada 2 minuts
    setInterval(cleanOrphanImages, 120000);
  }

  // Elimina imatges del magatzem que ja no s'usen en cap unitat
  function cleanOrphanImages() {
    try {
      const store = JSON.parse(localStorage.getItem('_udImgStore') || '{}');
      const units = JSON.parse(localStorage.getItem('ud_units') || '[]');
      if (!Array.isArray(units)) return;
      const allContent = JSON.stringify(units);
      let removed = 0;
      Object.keys(store).forEach(id => {
        if (!allContent.includes(id)) {
          delete store[id];
          removed++;
        }
      });
      if (removed > 0) {
        localStorage.setItem('_udImgStore', JSON.stringify(store));
        window._udImgStore = store;
      }
    } catch(e){}
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
