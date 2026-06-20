// ─── 시뮬레이션 상태 ──────────────────────────────────────────────
// matchesData의 사본. 원본은 절대 수정하지 않음.
let simMatches = [];
let simKnockoutMatches = [];  // 토너먼트 경기 점수 저장용

// ─── 초기화 ───────────────────────────────────────────────────────
function initSim() {
  if (simMatches.length > 0) return;
  simMatches = matchesData
    .filter(m => m.type === 'group')
    .map(m => ({ ...m, sim_home_score: 0, sim_away_score: 0 }));
}

function initSimKnockout() {
  if (simKnockoutMatches.length > 0) return;
  simKnockoutMatches = matchesData
    .filter(m => m.type !== 'group')
    .map(m => ({ ...m, sim_home_score: 0, sim_away_score: 0 }));
}

// ─── 점수 변경 (▲▼ 버튼 핸들러) ──────────────────────────────────
function changeSimScore(matchId, side, delta) {
  const m = simMatches.find(m => m.id === matchId);
  if (!m) return;

  if (side === 'home') m.sim_home_score = Math.max(0, m.sim_home_score + delta);
  else                 m.sim_away_score = Math.max(0, m.sim_away_score + delta);

  // 해당 점수 표시만 업데이트 (전체 재렌더링 X)
  const el = document.querySelector(`[data-score-id="${matchId}-${side}"]`);
  if (el) el.textContent = side === 'home' ? m.sim_home_score : m.sim_away_score;

  // 해당 조 순위표만 업데이트
  const standingsEl = document.querySelector(`#sim-group-${m.group} .sim-standings`);
  if (standingsEl) standingsEl.innerHTML = simStandingsHtml(m.group);

  refreshSimTournamentIfVisible();
}

// ─── 순위 계산 ────────────────────────────────────────────────────
function calcH2HSimPts(tiedTeams, allMatches) {
  const ids = tiedTeams.map(t => t.team_id);
  const h2h = {};
  ids.forEach(id => h2h[id] = 0);
  allMatches
    .filter(m => ids.includes(m.home_team_id) && ids.includes(m.away_team_id))
    .forEach(m => {
      const hs = m.sim_home_score, as = m.sim_away_score;
      if      (hs > as) h2h[m.home_team_id] += 3;
      else if (hs < as) h2h[m.away_team_id] += 3;
      else              { h2h[m.home_team_id]++; h2h[m.away_team_id]++; }
    });
  return h2h;
}

function sortSimTeams(teams, allMatches) {
  const sorted = [...teams].sort((a, b) => b.pts - a.pts);
  const result = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].pts === sorted[i].pts) j++;
    const tied = sorted.slice(i, j);
    if (tied.length > 1) {
      const h2h = calcH2HSimPts(tied, allMatches);
      tied.sort((a, b) => h2h[b.team_id] - h2h[a.team_id] || b.gd - a.gd || b.gf - a.gf);
    }
    result.push(...tied);
    i = j;
  }
  return result;
}

function calcSimGroupStandings(groupName) {
  const matches = simMatches.filter(m => m.group === groupName);
  const ids = [...new Set(matches.flatMap(m => [m.home_team_id, m.away_team_id]))];

  const s = {};
  ids.forEach(id => { s[id] = { team_id: id, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 }; });

  matches.forEach(m => {
    const hs = m.sim_home_score, as = m.sim_away_score;
    s[m.home_team_id].mp++; s[m.away_team_id].mp++;
    s[m.home_team_id].gf += hs; s[m.home_team_id].ga += as; s[m.home_team_id].gd += hs - as;
    s[m.away_team_id].gf += as; s[m.away_team_id].ga += hs; s[m.away_team_id].gd += as - hs;
    if      (hs > as) { s[m.home_team_id].w++; s[m.home_team_id].pts += 3; s[m.away_team_id].l++; }
    else if (hs < as) { s[m.away_team_id].w++; s[m.away_team_id].pts += 3; s[m.home_team_id].l++; }
    else              { s[m.home_team_id].d++; s[m.home_team_id].pts++; s[m.away_team_id].d++; s[m.away_team_id].pts++; }
  });

  return sortSimTeams(Object.values(s), matches);
}

const FIFA_THIRD_PLACE_TABLE = {
  'EFGHIJKL': ['E','J','I','F','H','G','L','K'],
  'DFGHIJKL': ['H','G','I','D','J','F','L','K'],
  'DEGHIJKL': ['E','J','I','D','H','G','L','K'],
  'DEFHIJKL': ['E','J','I','D','H','F','L','K'],
  'DEFGIJKL': ['E','G','I','D','J','F','L','K'],
  'DEFGHJKL': ['E','G','J','D','H','F','L','K'],
  'DEFGHIKL': ['E','G','I','D','H','F','L','K'],
  'DEFGHIJL': ['E','G','J','D','H','F','L','I'],
  'DEFGHIJK': ['E','G','J','D','H','F','I','K'],
  'CFGHIJKL': ['H','G','I','C','J','F','L','K'],
  'CEGHIJKL': ['E','J','I','C','H','G','L','K'],
  'CEFHIJKL': ['E','J','I','C','H','F','L','K'],
  'CEFGIJKL': ['E','G','I','C','J','F','L','K'],
  'CEFGHJKL': ['E','G','J','C','H','F','L','K'],
  'CEFGHIKL': ['E','G','I','C','H','F','L','K'],
  'CEFGHIJL': ['E','G','J','C','H','F','L','I'],
  'CEFGHIJK': ['E','G','J','C','H','F','I','K'],
  'CDGHIJKL': ['H','G','I','C','J','D','L','K'],
  'CDFHIJKL': ['C','J','I','D','H','F','L','K'],
  'CDFGIJKL': ['C','G','I','D','J','F','L','K'],
  'CDFGHJKL': ['C','G','J','D','H','F','L','K'],
  'CDFGHIKL': ['C','G','I','D','H','F','L','K'],
  'CDFGHIJL': ['C','G','J','D','H','F','L','I'],
  'CDFGHIJK': ['C','G','J','D','H','F','I','K'],
  'CDEHIJKL': ['E','J','I','C','H','D','L','K'],
  'CDEGIJKL': ['E','G','I','C','J','D','L','K'],
  'CDEGHJKL': ['E','G','J','C','H','D','L','K'],
  'CDEGHIKL': ['E','G','I','C','H','D','L','K'],
  'CDEGHIJL': ['E','G','J','C','H','D','L','I'],
  'CDEGHIJK': ['E','G','J','C','H','D','I','K'],
  'CDEFIJKL': ['C','J','E','D','I','F','L','K'],
  'CDEFHJKL': ['C','J','E','D','H','F','L','K'],
  'CDEFHIKL': ['C','E','I','D','H','F','L','K'],
  'CDEFHIJL': ['C','J','E','D','H','F','L','I'],
  'CDEFHIJK': ['C','J','E','D','H','F','I','K'],
  'CDEFGJKL': ['C','G','E','D','J','F','L','K'],
  'CDEFGIKL': ['C','G','E','D','I','F','L','K'],
  'CDEFGIJL': ['C','G','E','D','J','F','L','I'],
  'CDEFGIJK': ['C','G','E','D','J','F','I','K'],
  'CDEFGHKL': ['C','G','E','D','H','F','L','K'],
  'CDEFGHJL': ['C','G','J','D','H','F','L','E'],
  'CDEFGHJK': ['C','G','J','D','H','F','E','K'],
  'CDEFGHIL': ['C','G','E','D','H','F','L','I'],
  'CDEFGHIK': ['C','G','E','D','H','F','I','K'],
  'CDEFGHIJ': ['C','G','J','D','H','F','E','I'],
  'BFGHIJKL': ['H','J','B','F','I','G','L','K'],
  'BEGHIJKL': ['E','J','I','B','H','G','L','K'],
  'BEFHIJKL': ['E','J','B','F','I','H','L','K'],
  'BEFGIJKL': ['E','J','B','F','I','G','L','K'],
  'BEFGHJKL': ['E','J','B','F','H','G','L','K'],
  'BEFGHIKL': ['E','G','B','F','I','H','L','K'],
  'BEFGHIJL': ['E','J','B','F','H','G','L','I'],
  'BEFGHIJK': ['E','J','B','F','H','G','I','K'],
  'BDGHIJKL': ['H','J','B','D','I','G','L','K'],
  'BDFHIJKL': ['H','J','B','D','I','F','L','K'],
  'BDFGIJKL': ['I','G','B','D','J','F','L','K'],
  'BDFGHJKL': ['H','G','B','D','J','F','L','K'],
  'BDFGHIKL': ['H','G','B','D','I','F','L','K'],
  'BDFGHIJL': ['H','G','B','D','J','F','L','I'],
  'BDFGHIJK': ['H','G','B','D','J','F','I','K'],
  'BDEHIJKL': ['E','J','B','D','I','H','L','K'],
  'BDEGIJKL': ['E','J','B','D','I','G','L','K'],
  'BDEGHJKL': ['E','J','B','D','H','G','L','K'],
  'BDEGHIKL': ['E','G','B','D','I','H','L','K'],
  'BDEGHIJL': ['E','J','B','D','H','G','L','I'],
  'BDEGHIJK': ['E','J','B','D','H','G','I','K'],
  'BDEFIJKL': ['E','J','B','D','I','F','L','K'],
  'BDEFHJKL': ['E','J','B','D','H','F','L','K'],
  'BDEFHIKL': ['E','I','B','D','H','F','L','K'],
  'BDEFHIJL': ['E','J','B','D','H','F','L','I'],
  'BDEFHIJK': ['E','J','B','D','H','F','I','K'],
  'BDEFGJKL': ['E','G','B','D','J','F','L','K'],
  'BDEFGIKL': ['E','G','B','D','I','F','L','K'],
  'BDEFGIJL': ['E','G','B','D','J','F','L','I'],
  'BDEFGIJK': ['E','G','B','D','J','F','I','K'],
  'BDEFGHKL': ['E','G','B','D','H','F','L','K'],
  'BDEFGHJL': ['H','G','B','D','J','F','L','E'],
  'BDEFGHJK': ['H','G','B','D','J','F','E','K'],
  'BDEFGHIL': ['E','G','B','D','H','F','L','I'],
  'BDEFGHIK': ['E','G','B','D','H','F','I','K'],
  'BDEFGHIJ': ['H','G','B','D','J','F','E','I'],
  'BCGHIJKL': ['H','J','B','C','I','G','L','K'],
  'BCFHIJKL': ['H','J','B','C','I','F','L','K'],
  'BCFGIJKL': ['I','G','B','C','J','F','L','K'],
  'BCFGHJKL': ['H','G','B','C','J','F','L','K'],
  'BCFGHIKL': ['H','G','B','C','I','F','L','K'],
  'BCFGHIJL': ['H','G','B','C','J','F','L','I'],
  'BCFGHIJK': ['H','G','B','C','J','F','I','K'],
  'BCEHIJKL': ['E','J','B','C','I','H','L','K'],
  'BCEGIJKL': ['E','J','B','C','I','G','L','K'],
  'BCEGHJKL': ['E','J','B','C','H','G','L','K'],
  'BCEGHIKL': ['E','G','B','C','I','H','L','K'],
  'BCEGHIJL': ['E','J','B','C','H','G','L','I'],
  'BCEGHIJK': ['E','J','B','C','H','G','I','K'],
  'BCEFIJKL': ['E','J','B','C','I','F','L','K'],
  'BCEFHJKL': ['E','J','B','C','H','F','L','K'],
  'BCEFHIKL': ['E','I','B','C','H','F','L','K'],
  'BCEFHIJL': ['E','J','B','C','H','F','L','I'],
  'BCEFHIJK': ['E','J','B','C','H','F','I','K'],
  'BCEFGJKL': ['E','G','B','C','J','F','L','K'],
  'BCEFGIKL': ['E','G','B','C','I','F','L','K'],
  'BCEFGIJL': ['E','G','B','C','J','F','L','I'],
  'BCEFGIJK': ['E','G','B','C','J','F','I','K'],
  'BCEFGHKL': ['E','G','B','C','H','F','L','K'],
  'BCEFGHJL': ['H','G','B','C','J','F','L','E'],
  'BCEFGHJK': ['H','G','B','C','J','F','E','K'],
  'BCEFGHIL': ['E','G','B','C','H','F','L','I'],
  'BCEFGHIK': ['E','G','B','C','H','F','I','K'],
  'BCEFGHIJ': ['H','G','B','C','J','F','E','I'],
  'BCDHIJKL': ['H','J','B','C','I','D','L','K'],
  'BCDGIJKL': ['I','G','B','C','J','D','L','K'],
  'BCDGHJKL': ['H','G','B','C','J','D','L','K'],
  'BCDGHIKL': ['H','G','B','C','I','D','L','K'],
  'BCDGHIJL': ['H','G','B','C','J','D','L','I'],
  'BCDGHIJK': ['H','G','B','C','J','D','I','K'],
  'BCDFIJKL': ['C','J','B','D','I','F','L','K'],
  'BCDFHJKL': ['C','J','B','D','H','F','L','K'],
  'BCDFHIKL': ['C','I','B','D','H','F','L','K'],
  'BCDFHIJL': ['C','J','B','D','H','F','L','I'],
  'BCDFHIJK': ['C','J','B','D','H','F','I','K'],
  'BCDFGJKL': ['C','G','B','D','J','F','L','K'],
  'BCDFGIKL': ['C','G','B','D','I','F','L','K'],
  'BCDFGIJL': ['C','G','B','D','J','F','L','I'],
  'BCDFGIJK': ['C','G','B','D','J','F','I','K'],
  'BCDFGHKL': ['C','G','B','D','H','F','L','K'],
  'BCDFGHJL': ['C','G','B','D','H','F','L','J'],
  'BCDFGHJK': ['H','G','B','C','J','F','D','K'],
  'BCDFGHIL': ['C','G','B','D','H','F','L','I'],
  'BCDFGHIK': ['C','G','B','D','H','F','I','K'],
  'BCDFGHIJ': ['H','G','B','C','J','F','D','I'],
  'BCDEIJKL': ['E','J','B','C','I','D','L','K'],
  'BCDEHJKL': ['E','J','B','C','H','D','L','K'],
  'BCDEHIKL': ['E','I','B','C','H','D','L','K'],
  'BCDEHIJL': ['E','J','B','C','H','D','L','I'],
  'BCDEHIJK': ['E','J','B','C','H','D','I','K'],
  'BCDEGJKL': ['E','G','B','C','J','D','L','K'],
  'BCDEGIKL': ['E','G','B','C','I','D','L','K'],
  'BCDEGIJL': ['E','G','B','C','J','D','L','I'],
  'BCDEGIJK': ['E','G','B','C','J','D','I','K'],
  'BCDEGHKL': ['E','G','B','C','H','D','L','K'],
  'BCDEGHJL': ['H','G','B','C','J','D','L','E'],
  'BCDEGHJK': ['H','G','B','C','J','D','E','K'],
  'BCDEGHIL': ['E','G','B','C','H','D','L','I'],
  'BCDEGHIK': ['E','G','B','C','H','D','I','K'],
  'BCDEGHIJ': ['H','G','B','C','J','D','E','I'],
  'BCDEFJKL': ['C','J','B','D','E','F','L','K'],
  'BCDEFIKL': ['C','E','B','D','I','F','L','K'],
  'BCDEFIJL': ['C','J','B','D','E','F','L','I'],
  'BCDEFIJK': ['C','J','B','D','E','F','I','K'],
  'BCDEFHKL': ['C','E','B','D','H','F','L','K'],
  'BCDEFHJL': ['C','J','B','D','H','F','L','E'],
  'BCDEFHJK': ['C','J','B','D','H','F','E','K'],
  'BCDEFHIL': ['C','E','B','D','H','F','L','I'],
  'BCDEFHIK': ['C','E','B','D','H','F','I','K'],
  'BCDEFHIJ': ['C','J','B','D','H','F','E','I'],
  'BCDEFGKL': ['C','G','B','D','E','F','L','K'],
  'BCDEFGJL': ['C','G','B','D','J','F','L','E'],
  'BCDEFGJK': ['C','G','B','D','J','F','E','K'],
  'BCDEFGIL': ['C','G','B','D','E','F','L','I'],
  'BCDEFGIK': ['C','G','B','D','E','F','I','K'],
  'BCDEFGIJ': ['C','G','B','D','J','F','E','I'],
  'BCDEFGHL': ['C','G','B','D','H','F','L','E'],
  'BCDEFGHK': ['C','G','B','D','H','F','E','K'],
  'BCDEFGHJ': ['H','G','B','C','J','F','D','E'],
  'BCDEFGHI': ['C','G','B','D','H','F','E','I'],
  'AFGHIJKL': ['H','J','I','F','A','G','L','K'],
  'AEGHIJKL': ['E','J','I','A','H','G','L','K'],
  'AEFHIJKL': ['E','J','I','F','A','H','L','K'],
  'AEFGIJKL': ['E','J','I','F','A','G','L','K'],
  'AEFGHJKL': ['E','G','J','F','A','H','L','K'],
  'AEFGHIKL': ['E','G','I','F','A','H','L','K'],
  'AEFGHIJL': ['E','G','J','F','A','H','L','I'],
  'AEFGHIJK': ['E','G','J','F','A','H','I','K'],
  'ADGHIJKL': ['H','J','I','D','A','G','L','K'],
  'ADFHIJKL': ['H','J','I','D','A','F','L','K'],
  'ADFGIJKL': ['I','G','J','D','A','F','L','K'],
  'ADFGHJKL': ['H','G','J','D','A','F','L','K'],
  'ADFGHIKL': ['H','G','I','D','A','F','L','K'],
  'ADFGHIJL': ['H','G','J','D','A','F','L','I'],
  'ADFGHIJK': ['H','G','J','D','A','F','I','K'],
  'ADEHIJKL': ['E','J','I','D','A','H','L','K'],
  'ADEGIJKL': ['E','J','I','D','A','G','L','K'],
  'ADEGHJKL': ['E','G','J','D','A','H','L','K'],
  'ADEGHIKL': ['E','G','I','D','A','H','L','K'],
  'ADEGHIJL': ['E','G','J','D','A','H','L','I'],
  'ADEGHIJK': ['E','G','J','D','A','H','I','K'],
  'ADEFIJKL': ['E','J','I','D','A','F','L','K'],
  'ADEFHJKL': ['H','J','E','D','A','F','L','K'],
  'ADEFHIKL': ['H','E','I','D','A','F','L','K'],
  'ADEFHIJL': ['H','J','E','D','A','F','L','I'],
  'ADEFHIJK': ['H','J','E','D','A','F','I','K'],
  'ADEFGJKL': ['E','G','J','D','A','F','L','K'],
  'ADEFGIKL': ['E','G','I','D','A','F','L','K'],
  'ADEFGIJL': ['E','G','J','D','A','F','L','I'],
  'ADEFGIJK': ['E','G','J','D','A','F','I','K'],
  'ADEFGHKL': ['H','G','E','D','A','F','L','K'],
  'ADEFGHJL': ['H','G','J','D','A','F','L','E'],
  'ADEFGHJK': ['H','G','J','D','A','F','E','K'],
  'ADEFGHIL': ['H','G','E','D','A','F','L','I'],
  'ADEFGHIK': ['H','G','E','D','A','F','I','K'],
  'ADEFGHIJ': ['H','G','J','D','A','F','E','I'],
  'ACGHIJKL': ['H','J','I','C','A','G','L','K'],
  'ACFHIJKL': ['H','J','I','C','A','F','L','K'],
  'ACFGIJKL': ['I','G','J','C','A','F','L','K'],
  'ACFGHJKL': ['H','G','J','C','A','F','L','K'],
  'ACFGHIKL': ['H','G','I','C','A','F','L','K'],
  'ACFGHIJL': ['H','G','J','C','A','F','L','I'],
  'ACFGHIJK': ['H','G','J','C','A','F','I','K'],
  'ACEHIJKL': ['E','J','I','C','A','H','L','K'],
  'ACEGIJKL': ['E','J','I','C','A','G','L','K'],
  'ACEGHJKL': ['E','G','J','C','A','H','L','K'],
  'ACEGHIKL': ['E','G','I','C','A','H','L','K'],
  'ACEGHIJL': ['E','G','J','C','A','H','L','I'],
  'ACEGHIJK': ['E','G','J','C','A','H','I','K'],
  'ACEFIJKL': ['E','J','I','C','A','F','L','K'],
  'ACEFHJKL': ['H','J','E','C','A','F','L','K'],
  'ACEFHIKL': ['H','E','I','C','A','F','L','K'],
  'ACEFHIJL': ['H','J','E','C','A','F','L','I'],
  'ACEFHIJK': ['H','J','E','C','A','F','I','K'],
  'ACEFGJKL': ['E','G','J','C','A','F','L','K'],
  'ACEFGIKL': ['E','G','I','C','A','F','L','K'],
  'ACEFGIJL': ['E','G','J','C','A','F','L','I'],
  'ACEFGIJK': ['E','G','J','C','A','F','I','K'],
  'ACEFGHKL': ['H','G','E','C','A','F','L','K'],
  'ACEFGHJL': ['H','G','J','C','A','F','L','E'],
  'ACEFGHJK': ['H','G','J','C','A','F','E','K'],
  'ACEFGHIL': ['H','G','E','C','A','F','L','I'],
  'ACEFGHIK': ['H','G','E','C','A','F','I','K'],
  'ACEFGHIJ': ['H','G','J','C','A','F','E','I'],
  'ACDHIJKL': ['H','J','I','C','A','D','L','K'],
  'ACDGIJKL': ['I','G','J','C','A','D','L','K'],
  'ACDGHJKL': ['H','G','J','C','A','D','L','K'],
  'ACDGHIKL': ['H','G','I','C','A','D','L','K'],
  'ACDGHIJL': ['H','G','J','C','A','D','L','I'],
  'ACDGHIJK': ['H','G','J','C','A','D','I','K'],
  'ACDFIJKL': ['C','J','I','D','A','F','L','K'],
  'ACDFHJKL': ['H','J','F','C','A','D','L','K'],
  'ACDFHIKL': ['H','F','I','C','A','D','L','K'],
  'ACDFHIJL': ['H','J','F','C','A','D','L','I'],
  'ACDFHIJK': ['H','J','F','C','A','D','I','K'],
  'ACDFGJKL': ['C','G','J','D','A','F','L','K'],
  'ACDFGIKL': ['C','G','I','D','A','F','L','K'],
  'ACDFGIJL': ['C','G','J','D','A','F','L','I'],
  'ACDFGIJK': ['C','G','J','D','A','F','I','K'],
  'ACDFGHKL': ['H','G','F','C','A','D','L','K'],
  'ACDFGHJL': ['C','G','J','D','A','F','L','H'],
  'ACDFGHJK': ['H','G','J','C','A','F','D','K'],
  'ACDFGHIL': ['H','G','F','C','A','D','L','I'],
  'ACDFGHIK': ['H','G','F','C','A','D','I','K'],
  'ACDFGHIJ': ['H','G','J','C','A','F','D','I'],
  'ACDEIJKL': ['E','J','I','C','A','D','L','K'],
  'ACDEHJKL': ['H','J','E','C','A','D','L','K'],
  'ACDEHIKL': ['H','E','I','C','A','D','L','K'],
  'ACDEHIJL': ['H','J','E','C','A','D','L','I'],
  'ACDEHIJK': ['H','J','E','C','A','D','I','K'],
  'ACDEGJKL': ['E','G','J','C','A','D','L','K'],
  'ACDEGIKL': ['E','G','I','C','A','D','L','K'],
  'ACDEGIJL': ['E','G','J','C','A','D','L','I'],
  'ACDEGIJK': ['E','G','J','C','A','D','I','K'],
  'ACDEGHKL': ['H','G','E','C','A','D','L','K'],
  'ACDEGHJL': ['H','G','J','C','A','D','L','E'],
  'ACDEGHJK': ['H','G','J','C','A','D','E','K'],
  'ACDEGHIL': ['H','G','E','C','A','D','L','I'],
  'ACDEGHIK': ['H','G','E','C','A','D','I','K'],
  'ACDEGHIJ': ['H','G','J','C','A','D','E','I'],
  'ACDEFJKL': ['C','J','E','D','A','F','L','K'],
  'ACDEFIKL': ['C','E','I','D','A','F','L','K'],
  'ACDEFIJL': ['C','J','E','D','A','F','L','I'],
  'ACDEFIJK': ['C','J','E','D','A','F','I','K'],
  'ACDEFHKL': ['H','E','F','C','A','D','L','K'],
  'ACDEFHJL': ['H','J','F','C','A','D','L','E'],
  'ACDEFHJK': ['H','J','E','C','A','F','D','K'],
  'ACDEFHIL': ['H','E','F','C','A','D','L','I'],
  'ACDEFHIK': ['H','E','F','C','A','D','I','K'],
  'ACDEFHIJ': ['H','J','E','C','A','F','D','I'],
  'ACDEFGKL': ['C','G','E','D','A','F','L','K'],
  'ACDEFGJL': ['C','G','J','D','A','F','L','E'],
  'ACDEFGJK': ['C','G','J','D','A','F','E','K'],
  'ACDEFGIL': ['C','G','E','D','A','F','L','I'],
  'ACDEFGIK': ['C','G','E','D','A','F','I','K'],
  'ACDEFGIJ': ['C','G','J','D','A','F','E','I'],
  'ACDEFGHL': ['H','G','F','C','A','D','L','E'],
  'ACDEFGHK': ['H','G','E','C','A','F','D','K'],
  'ACDEFGHJ': ['H','G','J','C','A','F','D','E'],
  'ACDEFGHI': ['H','G','E','C','A','F','D','I'],
  'ABGHIJKL': ['H','J','B','A','I','G','L','K'],
  'ABFHIJKL': ['H','J','B','A','I','F','L','K'],
  'ABFGIJKL': ['I','J','B','F','A','G','L','K'],
  'ABFGHJKL': ['H','J','B','F','A','G','L','K'],
  'ABFGHIKL': ['H','G','B','A','I','F','L','K'],
  'ABFGHIJL': ['H','J','B','F','A','G','L','I'],
  'ABFGHIJK': ['H','J','B','F','A','G','I','K'],
  'ABEHIJKL': ['E','J','B','A','I','H','L','K'],
  'ABEGIJKL': ['E','J','B','A','I','G','L','K'],
  'ABEGHJKL': ['E','J','B','A','H','G','L','K'],
  'ABEGHIKL': ['E','G','B','A','I','H','L','K'],
  'ABEGHIJL': ['E','J','B','A','H','G','L','I'],
  'ABEGHIJK': ['E','J','B','A','H','G','I','K'],
  'ABEFIJKL': ['E','J','B','A','I','F','L','K'],
  'ABEFHJKL': ['E','J','B','F','A','H','L','K'],
  'ABEFHIKL': ['E','I','B','F','A','H','L','K'],
  'ABEFHIJL': ['E','J','B','F','A','H','L','I'],
  'ABEFHIJK': ['E','J','B','F','A','H','I','K'],
  'ABEFGJKL': ['E','J','B','F','A','G','L','K'],
  'ABEFGIKL': ['E','G','B','A','I','F','L','K'],
  'ABEFGIJL': ['E','J','B','F','A','G','L','I'],
  'ABEFGIJK': ['E','J','B','F','A','G','I','K'],
  'ABEFGHKL': ['E','G','B','F','A','H','L','K'],
  'ABEFGHJL': ['H','J','B','F','A','G','L','E'],
  'ABEFGHJK': ['H','J','B','F','A','G','E','K'],
  'ABEFGHIL': ['E','G','B','F','A','H','L','I'],
  'ABEFGHIK': ['E','G','B','F','A','H','I','K'],
  'ABEFGHIJ': ['H','J','B','F','A','G','E','I'],
  'ABDHIJKL': ['I','J','B','D','A','H','L','K'],
  'ABDGIJKL': ['I','J','B','D','A','G','L','K'],
  'ABDGHJKL': ['H','J','B','D','A','G','L','K'],
  'ABDGHIKL': ['I','G','B','D','A','H','L','K'],
  'ABDGHIJL': ['H','J','B','D','A','G','L','I'],
  'ABDGHIJK': ['H','J','B','D','A','G','I','K'],
  'ABDFIJKL': ['I','J','B','D','A','F','L','K'],
  'ABDFHJKL': ['H','J','B','D','A','F','L','K'],
  'ABDFHIKL': ['H','I','B','D','A','F','L','K'],
  'ABDFHIJL': ['H','J','B','D','A','F','L','I'],
  'ABDFHIJK': ['H','J','B','D','A','F','I','K'],
  'ABDFGJKL': ['F','J','B','D','A','G','L','K'],
  'ABDFGIKL': ['I','G','B','D','A','F','L','K'],
  'ABDFGIJL': ['F','J','B','D','A','G','L','I'],
  'ABDFGIJK': ['F','J','B','D','A','G','I','K'],
  'ABDFGHKL': ['H','G','B','D','A','F','L','K'],
  'ABDFGHJL': ['H','G','B','D','A','F','L','J'],
  'ABDFGHJK': ['H','G','B','D','A','F','J','K'],
  'ABDFGHIL': ['H','G','B','D','A','F','L','I'],
  'ABDFGHIK': ['H','G','B','D','A','F','I','K'],
  'ABDFGHIJ': ['H','G','B','D','A','F','I','J'],
  'ABDEIJKL': ['E','J','B','A','I','D','L','K'],
  'ABDEHJKL': ['E','J','B','D','A','H','L','K'],
  'ABDEHIKL': ['E','I','B','D','A','H','L','K'],
  'ABDEHIJL': ['E','J','B','D','A','H','L','I'],
  'ABDEHIJK': ['E','J','B','D','A','H','I','K'],
  'ABDEGJKL': ['E','J','B','D','A','G','L','K'],
  'ABDEGIKL': ['E','G','B','A','I','D','L','K'],
  'ABDEGIJL': ['E','J','B','D','A','G','L','I'],
  'ABDEGIJK': ['E','J','B','D','A','G','I','K'],
  'ABDEGHKL': ['E','G','B','D','A','H','L','K'],
  'ABDEGHJL': ['H','J','B','D','A','G','L','E'],
  'ABDEGHJK': ['H','J','B','D','A','G','E','K'],
  'ABDEGHIL': ['E','G','B','D','A','H','L','I'],
  'ABDEGHIK': ['E','G','B','D','A','H','I','K'],
  'ABDEGHIJ': ['H','J','B','D','A','G','E','I'],
  'ABDEFJKL': ['E','J','B','D','A','F','L','K'],
  'ABDEFIKL': ['E','I','B','D','A','F','L','K'],
  'ABDEFIJL': ['E','J','B','D','A','F','L','I'],
  'ABDEFIJK': ['E','J','B','D','A','F','I','K'],
  'ABDEFHKL': ['H','E','B','D','A','F','L','K'],
  'ABDEFHJL': ['H','J','B','D','A','F','L','E'],
  'ABDEFHJK': ['H','J','B','D','A','F','E','K'],
  'ABDEFHIL': ['H','E','B','D','A','F','L','I'],
  'ABDEFHIK': ['H','E','B','D','A','F','I','K'],
  'ABDEFHIJ': ['H','J','B','D','A','F','E','I'],
  'ABDEFGKL': ['E','G','B','D','A','F','L','K'],
  'ABDEFGJL': ['E','G','B','D','A','F','L','J'],
  'ABDEFGJK': ['E','G','B','D','A','F','J','K'],
  'ABDEFGIL': ['E','G','B','D','A','F','L','I'],
  'ABDEFGIK': ['E','G','B','D','A','F','I','K'],
  'ABDEFGIJ': ['E','G','B','D','A','F','I','J'],
  'ABDEFGHL': ['H','G','B','D','A','F','L','E'],
  'ABDEFGHK': ['H','G','B','D','A','F','E','K'],
  'ABDEFGHJ': ['H','G','B','D','A','F','E','J'],
  'ABDEFGHI': ['H','G','B','D','A','F','E','I'],
  'ABCHIJKL': ['I','J','B','C','A','H','L','K'],
  'ABCGIJKL': ['I','J','B','C','A','G','L','K'],
  'ABCGHJKL': ['H','J','B','C','A','G','L','K'],
  'ABCGHIKL': ['I','G','B','C','A','H','L','K'],
  'ABCGHIJL': ['H','J','B','C','A','G','L','I'],
  'ABCGHIJK': ['H','J','B','C','A','G','I','K'],
  'ABCFIJKL': ['I','J','B','C','A','F','L','K'],
  'ABCFHJKL': ['H','J','B','C','A','F','L','K'],
  'ABCFHIKL': ['H','I','B','C','A','F','L','K'],
  'ABCFHIJL': ['H','J','B','C','A','F','L','I'],
  'ABCFHIJK': ['H','J','B','C','A','F','I','K'],
  'ABCFGJKL': ['C','J','B','F','A','G','L','K'],
  'ABCFGIKL': ['I','G','B','C','A','F','L','K'],
  'ABCFGIJL': ['C','J','B','F','A','G','L','I'],
  'ABCFGIJK': ['C','J','B','F','A','G','I','K'],
  'ABCFGHKL': ['H','G','B','C','A','F','L','K'],
  'ABCFGHJL': ['H','G','B','C','A','F','L','J'],
  'ABCFGHJK': ['H','G','B','C','A','F','J','K'],
  'ABCFGHIL': ['H','G','B','C','A','F','L','I'],
  'ABCFGHIK': ['H','G','B','C','A','F','I','K'],
  'ABCFGHIJ': ['H','G','B','C','A','F','I','J'],
  'ABCEIJKL': ['E','J','B','A','I','C','L','K'],
  'ABCEHJKL': ['E','J','B','C','A','H','L','K'],
  'ABCEHIKL': ['E','I','B','C','A','H','L','K'],
  'ABCEHIJL': ['E','J','B','C','A','H','L','I'],
  'ABCEHIJK': ['E','J','B','C','A','H','I','K'],
  'ABCEGJKL': ['E','J','B','C','A','G','L','K'],
  'ABCEGIKL': ['E','G','B','A','I','C','L','K'],
  'ABCEGIJL': ['E','J','B','C','A','G','L','I'],
  'ABCEGIJK': ['E','J','B','C','A','G','I','K'],
  'ABCEGHKL': ['E','G','B','C','A','H','L','K'],
  'ABCEGHJL': ['H','J','B','C','A','G','L','E'],
  'ABCEGHJK': ['H','J','B','C','A','G','E','K'],
  'ABCEGHIL': ['E','G','B','C','A','H','L','I'],
  'ABCEGHIK': ['E','G','B','C','A','H','I','K'],
  'ABCEGHIJ': ['H','J','B','C','A','G','E','I'],
  'ABCEFJKL': ['E','J','B','C','A','F','L','K'],
  'ABCEFIKL': ['E','I','B','C','A','F','L','K'],
  'ABCEFIJL': ['E','J','B','C','A','F','L','I'],
  'ABCEFIJK': ['E','J','B','C','A','F','I','K'],
  'ABCEFHKL': ['H','E','B','C','A','F','L','K'],
  'ABCEFHJL': ['H','J','B','C','A','F','L','E'],
  'ABCEFHJK': ['H','J','B','C','A','F','E','K'],
  'ABCEFHIL': ['H','E','B','C','A','F','L','I'],
  'ABCEFHIK': ['H','E','B','C','A','F','I','K'],
  'ABCEFHIJ': ['H','J','B','C','A','F','E','I'],
  'ABCEFGKL': ['E','G','B','C','A','F','L','K'],
  'ABCEFGJL': ['E','G','B','C','A','F','L','J'],
  'ABCEFGJK': ['E','G','B','C','A','F','J','K'],
  'ABCEFGIL': ['E','G','B','C','A','F','L','I'],
  'ABCEFGIK': ['E','G','B','C','A','F','I','K'],
  'ABCEFGIJ': ['E','G','B','C','A','F','I','J'],
  'ABCEFGHL': ['H','G','B','C','A','F','L','E'],
  'ABCEFGHK': ['H','G','B','C','A','F','E','K'],
  'ABCEFGHJ': ['H','G','B','C','A','F','E','J'],
  'ABCEFGHI': ['H','G','B','C','A','F','E','I'],
  'ABCDIJKL': ['I','J','B','C','A','D','L','K'],
  'ABCDHJKL': ['H','J','B','C','A','D','L','K'],
  'ABCDHIKL': ['H','I','B','C','A','D','L','K'],
  'ABCDHIJL': ['H','J','B','C','A','D','L','I'],
  'ABCDHIJK': ['H','J','B','C','A','D','I','K'],
  'ABCDGJKL': ['C','J','B','D','A','G','L','K'],
  'ABCDGIKL': ['I','G','B','C','A','D','L','K'],
  'ABCDGIJL': ['C','J','B','D','A','G','L','I'],
  'ABCDGIJK': ['C','J','B','D','A','G','I','K'],
  'ABCDGHKL': ['H','G','B','C','A','D','L','K'],
  'ABCDGHJL': ['H','G','B','C','A','D','L','J'],
  'ABCDGHJK': ['H','G','B','C','A','D','J','K'],
  'ABCDGHIL': ['H','G','B','C','A','D','L','I'],
  'ABCDGHIK': ['H','G','B','C','A','D','I','K'],
  'ABCDGHIJ': ['H','G','B','C','A','D','I','J'],
  'ABCDFJKL': ['C','J','B','D','A','F','L','K'],
  'ABCDFIKL': ['C','I','B','D','A','F','L','K'],
  'ABCDFIJL': ['C','J','B','D','A','F','L','I'],
  'ABCDFIJK': ['C','J','B','D','A','F','I','K'],
  'ABCDFHKL': ['H','F','B','C','A','D','L','K'],
  'ABCDFHJL': ['C','J','B','D','A','F','L','H'],
  'ABCDFHJK': ['H','J','B','C','A','F','D','K'],
  'ABCDFHIL': ['H','F','B','C','A','D','L','I'],
  'ABCDFHIK': ['H','F','B','C','A','D','I','K'],
  'ABCDFHIJ': ['H','J','B','C','A','F','D','I'],
  'ABCDFGKL': ['C','G','B','D','A','F','L','K'],
  'ABCDFGJL': ['C','G','B','D','A','F','L','J'],
  'ABCDFGJK': ['C','G','B','D','A','F','J','K'],
  'ABCDFGIL': ['C','G','B','D','A','F','L','I'],
  'ABCDFGIK': ['C','G','B','D','A','F','I','K'],
  'ABCDFGIJ': ['C','G','B','D','A','F','I','J'],
  'ABCDFGHL': ['C','G','B','D','A','F','L','H'],
  'ABCDFGHK': ['H','G','B','C','A','F','D','K'],
  'ABCDFGHJ': ['H','G','B','C','A','F','D','J'],
  'ABCDFGHI': ['H','G','B','C','A','F','D','I'],
  'ABCDEJKL': ['E','J','B','C','A','D','L','K'],
  'ABCDEIKL': ['E','I','B','C','A','D','L','K'],
  'ABCDEIJL': ['E','J','B','C','A','D','L','I'],
  'ABCDEIJK': ['E','J','B','C','A','D','I','K'],
  'ABCDEHKL': ['H','E','B','C','A','D','L','K'],
  'ABCDEHJL': ['H','J','B','C','A','D','L','E'],
  'ABCDEHJK': ['H','J','B','C','A','D','E','K'],
  'ABCDEHIL': ['H','E','B','C','A','D','L','I'],
  'ABCDEHIK': ['H','E','B','C','A','D','I','K'],
  'ABCDEHIJ': ['H','J','B','C','A','D','E','I'],
  'ABCDEGKL': ['E','G','B','C','A','D','L','K'],
  'ABCDEGJL': ['E','G','B','C','A','D','L','J'],
  'ABCDEGJK': ['E','G','B','C','A','D','J','K'],
  'ABCDEGIL': ['E','G','B','C','A','D','L','I'],
  'ABCDEGIK': ['E','G','B','C','A','D','I','K'],
  'ABCDEGIJ': ['E','G','B','C','A','D','I','J'],
  'ABCDEGHL': ['H','G','B','C','A','D','L','E'],
  'ABCDEGHK': ['H','G','B','C','A','D','E','K'],
  'ABCDEGHJ': ['H','G','B','C','A','D','E','J'],
  'ABCDEGHI': ['H','G','B','C','A','D','E','I'],
  'ABCDEFKL': ['C','E','B','D','A','F','L','K'],
  'ABCDEFJL': ['C','J','B','D','A','F','L','E'],
  'ABCDEFJK': ['C','J','B','D','A','F','E','K'],
  'ABCDEFIL': ['C','E','B','D','A','F','L','I'],
  'ABCDEFIK': ['C','E','B','D','A','F','I','K'],
  'ABCDEFIJ': ['C','J','B','D','A','F','E','I'],
  'ABCDEFHL': ['H','F','B','C','A','D','L','E'],
  'ABCDEFHK': ['H','E','B','C','A','F','D','K'],
  'ABCDEFHJ': ['H','J','B','C','A','F','D','E'],
  'ABCDEFHI': ['H','E','B','C','A','F','D','I'],
  'ABCDEFGL': ['C','G','B','D','A','F','L','E'],
  'ABCDEFGK': ['C','G','B','D','A','F','E','K'],
  'ABCDEFGJ': ['C','G','B','D','A','F','E','J'],
  'ABCDEFGI': ['C','G','B','D','A','F','E','I'],
  'ABCDEFGH': ['H','G','B','C','A','F','D','E'],
};

// ─── 진출팀 계산 ──────────────────────────────────────────────────
function getSimQualifiers() {
  const qual = {};
  const thirds = [];
  const groups = [...new Set(simMatches.map(m => m.group))].sort();

  groups.forEach(g => {
    const st = calcSimGroupStandings(g);
    if (st[0]) qual[`Winner Group ${g}`]    = st[0].team_id;
    if (st[1]) qual[`Runner-up Group ${g}`] = st[1].team_id;
    if (st[2]) thirds.push({ group: g, ...st[2] });
  });

  // 3위팀 중 승점→득실→득점 순 상위 8팀
  const best8 = [...thirds]
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
    .slice(0, 8);

  const groupToTeamId = {};
  best8.forEach(t => { groupToTeamId[t.group] = t.team_id; });

  // FIFA 공식 Annex C 테이블로 3위팀 배정
  const sortedKey = best8.map(t => t.group).sort().join('');
  const FIFA_SLOT_LABELS = [
    '3rd Group C/E/F/H/I',
    '3rd Group E/F/G/I/J',
    '3rd Group B/E/F/I/J',
    '3rd Group A/B/C/D/F',
    '3rd Group A/E/H/I/J',
    '3rd Group C/D/F/G/H',
    '3rd Group D/E/I/J/L',
    '3rd Group E/H/I/J/K',
  ];
  const thirdByLabel = {};
  const assignment = FIFA_THIRD_PLACE_TABLE[sortedKey];
  if (assignment) {
    FIFA_SLOT_LABELS.forEach((label, i) => {
      thirdByLabel[label] = groupToTeamId[assignment[i]];
    });
  }
  qual.__thirdByLabel = thirdByLabel;

  return qual;
}

// "Winner Group A" / "Runner-up Group B" / "3rd Group A/B/C" 라벨 → 팀 ID 변환
function resolveLabel(label, qual) {
  if (!label) return '0';
  if (label.startsWith('Winner Group '))    return qual[label] || '0';
  if (label.startsWith('Runner-up Group ')) return qual[label] || '0';
  if (label.startsWith('3rd Group '))       return qual.__thirdByLabel?.[label] || '0';
  return '0';
}

// ─── HTML 생성: 순위표 ────────────────────────────────────────────
function simStandingsHtml(groupName) {
  const st = calcSimGroupStandings(groupName);
  const rows = st.map((t, i) => {
    const team = teamsMap[t.team_id] || {};
    const flag = team.flag ? `<img src="${team.flag}" class="flag-icon">` : '';
    const name = team.name_ko || team.name_en || `팀 ${t.team_id}`;
    return `<tr>
      <td>${i + 1}</td>
      <td class="team-cell">${flag}<span>${name}</span></td>
      <td>${t.mp}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
      <td>${t.gd >= 0 ? '+' : ''}${t.gd}</td>
      <td><strong>${t.pts}</strong></td>
    </tr>`;
  }).join('');
  return `
    <table class="standings-table sim-standings-table">
      <thead><tr><th>#</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ─── HTML 생성: 경기 목록 (점수 입력) ────────────────────────────
function simMatchListHtml(groupName) {
  const matches = simMatches
    .filter(m => m.group === groupName)
    .sort((a, b) => new Date(a.local_date) - new Date(b.local_date));

  return matches.map(m => {
    const homeTeam = teamsMap[m.home_team_id] || {};
    const awayTeam = teamsMap[m.away_team_id] || {};
    const homeName = homeTeam.name_ko || m.home_team_name_en || '?';
    const awayName = awayTeam.name_ko || m.away_team_name_en || '?';
    const homeFlag = homeTeam.flag ? `<img src="${homeTeam.flag}" class="flag-icon">` : '';
    const awayFlag = awayTeam.flag ? `<img src="${awayTeam.flag}" class="flag-icon">` : '';
    const time = toKST(m.local_date, m.stadium_id);
    const isReal = m.finished === true || m.finished === 'TRUE';

    return `
      <div class="sim-match-card ${isReal ? 'sim-real' : ''}">
        <span class="sim-match-time">${time}</span>
        <span class="sim-team home">${homeFlag}${homeName}</span>
        <div class="sim-score-ctrl">
          <button class="sim-btn" onclick="changeSimScore('${m.id}','home',1)">▲</button>
          <button class="sim-btn" onclick="changeSimScore('${m.id}','home',-1)">▼</button>
        </div>
        <div class="sim-score-center">
          <span class="sim-score-val" data-score-id="${m.id}-home">${m.sim_home_score}</span>
          <span class="sim-sep">-</span>
          <span class="sim-score-val" data-score-id="${m.id}-away">${m.sim_away_score}</span>
        </div>
        <div class="sim-score-ctrl">
          <button class="sim-btn" onclick="changeSimScore('${m.id}','away',1)">▲</button>
          <button class="sim-btn" onclick="changeSimScore('${m.id}','away',-1)">▼</button>
        </div>
        <span class="sim-team away">${awayName}${awayFlag}</span>
      </div>`;
  }).join('');
}

// ─── 그룹 카드 HTML ───────────────────────────────────────────────
function simGroupCardHtml(groupName) {
  return `
    <div class="sim-group-card" id="sim-group-${groupName}">
      <div class="sim-group-title">${groupName}조</div>
      <div class="sim-standings">${simStandingsHtml(groupName)}</div>
      <div class="sim-match-list">${simMatchListHtml(groupName)}</div>
    </div>`;
}

// ─── 탭 렌더링: 조별리그 ─────────────────────────────────────────
function renderSimGroupTab() {
  const container = document.getElementById('subtab-sim-group');
  if (!simMatches.length) {
    container.innerHTML = '<p class="placeholder">데이터 로딩 중...</p>';
    return;
  }
  const groups = [...new Set(simMatches.map(m => m.group))].sort();
  container.innerHTML = `<div class="sim-grid">${groups.map(g => simGroupCardHtml(g)).join('')}</div>`;
}

// ─── 토너먼트 점수 관련 ───────────────────────────────────────────

// 국가이름 최대 3글자로 자르기
function shortName(name) {
  if (!name) return '—';
  return name.length > 3 ? name.slice(0, 3) : name;
}

// r32 팀 배정 + 각 라운드 승자를 전파해서 전체 토너먼트 상태 계산
function buildSimKnockoutData() {
  const qual = getSimQualifiers();
  const sorted = simKnockoutMatches.map(m => ({ ...m })).sort((a, b) => Number(a.id) - Number(b.id));

  const r32   = sorted.filter(m => m.type === 'r32');
  const r16   = sorted.filter(m => m.type === 'r16');
  const qf    = sorted.filter(m => m.type === 'qf');
  const sf    = sorted.filter(m => m.type === 'sf');
  const finalM = sorted.find(m => m.type === 'final');
  const thirdM = sorted.find(m => m.type === 'third');

  // r32: 조별 진출팀
  r32.forEach(m => {
    m.sim_home_team_id = resolveLabel(m.home_team_label, qual);
    m.sim_away_team_id = resolveLabel(m.away_team_label, qual);
  });

  // 동점이면 홈팀 승 (시뮬레이션 편의상)
  const winner = m => m.sim_home_score >= m.sim_away_score ? m.sim_home_team_id : m.sim_away_team_id;
  const loser  = m => m.sim_home_score >= m.sim_away_score ? m.sim_away_team_id : m.sim_home_team_id;

  r16.forEach((m, i) => { m.sim_home_team_id = winner(r32[i*2]); m.sim_away_team_id = winner(r32[i*2+1]); });
  qf.forEach((m, i)  => { m.sim_home_team_id = winner(r16[i*2]); m.sim_away_team_id = winner(r16[i*2+1]); });
  sf.forEach((m, i)  => { m.sim_home_team_id = winner(qf[i*2]);  m.sim_away_team_id = winner(qf[i*2+1]); });
  if (finalM) { finalM.sim_home_team_id = winner(sf[0]); finalM.sim_away_team_id = winner(sf[1]); }
  if (thirdM) { thirdM.sim_home_team_id = loser(sf[0]);  thirdM.sim_away_team_id = loser(sf[1]); }

  return sorted;
}

// 시뮬 브라켓 팀 행: 국기 국가이름(max3) 점수 [▲▼]
function renderSimBracketTeam(match, side, isWinner) {
  const teamId = side === 'home' ? match.sim_home_team_id : match.sim_away_team_id;
  const score  = side === 'home' ? match.sim_home_score  : match.sim_away_score;

  let flagHtml = '';
  let nameHtml = '<span class="sim-bt-name tbd-label">—</span>';
  let confirmed = false;

  if (teamId && teamId !== '0') {
    const team = teamsMap[teamId];
    if (team) {
      flagHtml = `<img src="${team.flag}" class="flag-icon">`;
      nameHtml = `<span class="sim-bt-name">${shortName(team.name_ko || team.name_en)}</span>`;
      confirmed = true;
    }
  }

  const ctrlHtml = confirmed ? `
    <span class="sim-bt-score">${score}</span>
    <div class="sim-bt-ctrl">
      <button class="sim-bt-btn" onclick="changeSimKnockoutScore('${match.id}','${side}',1)">▲</button>
      <button class="sim-bt-btn" onclick="changeSimKnockoutScore('${match.id}','${side}',-1)">▼</button>
    </div>` : '';

  return `
    <div class="bracket-team sim-bracket-team ${isWinner ? 'winner' : ''} ${!confirmed ? 'unconfirmed' : ''}">
      ${flagHtml}${nameHtml}${ctrlHtml}
    </div>`;
}

// 시뮬 브라켓 경기 카드
function renderSimBracketMatch(match, matchLabel) {
  if (!match) return '<div class="bracket-match phantom"></div>';
  const hs = match.sim_home_score, as = match.sim_away_score;
  return `
    <div class="bracket-match">
      ${matchLabel ? `<div class="match-header">${matchLabel}</div>` : ''}
      ${renderSimBracketTeam(match, 'home', hs > as)}
      ${renderSimBracketTeam(match, 'away', as > hs)}
    </div>`;
}

// 토너먼트 점수 변경: simKnockoutMatches 업데이트 후 전체 재렌더
function changeSimKnockoutScore(matchId, side, delta) {
  const m = simKnockoutMatches.find(m => m.id === matchId);
  if (!m) return;
  if (side === 'home') m.sim_home_score = Math.max(0, m.sim_home_score + delta);
  else                 m.sim_away_score = Math.max(0, m.sim_away_score + delta);
  renderSimTournamentTab();
}

// ─── 탭 렌더링: 토너먼트 ─────────────────────────────────────────
function renderSimTournamentTab() {
  initSim();
  initSimKnockout();
  const simKnockout = buildSimKnockoutData();

  // 결승 승자 계산
  const finalM = simKnockout.find(m => m.type === 'final');
  let champion = null;
  if (finalM && finalM.sim_home_team_id && finalM.sim_home_team_id !== '0'
              && finalM.sim_away_team_id && finalM.sim_away_team_id !== '0') {
    const winnerId = finalM.sim_home_score >= finalM.sim_away_score
      ? finalM.sim_home_team_id
      : finalM.sim_away_team_id;
    const team = teamsMap[winnerId];
    if (team) champion = { name: team.name_ko || team.name_en, flag: team.flag };
  }

  document.getElementById('subtab-sim-tournament').innerHTML = buildBracketHtml(
    simKnockout,
    { renderMatch: renderSimBracketMatch, champion }
  );
}

function refreshSimTournamentIfVisible() {
  const el = document.getElementById('subtab-sim-tournament');
  if (el?.classList.contains('active')) renderSimTournamentTab();
}

// ─── 전체 점수 표시 갱신 ─────────────────────────────────────────
function rerenderAllSimGroups() {
  const groups = [...new Set(simMatches.map(m => m.group))].sort();
  groups.forEach(g => {
    document.querySelectorAll(`#sim-group-${g} [data-score-id]`).forEach(el => {
      const [id, side] = el.dataset.scoreId.split('-');
      const m = simMatches.find(m => m.id === id);
      if (m) el.textContent = side === 'home' ? m.sim_home_score : m.sim_away_score;
    });
    const standingsEl = document.querySelector(`#sim-group-${g} .sim-standings`);
    if (standingsEl) standingsEl.innerHTML = simStandingsHtml(g);
  });
  refreshSimTournamentIfVisible();
}

// ─── 액션 버튼 ───────────────────────────────────────────────────
function applyRealResults() {
  initSimKnockout();
  simMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
    }
  });
  simKnockoutMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
    }
  });
  rerenderAllSimGroups();
}

function applyRealAndRandom() {
  initSimKnockout();
  simMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
    } else {
      const sc = randomScore();
      m.sim_home_score = sc.home;
      m.sim_away_score = sc.away;
    }
  });
  simKnockoutMatches.forEach(m => {
    if (m.finished === true || m.finished === 'TRUE') {
      m.sim_home_score = Number(m.home_score);
      m.sim_away_score = Number(m.away_score);
    } else {
      const sc = randomScore();
      m.sim_home_score = sc.home;
      m.sim_away_score = sc.away;
    }
  });
  rerenderAllSimGroups();
}

function fullRandom() {
  initSimKnockout();
  simMatches.forEach(m => {
    const sc = randomScore();
    m.sim_home_score = sc.home;
    m.sim_away_score = sc.away;
  });
  simKnockoutMatches.forEach(m => {
    const sc = randomScore();
    m.sim_home_score = sc.home;
    m.sim_away_score = sc.away;
  });
  rerenderAllSimGroups();
}

// 현실적인 축구 스코어 분포
function randomScore() {
  const pool = [0,0,0,1,1,1,1,1,2,2,2,3,3,4];
  return {
    home: pool[Math.floor(Math.random() * pool.length)],
    away: pool[Math.floor(Math.random() * pool.length)],
  };
}

// ─── 이벤트 등록 ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-tab="simulation"]').forEach(btn => {
    btn.addEventListener('click', () => {
      initSim();
      initSimKnockout();
      renderSimGroupTab();
    });
  });

  document.querySelectorAll('[data-subtab="sim-tournament"]').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(renderSimTournamentTab, 100));
  });
});
