// football-data.org v4 API'sinden verileri çekip site/data altına yazar.
// Kullanım: FOOTBALL_DATA_TOKEN=xxxx node scripts/fetch-data.mjs
//
// Ücretsiz plan dakikada 10 istekle sınırlıdır; istekler arasında bekleme yapılır.
// Planın kapsamadığı ligler "locked" olarak işaretlenir ve sitede kilitli görünür.
// Plan gol dakikası / kart verisi veriyorsa (X-Unfold-* başlıkları) bunlar da kaydedilir.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRIES, UEFA_CUPS } from './leagues.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'data');
const API = 'https://api.football-data.org/v4';
const TOKEN = process.env.FOOTBALL_DATA_TOKEN || '';
const DELAY_MS = Number(process.env.FD_DELAY_MS || 6500);
// Sezonu bu tarihten eski olan ligler kaynakta güncellenmiyor demektir.
const STALE_BEFORE = new Date(Date.now() - 1000 * 60 * 60 * 24 * 550);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

async function api(path, { retries = 3 } = {}) {
  const wait = lastCall + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const headers = {
    'X-Unfold-Goals': 'true',
    'X-Unfold-Bookings': 'true',
    'X-Unfold-Subs': 'false',
    'X-Unfold-Lineups': 'false',
  };
  if (TOKEN) headers['X-Auth-Token'] = TOKEN;
  let res;
  try {
    res = await fetch(API + path, { headers });
  } catch (err) {
    if (retries > 0) {
      await sleep(5000);
      return api(path, { retries: retries - 1 });
    }
    throw err;
  }
  if (res.status === 429 && retries > 0) {
    const reset = Number(res.headers.get('X-RequestCounter-Reset')) || 60;
    console.log(`  hız sınırı, ${reset} sn bekleniyor`);
    await sleep((reset + 1) * 1000);
    return api(path, { retries: retries - 1 });
  }
  if (res.status >= 500 && retries > 0) {
    await sleep(10000);
    return api(path, { retries: retries - 1 });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${res.status} ${path}: ${body.message || res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const slimTeam = (t) =>
  t && { id: t.id, name: t.name, short: t.shortName || t.name, tla: t.tla, crest: t.crest };

function slimMatch(m) {
  const out = {
    id: m.id,
    d: m.utcDate,
    s: m.status,
    md: m.matchday ?? null,
    st: m.stage,
    g: m.group ?? null,
    h: m.homeTeam?.id ?? null,
    a: m.awayTeam?.id ?? null,
    hs: m.score?.fullTime?.home ?? null,
    as: m.score?.fullTime?.away ?? null,
    hh: m.score?.halfTime?.home ?? null,
    ah: m.score?.halfTime?.away ?? null,
  };
  if (m.score?.duration && m.score.duration !== 'REGULAR') out.dur = m.score.duration;
  if (Array.isArray(m.goals) && m.goals.length) {
    out.goals = m.goals.map((g) => ({
      m: g.minute,
      x: g.injuryTime ?? null,
      t: g.team?.id,
      p: g.scorer ? { id: g.scorer.id, name: g.scorer.name } : null,
      as: g.assist ? { id: g.assist.id, name: g.assist.name } : null,
      k: g.type,
    }));
  }
  if (Array.isArray(m.bookings) && m.bookings.length) {
    out.cards = m.bookings.map((b) => ({
      m: b.minute,
      t: b.team?.id,
      p: b.player ? { id: b.player.id, name: b.player.name } : null,
      c: b.card,
    }));
  }
  return out;
}

function slimScorer(s) {
  const p = s.player || {};
  return {
    id: p.id,
    name: p.name,
    nat: p.nationality,
    dob: p.dateOfBirth,
    pos: p.section || p.position || null,
    num: p.shirtNumber ?? null,
    team: s.team?.id,
    mp: s.playedMatches ?? null,
    g: s.goals ?? 0,
    a: s.assists ?? 0,
    pen: s.penalties ?? 0,
  };
}

function slimTeamFull(t) {
  return {
    ...slimTeam(t),
    founded: t.founded ?? null,
    venue: t.venue ?? null,
    colors: t.clubColors ?? null,
    website: t.website ?? null,
    coach: t.coach?.name ? { name: t.coach.name, nat: t.coach.nationality } : null,
    squad: (t.squad || []).map((p) => ({
      id: p.id,
      name: p.name,
      pos: p.position,
      dob: p.dateOfBirth,
      nat: p.nationality,
    })),
  };
}

async function fetchCompetition(meta) {
  const id = meta.id;
  const standings = await api(`/competitions/${id}/standings`);
  const matches = await api(`/competitions/${id}/matches`);
  let scorers = { scorers: [] };
  try {
    scorers = await api(`/competitions/${id}/scorers?limit=200`);
  } catch (e) {
    console.log(`  gol krallığı alınamadı: ${e.message}`);
  }
  let teams = { teams: [] };
  try {
    teams = await api(`/competitions/${id}/teams`);
  } catch (e) {
    console.log(`  takımlar alınamadı: ${e.message}`);
  }

  const teamMap = {};
  for (const t of teams.teams || []) teamMap[t.id] = slimTeamFull(t);
  const addTeam = (t) => {
    if (t?.id && !teamMap[t.id]) teamMap[t.id] = { ...slimTeam(t), squad: [] };
  };
  for (const m of matches.matches || []) {
    addTeam(m.homeTeam);
    addTeam(m.awayTeam);
  }

  const season = standings.season || matches.matches?.[0]?.season || {};
  return {
    id,
    code: meta.code,
    name: meta.name,
    type: meta.type,
    area: meta.area,
    emblem: meta.emblem,
    season: {
      start: season.startDate,
      end: season.endDate,
      matchday: season.currentMatchday ?? null,
    },
    hasGoalDetail: (matches.matches || []).some((m) => Array.isArray(m.goals) && m.goals.length),
    hasCards: (matches.matches || []).some((m) => Array.isArray(m.bookings) && m.bookings.length),
    standings: (standings.standings || []).map((s) => ({
      stage: s.stage,
      type: s.type,
      group: s.group,
      table: s.table.map((r) => ({
        pos: r.position,
        team: r.team.id,
        p: r.playedGames,
        w: r.won,
        d: r.draw,
        l: r.lost,
        gf: r.goalsFor,
        ga: r.goalsAgainst,
        gd: r.goalDifference,
        pts: r.points,
        form: r.form || null,
      })),
    })),
    matches: (matches.matches || []).map(slimMatch),
    scorers: (scorers.scorers || []).map(slimScorer),
    teams: teamMap,
    fetchedAt: new Date().toISOString(),
  };
}

async function readPrevious(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(join(OUT, 'comp'), { recursive: true });
  const index = {
    updatedAt: new Date().toISOString(),
    source: 'football-data.org',
    configured: Boolean(TOKEN),
    cups: [],
    countries: [],
  };

  if (!TOKEN) {
    console.warn('FOOTBALL_DATA_TOKEN tanımlı değil; yalnızca lig listesi yazılacak.');
  }

  const all = await api('/competitions');
  const byId = new Map(all.competitions.map((c) => [c.id, c]));

  const metaOf = (id, overrideName) => {
    const c = byId.get(id);
    if (!c) return null;
    return {
      id,
      code: c.code,
      name: overrideName || c.name,
      type: c.type,
      area: { name: c.area?.name, flag: c.area?.flag },
      emblem: c.emblem,
      seasonStart: c.currentSeason?.startDate || null,
    };
  };

  const jobs = [];
  for (const cup of UEFA_CUPS) {
    const m = metaOf(cup.id, cup.name);
    if (m) {
      index.cups.push(m);
      jobs.push(m);
    }
  }
  for (const country of COUNTRIES) {
    const entry = { name: country.name, area: country.area, flag: null, leagues: [] };
    for (const id of country.leagues) {
      const m = metaOf(id);
      if (!m) continue;
      entry.flag = entry.flag || m.area.flag;
      entry.leagues.push(m);
      jobs.push(m);
    }
    index.countries.push(entry);
  }

  for (const meta of jobs) {
    const file = join(OUT, 'comp', `${meta.id}.json`);
    if (!meta.seasonStart || new Date(meta.seasonStart) < STALE_BEFORE) {
      meta.status = 'stale';
      continue;
    }
    if (!TOKEN) {
      meta.status = 'nokey';
      continue;
    }
    console.log(`→ ${meta.name} (${meta.area.name})`);
    try {
      const data = await fetchCompetition(meta);
      await writeFile(file, JSON.stringify(data));
      meta.status = 'ok';
      meta.matchday = data.season.matchday;
      meta.teamCount = Object.keys(data.teams).length;
      console.log(`  ✓ ${data.matches.length} maç, ${data.scorers.length} oyuncu`);
    } catch (e) {
      if (e.status === 403) {
        meta.status = 'locked';
        console.log('  planda yok (kilitli)');
      } else {
        // Önceki başarılı veriyi koru.
        const prev = existsSync(file) ? await readPrevious(file) : null;
        meta.status = prev ? 'ok' : 'error';
        if (prev) meta.matchday = prev.season?.matchday ?? null;
        console.log(`  ✗ ${e.message}${prev ? ' (önceki veri korundu)' : ''}`);
      }
    }
  }

  await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 1));
  const ok = jobs.filter((j) => j.status === 'ok').length;
  console.log(`Bitti: ${ok}/${jobs.length} lig güncellendi.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
