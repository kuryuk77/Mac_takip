// Maç Takip — tek sayfalık statik uygulama. Veriyi data/ altındaki JSON dosyalarından okur.

const app = document.getElementById('app');
const tooltip = document.getElementById('tooltip');
const TZ = 'Europe/Istanbul';

/* ---------------- Veri yükleme ---------------- */

const cache = new Map();
function getJSON(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url, { cache: 'no-cache' }).then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${url}`);
        return r.json();
      }).catch((e) => { cache.delete(url); throw e; }),
    );
  }
  return cache.get(url);
}
const loadIndex = () => getJSON('data/index.json');
const loadComp = (id) => getJSON(`data/comp/${id}.json`);

async function allLeagues() {
  const idx = await loadIndex();
  const list = [...idx.cups, ...idx.countries.flatMap((c) => c.leagues.map((l) => ({ ...l, country: c.name })))];
  return list;
}
async function loadAllComps() {
  const list = (await allLeagues()).filter((l) => l.status === 'ok');
  const comps = await Promise.all(list.map((l) => loadComp(l.id).catch(() => null)));
  return comps.filter(Boolean).map((c) => ({ ...c, country: list.find((l) => l.id === c.id)?.country || 'Avrupa' }));
}

/* ---------------- Yardımcılar ---------------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt1 = (n) => (n == null || !isFinite(n) ? '—' : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const pct = (n) => (n == null || !isFinite(n) ? '—' : `%${Math.round(n * 100)}`);
const fold = (s) => String(s || '').toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');
const fmtDate = (iso, opts = { day: '2-digit', month: 'short' }) => new Date(iso).toLocaleDateString('tr-TR', { timeZone: TZ, ...opts });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fmtDateTime = (iso) => new Date(iso).toLocaleString('tr-TR', { timeZone: TZ, day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const age = (dob) => {
  if (!dob) return null;
  const d = new Date(dob), n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--;
  return a;
};
const crest = (t, cls = 'crest') => (t?.crest ? `<img class="${cls}" src="${esc(t.crest)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<span class="${cls}"></span>`);
const teamLink = (comp, id, { short = false } = {}) => {
  const t = comp.teams[id];
  if (!t) return '<span class="muted">?</span>';
  return `<a href="#/takim/${comp.id}/${id}">${esc(short ? t.short : t.name)}</a>`;
};
const teamCell = (comp, id, opts) => `<span class="team-cell">${crest(comp.teams[id])}${teamLink(comp, id, opts)}</span>`;
const playerLink = (id, name) => (id ? `<a href="#/oyuncu/${id}">${esc(name)}</a>` : esc(name));
const minuteStr = (g) => `${g.m}'${g.x ? `+${g.x}` : ''}`;
const isFinished = (m) => m.s === 'FINISHED' && m.hs != null && m.as != null;
const isLive = (m) => m.s === 'IN_PLAY' || m.s === 'PAUSED' || m.s === 'LIVE';

const STAGES = {
  REGULAR_SEASON: 'Normal Sezon', LEAGUE_STAGE: 'Lig Aşaması', GROUP_STAGE: 'Grup Aşaması',
  PLAYOFFS: 'Play-off', PLAYOFF_ROUND: 'Play-off Turu', LAST_32: 'Son 32', LAST_16: 'Son 16',
  QUARTER_FINALS: 'Çeyrek Final', SEMI_FINALS: 'Yarı Final', FINAL: 'Final', THIRD_PLACE: 'Üçüncülük',
  QUALIFICATION: 'Eleme', QUALIFICATION_ROUND_1: '1. Eleme Turu', QUALIFICATION_ROUND_2: '2. Eleme Turu',
  QUALIFICATION_ROUND_3: '3. Eleme Turu', PRELIMINARY_ROUND: 'Ön Eleme', ROUND_1: '1. Tur', ROUND_2: '2. Tur',
  ROUND_3: '3. Tur', ROUND_4: '4. Tur', CHAMPIONSHIP: 'Şampiyonluk Grubu', RELEGATION: 'Düşme Grubu',
};
const stageName = (s) => STAGES[s] || (s ? s.replace(/_/g, ' ').toLocaleLowerCase('tr-TR') : '');
const groupName = (g) => (g ? g.replace('GROUP_', 'Grup ') : '');
const POS = { Goalkeeper: 'Kaleci', Defence: 'Defans', Midfield: 'Orta saha', Offence: 'Forvet', Forward: 'Forvet', Defender: 'Defans', Midfielder: 'Orta saha', Attacker: 'Forvet' };
const posName = (p) => (p ? POS[p] || p : '—');

const STATUS = {
  locked: ['Ücretli planda', 'Bu lig football-data.org ücretsiz planında yok.'],
  stale: ['Güncel değil', 'Kaynakta bu ligin güncel sezonu yok.'],
  nokey: ['Veri yok', 'API anahtarı tanımlanınca veri çekilecek.'],
  error: ['Hata', 'Son güncellemede veri alınamadı.'],
};

function hideTooltip() { tooltip.hidden = true; }
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (!el) return hideTooltip();
  tooltip.innerHTML = el.dataset.tip;
  tooltip.hidden = false;
});
document.addEventListener('mousemove', (e) => {
  if (tooltip.hidden) return;
  const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + w > innerWidth - 8) x = e.clientX - w - 14;
  if (y + h > innerHeight - 8) y = e.clientY - h - 14;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
});

/* ---------------- Sıralanabilir tablo ---------------- */

// cols: { key, label, val(row), html(row), num, bar, title, sort:false, desc }
function mountTable(el, { cols, rows, sort, desc = true, rank = false, empty = 'Veri yok', limit }) {
  let key = sort, dir = desc;
  const render = () => {
    const col = cols.find((c) => c.key === key);
    let data = rows.slice();
    if (col) {
      const v = col.val || ((r) => r[col.key]);
      data.sort((a, b) => {
        const x = v(a), y = v(b);
        if (x == null && y == null) return 0;
        if (x == null) return 1;
        if (y == null) return -1;
        const r = typeof x === 'string' ? x.localeCompare(y, 'tr') : x - y;
        return dir ? -r : r;
      });
    }
    if (limit) data = data.slice(0, limit);
    const max = {};
    for (const c of cols) if (c.bar) max[c.key] = Math.max(0, ...data.map((r) => (c.val || ((x) => x[c.key]))(r) || 0));
    const head = `${rank ? '<th>#</th>' : ''}${cols.map((c) => {
      const cls = [c.num ? 'num' : '', c.sort === false ? '' : 'sortable', c.key === key ? `sorted${dir ? '' : ' asc'}` : ''].join(' ');
      return `<th class="${cls}" data-k="${c.key}" ${c.title ? `title="${esc(c.title)}"` : ''}>${c.label}</th>`;
    }).join('')}`;
    const body = data.length
      ? data.map((r, i) => `<tr>${rank ? `<td class="rank">${i + 1}</td>` : ''}${cols.map((c) => {
        const raw = (c.val || ((x) => x[c.key]))(r);
        let inner = c.html ? c.html(r) : esc(raw ?? '—');
        if (c.bar) {
          const w = max[c.key] ? Math.max(0, (raw || 0) / max[c.key]) * 100 : 0;
          inner = `<span class="barcell"><span>${inner}</span><span class="track"><span class="fill" style="width:${w}%"></span></span></span>`;
        }
        return `<td class="${c.num ? 'num' : ''} ${c.key === key && c.num ? 'strong' : ''} ${c.cls || ''}">${inner}</td>`;
      }).join('')}</tr>`).join('')
      : `<tr><td colspan="${cols.length + (rank ? 1 : 0)}" class="empty">${empty}</td></tr>`;
    el.innerHTML = `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };
  el.onclick = (e) => {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const k = th.dataset.k;
    if (k === key) dir = !dir;
    else { key = k; dir = !(cols.find((c) => c.key === k)?.asc); }
    render();
  };
  render();
  return { update(newRows) { rows = newRows; render(); } };
}

/* ---------------- İstatistik hesapları ---------------- */

function weekKey(m) {
  if (m.md != null && (m.st === 'REGULAR_SEASON' || m.st === 'LEAGUE_STAGE' || m.st === 'GROUP_STAGE' || !m.st)) return `md-${m.md}`;
  if (m.md != null) return `${m.st}-${m.md}`;
  return m.st || 'other';
}
function weekLabel(m) {
  if (m.md != null && (m.st === 'REGULAR_SEASON' || !m.st)) return `${m.md}. Hafta`;
  if (m.md != null && (m.st === 'LEAGUE_STAGE' || m.st === 'GROUP_STAGE')) return `${m.md}. Maç Günü`;
  if (m.md != null) return `${stageName(m.st)} · ${m.md}. maç`;
  return stageName(m.st);
}
const goalsOf = (m) => m.hs + m.as;

function summarize(matches, comp) {
  const fin = matches.filter(isFinished);
  const s = {
    played: fin.length,
    total: matches.length,
    goals: 0, home: 0, draw: 0, away: 0, btts: 0, o25: 0, cleanSheets: 0,
    top: null, biggest: null, earliest: null, latest: null,
    reds: comp.hasCards ? 0 : null, yellows: comp.hasCards ? 0 : null,
  };
  for (const m of fin) {
    const g = goalsOf(m);
    s.goals += g;
    if (m.hs > m.as) s.home++; else if (m.hs < m.as) s.away++; else s.draw++;
    if (m.hs > 0 && m.as > 0) s.btts++;
    if (g > 2) s.o25++;
    if (!s.top || g > goalsOf(s.top)) s.top = m;
    if (!s.biggest || Math.abs(m.hs - m.as) > Math.abs(s.biggest.hs - s.biggest.as)) s.biggest = m;
    for (const gl of m.goals || []) {
      const t = gl.m + (gl.x || 0) / 100;
      if (!s.earliest || t < s.earliest.t) s.earliest = { t, g: gl, m };
      if (!s.latest || t > s.latest.t) s.latest = { t, g: gl, m };
    }
    for (const c of m.cards || []) {
      if (c.c === 'RED' || c.c === 'YELLOW_RED') s.reds++;
      else if (c.c === 'YELLOW') s.yellows++;
    }
  }
  s.avg = s.played ? s.goals / s.played : null;
  return s;
}

function weeks(comp) {
  const map = new Map();
  for (const m of comp.matches) {
    const k = weekKey(m);
    if (!map.has(k)) map.set(k, { key: k, label: weekLabel(m), md: m.md, stage: m.st, matches: [], first: m.d });
    const w = map.get(k);
    w.matches.push(m);
    if (m.d < w.first) w.first = m.d;
  }
  const list = [...map.values()].sort((a, b) => a.first.localeCompare(b.first));
  list.forEach((w, i) => { w.i = i; w.sum = summarize(w.matches, comp); });
  return list;
}

function teamStats(comp) {
  const t = {};
  const get = (id) => (t[id] ||= { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, fts: 0, btts: 0, o25: 0, hp: 0, hpts: 0, ap: 0, apts: 0, best: null });
  for (const m of comp.matches.filter(isFinished)) {
    for (const side of ['h', 'a']) {
      const id = m[side];
      if (id == null) continue;
      const r = get(id);
      const gf = side === 'h' ? m.hs : m.as, ga = side === 'h' ? m.as : m.hs;
      r.p++; r.gf += gf; r.ga += ga;
      const pts = gf > ga ? 3 : gf === ga ? 1 : 0;
      if (gf > ga) r.w++; else if (gf === ga) r.d++; else r.l++;
      if (ga === 0) r.cs++;
      if (gf === 0) r.fts++;
      if (gf > 0 && ga > 0) r.btts++;
      if (gf + ga > 2) r.o25++;
      if (side === 'h') { r.hp++; r.hpts += pts; } else { r.ap++; r.apts += pts; }
      if (gf > ga && (!r.best || gf - ga > r.best.diff)) r.best = { diff: gf - ga, m };
    }
  }
  return Object.values(t);
}

function scoreLine(comp, m) {
  return `${esc(comp.teams[m.h]?.short || '?')} ${m.hs}-${m.as} ${esc(comp.teams[m.a]?.short || '?')}`;
}

/* ---------------- Ortak bileşenler ---------------- */

function matchRow(comp, m, { hl = false, showDate = true } = {}) {
  let center;
  if (isFinished(m) || isLive(m)) {
    const ht = m.hh != null ? `<span class="ht">İY ${m.hh}-${m.ah}</span>` : '';
    center = `<div class="score ${isLive(m) ? 'live' : ''}">${m.hs ?? 0} - ${m.as ?? 0}${ht}</div>`;
  } else {
    const txt = { POSTPONED: 'Ert.', CANCELLED: 'İptal', SUSPENDED: 'Durd.' }[m.s] || fmtTime(m.d);
    center = `<div class="score muted">${txt}</div>`;
  }
  const hw = isFinished(m) && m.hs > m.as, aw = isFinished(m) && m.as > m.hs;
  const when = showDate ? `${fmtDate(m.d)}<br>${isLive(m) ? '<b>Canlı</b>' : isFinished(m) ? 'MS' : fmtTime(m.d)}` : (isFinished(m) ? 'MS' : '');
  let events = '';
  if (m.goals?.length || m.cards?.some((c) => c.c !== 'YELLOW')) {
    const g = (m.goals || []).map((x) => `⚽ ${minuteStr(x)} ${esc(x.p?.name || '')}${x.k === 'PENALTY' ? ' (P)' : x.k === 'OWN' ? ' (KK)' : ''}`);
    const r = (m.cards || []).filter((c) => c.c !== 'YELLOW').map((c) => `🟥 ${c.m}' ${esc(c.p?.name || '')}`);
    events = `<div class="events">${[...g, ...r].map((x) => `<span>${x}</span>`).join('')}</div>`;
  }
  return `<div class="match ${hl ? 'hl' : ''}">
    <div class="when">${when}</div>
    <div class="home ${hw ? 'winner' : ''}">${teamLink(comp, m.h, { short: true })}${crest(comp.teams[m.h])}</div>
    ${center}
    <div class="away ${aw ? 'winner' : ''}">${crest(comp.teams[m.a])}${teamLink(comp, m.a, { short: true })}</div>
    ${events}
  </div>`;
}

function formBadges(form) {
  if (!form) return '<span class="muted">—</span>';
  const map = { W: ['G', 'Galibiyet'], D: ['B', 'Beraberlik'], L: ['M', 'Mağlubiyet'] };
  return `<span class="form">${form.split(',').filter(Boolean).map((f) => `<span class="${f}" title="${map[f]?.[1] || f}">${map[f]?.[0] || f}</span>`).join('')}</span>`;
}

function formFromMatches(comp, teamId, n = 5) {
  const ms = comp.matches.filter((m) => isFinished(m) && (m.h === teamId || m.a === teamId)).slice(-n);
  return ms.map((m) => {
    const gf = m.h === teamId ? m.hs : m.as, ga = m.h === teamId ? m.as : m.hs;
    return gf > ga ? 'W' : gf === ga ? 'D' : 'L';
  }).join(',');
}

function stat(label, value, sub = '', sm = false) {
  return `<div class="card stat"><span class="label">${label}</span><span class="value ${sm ? 'sm' : ''}">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
}

function missingNote(comp, extra = '') {
  const parts = [];
  if (!comp?.hasGoalDetail) parts.push('gol dakikaları');
  if (!comp?.hasCards) parts.push('sarı/kırmızı kartlar');
  parts.push('korner, şut, pas ve kritik pas');
  return `<div class="notice"><strong>Bazı istatistikler veri kaynağında yok</strong>${parts.join(', ')} football-data.org ücretsiz planında sunulmuyor. ${extra}</div>`;
}

function hbarChart(items, { title, sub = '', fmt = (v) => v }) {
  const max = Math.max(0, ...items.map((i) => i.v));
  return `<div class="chart"><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}<div class="hbars">${items.map((i) => `
    <div class="hbar" data-tip="${esc(i.tip || `${i.label}: ${fmt(i.v)}`)}">
      <span class="name">${i.html || esc(i.label)}</span>
      <span class="track"><span class="fill" style="width:${max ? (i.v / max) * 100 : 0}%"></span></span>
      <span class="val">${fmt(i.v)}</span>
    </div>`).join('')}</div></div>`;
}

/* ---------------- Sayfalar ---------------- */

async function pageHome() {
  const idx = await loadIndex();
  const okCount = [...idx.cups, ...idx.countries.flatMap((c) => c.leagues)].filter((l) => l.status === 'ok').length;
  const leagueCount = idx.countries.reduce((n, c) => n + c.leagues.length, 0);
  const li = (l) => {
    const st = STATUS[l.status];
    if (l.status === 'ok') return `<li><a href="#/lig/${l.id}">${esc(l.name)}</a>${l.matchday ? `<span class="badge ok">${l.matchday}. hafta</span>` : ''}</li>`;
    return `<li class="disabled"><span title="${esc(st?.[1] || '')}">${esc(l.name)}</span><span class="badge" title="${esc(st?.[1] || '')}">${st?.[0] || '—'}</span></li>`;
  };
  const sorted = idx.countries.slice().sort((a, b) => {
    const sa = a.leagues.some((l) => l.status === 'ok'), sb = b.leagues.some((l) => l.status === 'ok');
    if (sa !== sb) return sa ? -1 : 1;
    if (!!a.leagues.length !== !!b.leagues.length) return a.leagues.length ? -1 : 1;
    return 0;
  });
  app.innerHTML = `
    <h1>Avrupa ligleri</h1>
    <p class="muted">UEFA'nın ${idx.countries.length} üye ülkesi, ${leagueCount} lig. Şu an ${okCount} ligin verisi var.</p>
    ${!idx.configured ? `<div class="notice"><strong>Veri henüz çekilmedi</strong>Ücretsiz bir football-data.org API anahtarını GitHub'da <code>FOOTBALL_DATA_TOKEN</code> adlı secret olarak ekleyip "Veriyi güncelle ve yayınla" iş akışını çalıştırın. Ayrıntılar README dosyasında.</div>` : ''}
    <h2>UEFA kupaları</h2>
    <div class="cup-row">${idx.cups.map((c) => c.status === 'ok'
      ? `<a class="card cup-card" href="#/lig/${c.id}">${c.emblem ? `<img src="${esc(c.emblem)}" alt="">` : ''}<span><b>${esc(c.name)}</b><br><span class="muted small">${c.matchday ? `${c.matchday}. maç günü` : 'Sezon'}</span></span></a>`
      : `<div class="card cup-card disabled">${c.emblem ? `<img src="${esc(c.emblem)}" alt="">` : ''}<span><b>${esc(c.name)}</b><br><span class="badge">${STATUS[c.status]?.[0] || '—'}</span></span></div>`).join('')}</div>
    <h2>Ülkeler</h2>
    <div class="grid countries">${sorted.map((c) => `
      <div class="card country-card">
        <h3>${c.flag ? `<img class="flag" src="${esc(c.flag)}" alt="">` : ''}${esc(c.name)}</h3>
        ${c.leagues.length ? `<ul class="league-list">${c.leagues.map(li).join('')}</ul>` : '<p class="muted small">Veri kaynağında bu ülkenin ligi yok.</p>'}
      </div>`).join('')}</div>`;
}

const LEAGUE_TABS = [
  ['puan', 'Puan Durumu'],
  ['fikstur', 'Fikstür'],
  ['haftalar', 'Hafta Hafta'],
  ['oyuncular', 'Oyuncular'],
  ['takimlar', 'Takım İstatistikleri'],
];

async function pageLeague(id, tab = 'puan', arg) {
  const comp = await loadComp(id);
  const idx = await loadIndex();
  const country = idx.countries.find((c) => c.leagues.some((l) => l.id === comp.id));
  const season = comp.season.start ? `${comp.season.start.slice(0, 4)}/${(comp.season.end || '').slice(2, 4)}` : '';
  app.innerHTML = `
    <div class="crumbs"><a href="#/">Ligler</a> › ${esc(country?.name || 'Avrupa')}</div>
    <div class="page-head">
      ${comp.emblem ? `<img class="emblem" src="${esc(comp.emblem)}" alt="">` : ''}
      <div>
        <h1>${esc(comp.name)}</h1>
        <div class="meta">${comp.area?.flag ? `<img class="flag" src="${esc(comp.area.flag)}" alt="">` : ''}<span>${esc(country?.name || comp.area?.name || '')}</span><span>· ${season} sezonu</span>${comp.season.matchday ? `<span>· ${comp.season.matchday}. hafta</span>` : ''}</div>
      </div>
    </div>
    <nav class="tabs">${LEAGUE_TABS.map(([k, l]) => `<a href="#/lig/${id}/${k}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>
    <div id="tab"></div>`;
  const el = document.getElementById('tab');
  ({ puan: tabStandings, fikstur: tabFixtures, haftalar: tabWeeks, oyuncular: tabPlayers, takimlar: tabTeams }[tab] || tabStandings)(el, comp, arg);
}

function tabStandings(el, comp) {
  let type = 'TOTAL';
  const render = () => {
    const tables = comp.standings.filter((s) => s.type === type);
    if (!tables.length) { el.querySelector('#tables').innerHTML = '<div class="card empty">Puan durumu yok (eleme usulü turnuva olabilir).</div>'; return; }
    el.querySelector('#tables').innerHTML = tables.map((s, i) => `
      ${tables.length > 1 || s.group ? `<h3 style="margin-top:${i ? 18 : 0}px">${esc(groupName(s.group) || stageName(s.stage))}</h3>` : ''}
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Takım</th><th class="num" title="Oynanan">O</th><th class="num" title="Galibiyet">G</th><th class="num" title="Beraberlik">B</th><th class="num" title="Mağlubiyet">M</th><th class="num" title="Atılan">A</th><th class="num" title="Yenilen">Y</th><th class="num" title="Averaj">Av</th><th class="num">Puan</th><th>Form</th></tr></thead>
        <tbody>${s.table.map((r) => `<tr>
          <td class="rank">${r.pos}</td><td>${teamCell(comp, r.team)}</td>
          <td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td>
          <td class="num">${r.gf}</td><td class="num">${r.ga}</td><td class="num">${r.gd > 0 ? '+' : ''}${r.gd}</td>
          <td class="num strong">${r.pts}</td><td>${formBadges(type === 'TOTAL' ? (r.form || formFromMatches(comp, r.team)) : r.form)}</td></tr>`).join('')}</tbody>
      </table></div>`).join('');
  };
  const hasSplit = comp.standings.some((s) => s.type === 'HOME');
  el.innerHTML = `${hasSplit ? `<div class="toolbar"><div class="seg" id="seg">
      <button data-t="TOTAL" class="active">Genel</button><button data-t="HOME">İç saha</button><button data-t="AWAY">Deplasman</button></div></div>` : ''}
    <div id="tables"></div>`;
  el.querySelector('#seg')?.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    type = b.dataset.t;
    el.querySelectorAll('#seg button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  });
  render();
}

function tabFixtures(el, comp, arg) {
  const ws = weeks(comp);
  if (!ws.length) { el.innerHTML = '<div class="card empty">Fikstür yok.</div>'; return; }
  let cur = ws.findIndex((w) => w.key === arg);
  if (cur < 0) {
    cur = ws.findIndex((w) => w.matches.some((m) => !isFinished(m)));
    const md = comp.season.matchday;
    const byMd = ws.findIndex((w) => w.md === md && (w.stage === 'REGULAR_SEASON' || w.stage === 'LEAGUE_STAGE'));
    if (byMd >= 0) cur = byMd;
    if (cur < 0) cur = ws.length - 1;
  }
  const render = () => {
    const w = ws[cur];
    const byDay = new Map();
    for (const m of w.matches.slice().sort((a, b) => a.d.localeCompare(b.d))) {
      const k = fmtDate(m.d, { weekday: 'long', day: 'numeric', month: 'long' });
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(m);
    }
    el.innerHTML = `
      <div class="toolbar">
        <button class="chip" id="prev" ${cur === 0 ? 'disabled' : ''}>‹ Önceki</button>
        <select id="wk">${ws.map((x, i) => `<option value="${i}" ${i === cur ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
        <button class="chip" id="next" ${cur === ws.length - 1 ? 'disabled' : ''}>Sonraki ›</button>
        ${w.sum.played ? `<span class="muted small">${w.sum.played} maç oynandı · ${w.sum.goals} gol · <a href="#/lig/${comp.id}/haftalar/${encodeURIComponent(w.key)}">hafta istatistikleri</a></span>` : ''}
      </div>
      <div class="match-list">${[...byDay].map(([d, ms]) => `<div class="group-title">${esc(d)}</div>${ms.map((m) => matchRow(comp, m, { showDate: false })).join('')}`).join('')}</div>`;
    el.querySelector('#prev').onclick = () => { cur--; render(); };
    el.querySelector('#next').onclick = () => { cur++; render(); };
    el.querySelector('#wk').onchange = (e) => { cur = Number(e.target.value); render(); };
  };
  render();
}

function seasonRecords(comp) {
  const fin = comp.matches.filter(isFinished);
  const s = summarize(comp.matches, comp);
  const topMatches = fin.slice().sort((a, b) => goalsOf(b) - goalsOf(a) || a.d.localeCompare(b.d)).slice(0, 5);
  const bigWins = fin.slice().sort((a, b) => Math.abs(b.hs - b.as) - Math.abs(a.hs - a.as) || goalsOf(b) - goalsOf(a)).slice(0, 5);
  return { s, topMatches, bigWins };
}

function tabWeeks(el, comp, arg) {
  const ws = weeks(comp).filter((w) => w.sum.played > 0);
  if (!ws.length) { el.innerHTML = '<div class="card empty">Henüz oynanmış maç yok.</div>'; return; }
  const sel = arg ? ws.find((w) => w.key === decodeURIComponent(arg)) : null;
  if (sel) return weekDetail(el, comp, sel, ws);

  const { s, topMatches, bigWins } = seasonRecords(comp);
  const maxG = Math.max(...ws.map((w) => w.sum.goals));
  const short = (w) => (w.md != null ? String(w.md) : stageName(w.stage).slice(0, 3));
  el.innerHTML = `
    <div class="grid stats">
      ${stat('Toplam gol', s.goals, `${s.played} maçta`)}
      ${stat('Maç başına gol', fmt1(s.avg))}
      ${stat('Ev / Beraberlik / Dep.', `${pct(s.home / s.played)} · ${pct(s.draw / s.played)} · ${pct(s.away / s.played)}`, `${s.home} · ${s.draw} · ${s.away} maç`, true)}
      ${stat('2,5 üst', pct(s.o25 / s.played), `Karşılıklı gol: ${pct(s.btts / s.played)}`)}
      ${s.top ? stat('En gollü maç', `${goalsOf(s.top)} gol`, `${scoreLine(comp, s.top)} · ${weekLabel(s.top)}`) : ''}
      ${s.biggest ? stat('En farklı skor', `${s.biggest.hs}-${s.biggest.as}`, `${scoreLine(comp, s.biggest)} · ${weekLabel(s.biggest)}`) : ''}
      ${s.earliest ? stat('En erken gol', minuteStr(s.earliest.g), `${esc(s.earliest.g.p?.name || '')} · ${scoreLine(comp, s.earliest.m)}`) : stat('En erken gol', '—', 'Gol dakikası verisi yok', true)}
      ${s.latest ? stat('En geç gol', minuteStr(s.latest.g), `${esc(s.latest.g.p?.name || '')} · ${scoreLine(comp, s.latest.m)}`) : stat('En geç gol', '—', 'Gol dakikası verisi yok', true)}
      ${s.reds != null ? stat('Kırmızı kart', s.reds, `Sarı kart: ${s.yellows}`) : stat('Kırmızı kart', '—', 'Kart verisi yok', true)}
    </div>
    ${missingNote(comp)}
    <h2>Hafta hafta goller</h2>
    <div class="chart">
      <div class="sub">Bir sütuna tıklayınca o haftanın ayrıntıları açılır.</div>
      <div class="vbars">${ws.map((w) => `<a class="col" href="#/lig/${comp.id}/haftalar/${encodeURIComponent(w.key)}" data-tip="<b>${esc(w.label)}</b><br>${w.sum.goals} gol · ${w.sum.played} maç<br>Maç başına ${fmt1(w.sum.avg)}">
        <span class="v" style="bottom:calc(${(w.sum.goals / maxG) * 100}% + 2px)">${ws.length <= 40 ? w.sum.goals : ''}</span>
        <span class="b" style="height:${(w.sum.goals / maxG) * 100}%"></span></a>`).join('')}</div>
      <div class="vaxis">${ws.map((w, i) => `<span>${ws.length > 24 && i % 2 ? '' : esc(short(w))}</span>`).join('')}</div>
    </div>
    <h2>Haftalık tablo</h2>
    <div id="wk-table"></div>
    <div class="grid two" style="margin-top:8px">
      <div><h2>En gollü maçlar</h2><div class="match-list">${topMatches.map((m) => matchRow(comp, m)).join('')}</div></div>
      <div><h2>En farklı skorlar</h2><div class="match-list">${bigWins.map((m) => matchRow(comp, m)).join('')}</div></div>
    </div>`;
  mountTable(el.querySelector('#wk-table'), {
    rows: ws,
    sort: 'i', desc: false,
    cols: [
      { key: 'i', label: 'Hafta', asc: true, html: (w) => `<a href="#/lig/${comp.id}/haftalar/${encodeURIComponent(w.key)}">${esc(w.label)}</a>`, val: (w) => w.i },
      { key: 'played', label: 'Maç', num: true, val: (w) => w.sum.played },
      { key: 'goals', label: 'Gol', num: true, bar: true, val: (w) => w.sum.goals },
      { key: 'avg', label: 'Gol/Maç', num: true, val: (w) => w.sum.avg, html: (w) => fmt1(w.sum.avg) },
      { key: 'res', label: 'Ev-B-Dep', num: true, sort: false, html: (w) => `${w.sum.home}-${w.sum.draw}-${w.sum.away}` },
      { key: 'top', label: 'En gollü maç', sort: false, html: (w) => (w.sum.top ? `${scoreLine(comp, w.sum.top)}` : '—') },
      ...(comp.hasCards ? [{ key: 'reds', label: 'Kırmızı', num: true, val: (w) => w.sum.reds }] : []),
    ],
  });
}

function weekDetail(el, comp, w, ws) {
  const s = w.sum;
  const i = ws.indexOf(w);
  const nav = (x) => (x ? `href="#/lig/${comp.id}/haftalar/${encodeURIComponent(x.key)}"` : 'aria-disabled="true" style="opacity:.4;pointer-events:none"');
  const scorers = new Map();
  for (const m of w.matches) for (const g of m.goals || []) {
    if (!g.p || g.k === 'OWN') continue;
    const r = scorers.get(g.p.id) || { ...g.p, n: 0, team: g.t };
    r.n++; scorers.set(g.p.id, r);
  }
  el.innerHTML = `
    <div class="toolbar">
      <a class="chip" href="#/lig/${comp.id}/haftalar">‹ Tüm haftalar</a>
      <a class="chip" ${nav(ws[i - 1])}>‹ Önceki</a><a class="chip" ${nav(ws[i + 1])}>Sonraki ›</a>
    </div>
    <h2 style="margin-top:4px">${esc(w.label)}</h2>
    <div class="grid stats">
      ${stat('Atılan gol', s.goals, `${s.played} maçta${s.played < w.matches.length ? ` (${w.matches.length - s.played} maç oynanmadı)` : ''}`)}
      ${stat('Maç başına gol', fmt1(s.avg))}
      ${stat('Ev / Beraberlik / Dep.', `${s.home} · ${s.draw} · ${s.away}`, '', true)}
      ${stat('2,5 üst', `${s.o25} maç`, `Karşılıklı gol: ${s.btts} maç`)}
      ${s.top ? stat('En gollü maç', `${goalsOf(s.top)} gol`, scoreLine(comp, s.top)) : ''}
      ${s.biggest ? stat('En farklı skor', `${s.biggest.hs}-${s.biggest.as}`, scoreLine(comp, s.biggest)) : ''}
      ${s.earliest ? stat('En erken gol', minuteStr(s.earliest.g), `${esc(s.earliest.g.p?.name || '')} · ${scoreLine(comp, s.earliest.m)}`) : stat('En erken gol', '—', 'Gol dakikası verisi yok', true)}
      ${s.latest ? stat('En geç gol', minuteStr(s.latest.g), `${esc(s.latest.g.p?.name || '')} · ${scoreLine(comp, s.latest.m)}`) : stat('En geç gol', '—', 'Gol dakikası verisi yok', true)}
      ${s.reds != null ? stat('Kart', `${s.reds} kırmızı`, `${s.yellows} sarı`) : stat('Kırmızı kart', '—', 'Kart verisi yok', true)}
    </div>
    ${missingNote(comp)}
    <h2>Maçlar</h2>
    <div class="match-list">${w.matches.slice().sort((a, b) => a.d.localeCompare(b.d)).map((m) => matchRow(comp, m, { hl: m === s.top })).join('')}</div>
    ${scorers.size ? `<h2>Haftanın golcüleri</h2><div class="match-list">${[...scorers.values()].sort((a, b) => b.n - a.n).map((p) => `<div class="match" style="grid-template-columns:1fr auto"><span>${playerLink(p.id, p.name)} <span class="muted small">${esc(comp.teams[p.team]?.short || '')}</span></span><b>${p.n}</b></div>`).join('')}</div>` : ''}`;
}

function scorerCols(comp, { team = true } = {}) {
  return [
    { key: 'name', label: 'Oyuncu', asc: true, html: (r) => `${playerLink(r.id, r.name)}<div class="muted small">${esc(posName(r.pos))}${r.nat ? ` · ${esc(r.nat)}` : ''}</div>` },
    ...(team ? [{ key: 'team', label: 'Takım', val: (r) => comp.teams[r.team]?.short || '', asc: true, html: (r) => teamCell(comp, r.team, { short: true }) }] : []),
    { key: 'mp', label: 'Maç', num: true },
    { key: 'g', label: 'Gol', num: true, bar: true },
    { key: 'a', label: 'Asist', num: true },
    { key: 'ga', label: 'G+A', num: true, val: (r) => r.g + (r.a || 0), title: 'Gol + asist' },
    { key: 'pen', label: 'Penaltı', num: true, title: 'Penaltıdan gol' },
    { key: 'gpm', label: 'Gol/Maç', num: true, val: (r) => (r.mp ? r.g / r.mp : null), html: (r) => fmt1(r.mp ? r.g / r.mp : null) },
  ];
}

function tabPlayers(el, comp) {
  const teams = Object.values(comp.teams).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  el.innerHTML = `
    <div class="toolbar">
      <input type="search" id="q" placeholder="Oyuncu ara…">
      <select id="tm"><option value="">Tüm takımlar</option>${teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
    </div>
    <div class="grid two" id="leaders"></div>
    <h2>Tüm oyuncular</h2>
    <p class="muted small">Kaynak yalnızca gol veya asist kaydı olan ilk ${comp.scorers.length} oyuncuyu veriyor. Başlıklara tıklayarak sıralayabilirsin.</p>
    <div id="tbl"></div>
    ${missingNote(comp, 'Bu yüzden oyuncu tablosunda yalnızca gol, asist, penaltı ve maç sayısı var.')}`;
  const topBy = (key, title, v = (r) => r[key]) => hbarChart(
    comp.scorers.slice().sort((a, b) => (v(b) || 0) - (v(a) || 0)).slice(0, 10).map((r) => ({ label: r.name, html: `${playerLink(r.id, r.name)}`, v: v(r) || 0, tip: `${r.name} (${comp.teams[r.team]?.short || ''}): ${v(r) || 0}` })),
    { title },
  );
  el.querySelector('#leaders').innerHTML = topBy('g', 'Gol krallığı') + topBy('a', 'Asist krallığı');
  const t = mountTable(el.querySelector('#tbl'), { rows: comp.scorers, sort: 'g', rank: true, cols: scorerCols(comp) });
  const filter = () => {
    const q = fold(el.querySelector('#q').value), tm = Number(el.querySelector('#tm').value);
    t.update(comp.scorers.filter((r) => (!q || fold(r.name).includes(q)) && (!tm || r.team === tm)));
  };
  el.querySelector('#q').oninput = filter;
  el.querySelector('#tm').onchange = filter;
}

function tabTeams(el, comp) {
  const rows = teamStats(comp);
  if (!rows.length) { el.innerHTML = '<div class="card empty">Henüz oynanmış maç yok.</div>'; return; }
  const best = (f, asc = false) => rows.slice().sort((a, b) => (asc ? f(a) - f(b) : f(b) - f(a)))[0];
  const att = best((r) => r.gf / r.p), def = best((r) => r.ga / r.p, true), cs = best((r) => r.cs), home = best((r) => (r.hp ? r.hpts / r.hp : 0)), away = best((r) => (r.ap ? r.apts / r.ap : 0));
  const tn = (r) => esc(comp.teams[r.id]?.short || '?');
  el.innerHTML = `
    <div class="grid stats">
      ${stat('En golcü takım', tn(att), `${att.gf} gol · maç başı ${fmt1(att.gf / att.p)}`, true)}
      ${stat('En az gol yiyen', tn(def), `${def.ga} gol · maç başı ${fmt1(def.ga / def.p)}`, true)}
      ${stat('En çok gol yemeden', tn(cs), `${cs.cs} maç`, true)}
      ${stat('En iyi iç saha', tn(home), `maç başı ${fmt1(home.hpts / home.hp)} puan`, true)}
      ${stat('En iyi deplasman', tn(away), `maç başı ${fmt1(away.apts / away.ap)} puan`, true)}
    </div>
    <h2>Takım istatistikleri</h2>
    <div id="tbl"></div>
    ${missingNote(comp, 'Takım istatistikleri skorlardan hesaplanır.')}`;
  mountTable(el.querySelector('#tbl'), {
    rows, sort: 'gf', rank: true,
    cols: [
      { key: 'name', label: 'Takım', asc: true, val: (r) => comp.teams[r.id]?.name || '', html: (r) => teamCell(comp, r.id) },
      { key: 'p', label: 'O', num: true, title: 'Oynanan' },
      { key: 'gf', label: 'Atılan', num: true, bar: true },
      { key: 'ga', label: 'Yenilen', num: true },
      { key: 'gfa', label: 'Atılan/M', num: true, val: (r) => r.gf / r.p, html: (r) => fmt1(r.gf / r.p) },
      { key: 'gaa', label: 'Yenilen/M', num: true, asc: true, val: (r) => r.ga / r.p, html: (r) => fmt1(r.ga / r.p) },
      { key: 'cs', label: 'Gol yemedi', num: true, title: 'Gol yenmeyen maç' },
      { key: 'fts', label: 'Gol atamadı', num: true },
      { key: 'btts', label: 'KG Var', num: true, title: 'Karşılıklı gol oranı', val: (r) => r.btts / r.p, html: (r) => pct(r.btts / r.p) },
      { key: 'o25', label: '2,5 Üst', num: true, val: (r) => r.o25 / r.p, html: (r) => pct(r.o25 / r.p) },
      { key: 'hppg', label: 'İç saha P/M', num: true, val: (r) => (r.hp ? r.hpts / r.hp : null), html: (r) => fmt1(r.hp ? r.hpts / r.hp : null) },
      { key: 'appg', label: 'Dep. P/M', num: true, val: (r) => (r.ap ? r.apts / r.ap : null), html: (r) => fmt1(r.ap ? r.apts / r.ap : null) },
      { key: 'best', label: 'En farklı galibiyet', sort: false, html: (r) => (r.best ? scoreLine(comp, r.best.m) : '—') },
    ],
  });
}

async function pageTeam(compId, teamId) {
  const comp = await loadComp(compId);
  const id = Number(teamId);
  const t = comp.teams[id];
  if (!t) { app.innerHTML = '<div class="card empty">Takım bulunamadı.</div>'; return; }
  const rowOf = (type) => comp.standings.filter((s) => s.type === type).flatMap((s) => s.table).find((r) => r.team === id);
  const total = rowOf('TOTAL'), home = rowOf('HOME'), away = rowOf('AWAY');
  const ts = teamStats(comp).find((r) => r.id === id);
  const mine = comp.matches.filter((m) => m.h === id || m.a === id);
  const past = mine.filter(isFinished).slice(-6).reverse();
  const next = mine.filter((m) => !isFinished(m) && m.s !== 'CANCELLED').slice(0, 5);
  const scorerMap = new Map(comp.scorers.filter((s) => s.team === id).map((s) => [s.id, s]));
  const order = ['Goalkeeper', 'Defence', 'Midfield', 'Offence'];
  const squad = (t.squad || []).map((p) => ({ ...p, ...(scorerMap.get(p.id) ? { g: scorerMap.get(p.id).g, a: scorerMap.get(p.id).a, mp: scorerMap.get(p.id).mp } : { g: 0, a: 0, mp: null }) }));
  const splitRow = (label, r) => (r ? `<tr><td>${label}</td><td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.l}</td><td class="num">${r.gf}</td><td class="num">${r.ga}</td><td class="num strong">${r.pts}</td></tr>` : '');

  app.innerHTML = `
    <div class="crumbs"><a href="#/">Ligler</a> › <a href="#/lig/${comp.id}">${esc(comp.name)}</a></div>
    <div class="page-head">
      ${crest(t, 'crest lg')}
      <div>
        <h1>${esc(t.name)}</h1>
        <div class="meta">${[t.founded && `Kuruluş ${t.founded}`, t.venue, t.coach && `Teknik direktör: ${esc(t.coach.name)}`].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('<span>·</span>')}</div>
      </div>
    </div>
    <div class="grid stats">
      ${total ? stat('Sıralama', `${total.pos}.`, `${total.pts} puan · ${total.p} maç`) : ''}
      ${ts ? stat('Atılan / Yenilen', `${ts.gf} / ${ts.ga}`, `maç başı ${fmt1(ts.gf / ts.p)} / ${fmt1(ts.ga / ts.p)}`) : ''}
      ${ts ? stat('Gol yemediği maç', ts.cs, `Gol atamadığı: ${ts.fts}`) : ''}
      ${ts ? stat('Karşılıklı gol', pct(ts.btts / ts.p), `2,5 üst: ${pct(ts.o25 / ts.p)}`) : ''}
      ${stat('Form', formBadges(total?.form || formFromMatches(comp, id)), 'Son 5 maç', true)}
    </div>
    ${total ? `<h2>Puan durumu</h2><div class="table-wrap"><table><thead><tr><th></th><th class="num">O</th><th class="num">G</th><th class="num">B</th><th class="num">M</th><th class="num">A</th><th class="num">Y</th><th class="num">Puan</th></tr></thead>
      <tbody>${splitRow('Genel', total)}${splitRow('İç saha', home)}${splitRow('Deplasman', away)}</tbody></table></div>` : ''}
    <div class="grid two" style="margin-top:8px">
      <div><h2>Son maçlar</h2><div class="match-list">${past.map((m) => matchRow(comp, m)).join('') || '<div class="empty">Yok</div>'}</div></div>
      <div><h2>Sıradaki maçlar</h2><div class="match-list">${next.map((m) => matchRow(comp, m)).join('') || '<div class="empty">Yok</div>'}</div></div>
    </div>
    <h2>Kadro</h2>
    <div id="squad"></div>`;
  const sq = app.querySelector('#squad');
  if (!squad.length) {
    mountTable(sq, { rows: [...scorerMap.values()], sort: 'g', cols: scorerCols(comp, { team: false }) });
  } else {
    mountTable(sq, {
      rows: squad, sort: 'pos', desc: false,
      cols: [
        { key: 'name', label: 'Oyuncu', asc: true, html: (r) => playerLink(r.id, r.name) },
        { key: 'pos', label: 'Mevki', asc: true, val: (r) => { const i = order.indexOf(r.pos); return i < 0 ? 9 : i; }, html: (r) => esc(posName(r.pos)) },
        { key: 'age', label: 'Yaş', num: true, val: (r) => age(r.dob) },
        { key: 'nat', label: 'Uyruk', asc: true },
        { key: 'g', label: 'Gol', num: true },
        { key: 'a', label: 'Asist', num: true },
      ],
    });
  }
}

async function pagePlayer(pid) {
  app.innerHTML = '<p class="muted">Oyuncu aranıyor…</p>';
  const id = Number(pid);
  const comps = await loadAllComps();
  const entries = [];
  let bio = null, squadOf = null;
  for (const c of comps) {
    const s = c.scorers.find((x) => x.id === id);
    if (s) { entries.push({ c, s }); bio = bio || s; }
    for (const t of Object.values(c.teams)) {
      const p = (t.squad || []).find((x) => x.id === id);
      if (p) { squadOf = squadOf || { c, t }; bio = bio || p; }
    }
  }
  if (!bio) { app.innerHTML = '<div class="card empty">Oyuncu bulunamadı.</div>'; return; }
  const team = entries[0] ? entries[0].c.teams[entries[0].s.team] : squadOf?.t;
  const teamComp = entries[0]?.c || squadOf?.c;
  const goals = [];
  for (const c of comps) for (const m of c.matches) for (const g of m.goals || []) if (g.p?.id === id || g.as?.id === id) goals.push({ c, m, g, assist: g.as?.id === id });
  const cards = { y: 0, r: 0, known: comps.some((c) => c.hasCards) };
  for (const c of comps) for (const m of c.matches) for (const k of m.cards || []) if (k.p?.id === id) k.c === 'YELLOW' ? cards.y++ : cards.r++;
  const tot = entries.reduce((a, { s }) => ({ g: a.g + s.g, a: a.a + (s.a || 0), mp: a.mp + (s.mp || 0), pen: a.pen + (s.pen || 0) }), { g: 0, a: 0, mp: 0, pen: 0 });

  app.innerHTML = `
    <div class="crumbs"><a href="#/">Ligler</a>${team ? ` › <a href="#/takim/${teamComp.id}/${team.id}">${esc(team.name)}</a>` : ''}</div>
    <div class="page-head">
      ${team ? crest(team, 'crest lg') : ''}
      <div><h1>${esc(bio.name)}</h1>
      <div class="meta">${[posName(bio.pos), bio.nat, bio.dob && `${age(bio.dob)} yaş (${fmtDate(bio.dob, { day: 'numeric', month: 'long', year: 'numeric' })})`, bio.num && `#${bio.num}`].filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('<span>·</span>')}</div></div>
    </div>
    <div class="grid stats">
      ${stat('Gol', tot.g, `${tot.pen} penaltı`)}
      ${stat('Asist', tot.a)}
      ${stat('Gol + asist', tot.g + tot.a)}
      ${stat('Maç', tot.mp || '—', tot.mp ? `Maç başı ${fmt1(tot.g / tot.mp)} gol` : '')}
      ${cards.known ? stat('Kartlar', `${cards.y} sarı · ${cards.r} kırmızı`, '', true) : stat('Kartlar', '—', 'Kart verisi yok', true)}
    </div>
    <h2>Turnuvalara göre</h2>
    <div id="by"></div>
    ${goals.length ? `<h2>Goller ve asistler</h2><div class="match-list">${goals.map(({ c, m, g, assist }) => `<div class="match" style="grid-template-columns:90px 1fr auto"><span class="when">${fmtDate(m.d, { day: '2-digit', month: 'short', year: 'numeric' })}</span><span>${scoreLine(c, m)} <span class="muted small">${esc(c.name)}</span></span><span>${assist ? '🅰️' : '⚽'} ${minuteStr(g)}</span></div>`).join('')}</div>` : ''}
    ${missingNote(entries[0]?.c || teamComp)}`;
  mountTable(app.querySelector('#by'), {
    rows: entries.map(({ c, s }) => ({ ...s, comp: c })),
    sort: 'g', empty: 'Bu sezon gol veya asist kaydı yok.',
    cols: [
      { key: 'comp', label: 'Turnuva', val: (r) => r.comp.name, html: (r) => `<a href="#/lig/${r.comp.id}/oyuncular">${esc(r.comp.name)}</a>` },
      { key: 'team', label: 'Takım', val: (r) => r.comp.teams[r.team]?.short, html: (r) => teamCell(r.comp, r.team, { short: true }) },
      { key: 'mp', label: 'Maç', num: true },
      { key: 'g', label: 'Gol', num: true },
      { key: 'a', label: 'Asist', num: true },
      { key: 'pen', label: 'Penaltı', num: true },
      { key: 'rank', label: 'Gol sırası', num: true, val: (r) => 1 + r.comp.scorers.filter((x) => x.g > r.g).length, html: (r) => `${1 + r.comp.scorers.filter((x) => x.g > r.g).length}.` },
    ],
  });
}

const METRICS = {
  g: ['Gol', (r) => r.g],
  a: ['Asist', (r) => r.a || 0],
  ga: ['Gol + asist', (r) => r.g + (r.a || 0)],
  pen: ['Penaltı golü', (r) => r.pen || 0],
  gpm: ['Maç başı gol', (r) => (r.mp >= 5 ? r.g / r.mp : null)],
};

async function pageCompare() {
  app.innerHTML = '<p class="muted">Ligler yükleniyor…</p>';
  const comps = await loadAllComps();
  if (!comps.length) { app.innerHTML = '<h1>Ligler arası karşılaştırma</h1><div class="card empty">Henüz veri yok.</div>'; return; }
  const on = new Set(comps.filter((c) => c.type === 'LEAGUE').map((c) => c.id));
  let metric = 'g';
  const leagueRows = comps.map((c) => ({ c, ...summarize(c.matches, c) })).filter((r) => r.played);

  app.innerHTML = `
    <h1>Ligler arası karşılaştırma</h1>
    <p class="muted">Veri olan bütün ligler yan yana. Başlıklara tıklayarak sıralayabilirsin.</p>
    <h2>Lig karakterleri</h2>
    <div id="lg"></div>
    <h2>Avrupa genelinde oyuncular</h2>
    <div class="toolbar"><div class="seg" id="metric">${Object.entries(METRICS).map(([k, [l]]) => `<button data-m="${k}" class="${k === metric ? 'active' : ''}">${l}</button>`).join('')}</div></div>
    <div class="chips" id="chips" style="margin-bottom:12px">${comps.map((c) => `<button class="chip ${on.has(c.id) ? 'on' : ''}" data-id="${c.id}">${esc(c.name)}</button>`).join('')}</div>
    <div id="pchart"></div>
    <h3 style="margin-top:16px">İlk 100</h3>
    <div id="ptbl"></div>
    ${missingNote(comps[0], '"Maç başı gol" için en az 5 maç şartı var.')}`;

  mountTable(app.querySelector('#lg'), {
    rows: leagueRows, sort: 'avg',
    cols: [
      { key: 'name', label: 'Lig', asc: true, val: (r) => r.c.name, html: (r) => `<span class="team-cell">${r.c.emblem ? `<img class="crest" src="${esc(r.c.emblem)}" alt="">` : ''}<a href="#/lig/${r.c.id}">${esc(r.c.name)}</a></span><div class="muted small">${esc(r.c.country)}</div>` },
      { key: 'played', label: 'Maç', num: true },
      { key: 'goals', label: 'Gol', num: true },
      { key: 'avg', label: 'Gol/Maç', num: true, bar: true, html: (r) => fmt1(r.avg) },
      { key: 'hw', label: 'Ev kazanır', num: true, val: (r) => r.home / r.played, html: (r) => pct(r.home / r.played) },
      { key: 'dr', label: 'Beraberlik', num: true, val: (r) => r.draw / r.played, html: (r) => pct(r.draw / r.played) },
      { key: 'aw', label: 'Dep. kazanır', num: true, val: (r) => r.away / r.played, html: (r) => pct(r.away / r.played) },
      { key: 'o25', label: '2,5 Üst', num: true, val: (r) => r.o25 / r.played, html: (r) => pct(r.o25 / r.played) },
      { key: 'btts', label: 'KG Var', num: true, val: (r) => r.btts / r.played, html: (r) => pct(r.btts / r.played) },
      { key: 'top', label: 'En gollü maç', sort: false, html: (r) => (r.top ? scoreLine(r.c, r.top) : '—') },
    ],
  });

  const players = comps.flatMap((c) => c.scorers.map((s) => ({ ...s, comp: c })));
  const tbl = mountTable(app.querySelector('#ptbl'), {
    rows: [], sort: 'v', rank: true, limit: 100,
    cols: [
      { key: 'name', label: 'Oyuncu', asc: true, html: (r) => `${playerLink(r.id, r.name)}<div class="muted small">${esc(posName(r.pos))}</div>` },
      { key: 'team', label: 'Takım', val: (r) => r.comp.teams[r.team]?.short, asc: true, html: (r) => teamCell(r.comp, r.team, { short: true }) },
      { key: 'lg', label: 'Lig', val: (r) => r.comp.name, asc: true, html: (r) => `<a href="#/lig/${r.comp.id}/oyuncular">${esc(r.comp.name)}</a>` },
      { key: 'mp', label: 'Maç', num: true },
      { key: 'v', label: METRICS[metric][0], num: true, bar: true, val: (r) => METRICS[metric][1](r), html: (r) => (metric === 'gpm' ? fmt1(METRICS.gpm[1](r)) : METRICS[metric][1](r)) },
    ],
  });
  const render = () => {
    const [label, f] = METRICS[metric];
    const rows = players.filter((p) => on.has(p.comp.id) && f(p) != null);
    tbl.update(rows);
    app.querySelector('#ptbl th[data-k="v"]').textContent = label;
    const top = rows.slice().sort((a, b) => f(b) - f(a)).slice(0, 15);
    const fmt = metric === 'gpm' ? fmt1 : (v) => v;
    app.querySelector('#pchart').innerHTML = hbarChart(top.map((r) => ({
      label: r.name, v: f(r),
      html: `${playerLink(r.id, r.name)} <span class="muted small">${esc(r.comp.teams[r.team]?.tla || '')}</span>`,
      tip: `<b>${esc(r.name)}</b><br>${esc(r.comp.teams[r.team]?.name || '')} · ${esc(r.comp.name)}<br>${label}: ${fmt(f(r))}`,
    })), { title: `${label}: ilk 15`, sub: `${on.size} turnuva seçili`, fmt });
  };
  app.querySelector('#metric').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    metric = b.dataset.m;
    app.querySelectorAll('#metric button').forEach((x) => x.classList.toggle('active', x === b));
    render();
  };
  app.querySelector('#chips').onclick = (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const id = Number(b.dataset.id);
    on.has(id) ? on.delete(id) : on.add(id);
    b.classList.toggle('on', on.has(id));
    render();
  };
  render();
}

/* ---------------- Arama ---------------- */

const searchInput = document.getElementById('search');
const searchBox = document.getElementById('search-results');
let searchIndex = null;
async function buildSearch() {
  if (searchIndex) return searchIndex;
  const comps = await loadAllComps();
  const teams = new Map(), players = new Map();
  for (const c of comps) {
    for (const t of Object.values(c.teams)) {
      if (!teams.has(t.id) || c.type === 'LEAGUE') teams.set(t.id, { t, c });
      for (const p of t.squad || []) if (!players.has(p.id)) players.set(p.id, { p, t });
    }
    for (const s of c.scorers) if (!players.has(s.id)) players.set(s.id, { p: s, t: c.teams[s.team] });
  }
  searchIndex = {
    teams: [...teams.values()].map((x) => ({ ...x, k: fold(`${x.t.name} ${x.t.short} ${x.t.tla}`) })),
    players: [...players.values()].map((x) => ({ ...x, k: fold(x.p.name) })),
  };
  return searchIndex;
}
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = fold(searchInput.value.trim());
    if (q.length < 2) { searchBox.hidden = true; return; }
    const idx = await buildSearch().catch(() => ({ teams: [], players: [] }));
    const ts = idx.teams.filter((x) => x.k.includes(q)).slice(0, 6);
    const ps = idx.players.filter((x) => x.k.includes(q)).slice(0, 8);
    searchBox.innerHTML = (!ts.length && !ps.length) ? '<div class="empty">Sonuç yok</div>'
      : `${ts.length ? `<div class="group">Takımlar</div>${ts.map((x) => `<a href="#/takim/${x.c.id}/${x.t.id}">${crest(x.t)}<span>${esc(x.t.name)}<br><span class="muted small">${esc(x.c.name)}</span></span></a>`).join('')}` : ''}
         ${ps.length ? `<div class="group">Oyuncular</div>${ps.map((x) => `<a href="#/oyuncu/${x.p.id}">${crest(x.t)}<span>${esc(x.p.name)}<br><span class="muted small">${esc(x.t?.name || '')}</span></span></a>`).join('')}` : ''}`;
    searchBox.hidden = false;
  }, 150);
});
searchBox.addEventListener('click', (e) => { if (e.target.closest('a')) { searchBox.hidden = true; searchInput.value = ''; } });
document.addEventListener('click', (e) => { if (!e.target.closest('.search')) searchBox.hidden = true; });
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') searchBox.querySelector('a')?.click();
  if (e.key === 'Escape') { searchBox.hidden = true; searchInput.blur(); }
});

/* ---------------- Tema ---------------- */

document.getElementById('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) { /* yok say */ }
});

/* ---------------- Yönlendirme ---------------- */

async function route() {
  hideTooltip();
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active',
    (a.dataset.nav === 'compare' && parts[0] === 'karsilastir') || (a.dataset.nav === 'home' && (!parts[0] || parts[0] === 'lig'))));
  try {
    if (!parts.length) await pageHome();
    else if (parts[0] === 'lig') await pageLeague(Number(parts[1]), parts[2], parts.slice(3).join('/'));
    else if (parts[0] === 'takim') await pageTeam(Number(parts[1]), parts[2]);
    else if (parts[0] === 'oyuncu') await pagePlayer(parts[1]);
    else if (parts[0] === 'karsilastir') await pageCompare();
    else app.innerHTML = '<div class="card empty">Sayfa bulunamadı. <a href="#/">Ana sayfaya dön</a></div>';
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="notice"><strong>Veri yüklenemedi</strong>${esc(e.message)}. Veri dosyaları henüz oluşturulmamış olabilir.</div>`;
  }
  const title = app.querySelector('h1')?.textContent;
  document.title = title ? `${title} · Maç Takip` : 'Maç Takip';
}

let lastPath = '';
window.addEventListener('hashchange', () => {
  const p = location.hash.split('/').slice(0, 3).join('/');
  route().then(() => { if (p !== lastPath) window.scrollTo(0, 0); lastPath = p; });
});
route();
loadIndex().then((i) => {
  document.getElementById('updated').textContent = `Son güncelleme: ${fmtDateTime(i.updatedAt)}`;
}).catch(() => {});
