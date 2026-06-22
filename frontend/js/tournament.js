// 토너먼트 브라켓 렌더링 (연결선 포함 대칭 구조)

function translateLabel(label) {
  if (!label) return '';
  if (label.includes('Winner Group')) return label.replace(/Winner Group ([A-L])/g, '$1조 1위');
  if (label.includes('Runner-up Group')) return label.replace(/Runner-up Group ([A-L])/g, '$1조 2위');
  if (label.includes('3rd Group')) return label.replace(/3rd Group ([A-L\/]+)/g, '$1조 3위');
  return '';
}

function teamDisplay(teamId, teamLabel) {
  if (teamId && teamId !== '0') {
    const team = teamsMap[teamId];
    if (team) {
      return { html: `<img src="${team.flag}" class="flag-icon"><span>${team.name_ko || team.name_en}</span>`, confirmed: true };
    }
  }
  const label = translateLabel(teamLabel);
  return { html: label ? `<span class="tbd-label">${label}</span>` : '<span class="tbd-empty">—</span>', confirmed: false };
}

// 팀 컴포넌트: 팀 한 줄 (국기+이름 왼쪽, 스코어 오른쪽)
function renderTeam(teamId, teamLabel, score, isWinner, isFinished) {
  const team = teamDisplay(teamId, teamLabel);
  return `
    <div class="bracket-team ${isWinner ? 'winner' : ''} ${!team.confirmed ? 'unconfirmed' : ''}">
      <span class="bracket-team-name">${team.html}</span>
      ${isFinished ? `<span class="bracket-score">${score}</span>` : ''}
    </div>`;
}

// match 컴포넌트: 헤더 + 팀 컴포넌트 2개
function renderBracketMatch(match, matchLabel) {
  if (!match) return '<div class="bracket-match phantom"></div>';
  const isFinished = match.finished === true || match.finished === "TRUE";
  const s1 = Number(match.home_score);
  const s2 = Number(match.away_score);

  return `
    <div class="bracket-match bracket-match-click" data-match-id="${match.id}" onclick="handleMatchClick(event,'${match.id}')">
      ${matchLabel ? `<div class="match-header">${matchLabel}</div>` : ''}
      ${renderTeam(match.home_team_id, match.home_team_label, match.home_score, isFinished && s1 > s2, isFinished)}
      ${renderTeam(match.away_team_id, match.away_team_label, match.away_score, isFinished && s2 > s1, isFinished)}
    </div>`;
}

// 두 경기를 하나의 pair로 묶음 (연결선 표시용)
function renderPair(m1, m2, side, labels, renderFn) {
  renderFn = renderFn || renderBracketMatch;
  return `
    <div class="match-pair ${side}">
      ${renderFn(m1, labels[m1?.id])}
      ${renderFn(m2, labels[m2?.id])}
    </div>`;
}

// 한 쪽(left/right) 브라켓 렌더링
function renderHalf(r32, r16, qf, sf, side, labels, renderFn) {
  renderFn = renderFn || renderBracketMatch;
  const r32cols = `
    <div class="bracket-col">
      <div class="bracket-col-label">32강</div>
      <div class="bracket-col-body">
        ${renderPair(r32[0], r32[1], side, labels, renderFn)}
        ${renderPair(r32[2], r32[3], side, labels, renderFn)}
        ${renderPair(r32[4], r32[5], side, labels, renderFn)}
        ${renderPair(r32[6], r32[7], side, labels, renderFn)}
      </div>
    </div>`;

  const r16col = `
    <div class="bracket-col">
      <div class="bracket-col-label">16강</div>
      <div class="bracket-col-body">
        ${renderPair(r16[0], r16[1], side, labels, renderFn)}
        ${renderPair(r16[2], r16[3], side, labels, renderFn)}
      </div>
    </div>`;

  const qfcol = `
    <div class="bracket-col">
      <div class="bracket-col-label">8강</div>
      <div class="bracket-col-body">
        ${renderPair(qf[0], qf[1], side, labels, renderFn)}
      </div>
    </div>`;

  const sfcol = `
    <div class="bracket-col sf-col ${side}">
      <div class="bracket-col-label">4강</div>
      <div class="bracket-col-body single">
        <div class="match-single">${renderFn(sf, labels[sf?.id])}</div>
      </div>
    </div>`;

  if (side === 'right') return sfcol + qfcol + r16col + r32cols;
  return r32cols + r16col + qfcol + sfcol;
}

// 브라켓 HTML 생성 (일정탭 + 시뮬탭 공용, opts.renderMatch로 렌더 함수 교체 가능)
function buildBracketHtml(matches, opts = {}) {
  const sorted = [...matches].sort((a, b) => Number(a.id) - Number(b.id));

  const sf  = sorted.filter(m => m.type === 'sf');
  const finalMatch = sorted.find(m => m.type === 'final');
  const thirdMatch = sorted.find(m => m.type === 'third');

  // "Winner/Loser Match X" 레이블 → match 객체
  const matchById = {};
  sorted.forEach(m => { matchById[String(m.id)] = m; });
  function src(label) {
    const m = label?.match(/(?:Winner|Loser) Match (\d+)/);
    return m ? matchById[m[1]] : null;
  }

  // SF → QF → R16 → R32 순으로 정확한 브라켓 트리 구성
  function buildHalfArrays(sfMatch) {
    const qf1 = src(sfMatch.home_team_label);
    const qf2 = src(sfMatch.away_team_label);
    const r16a = src(qf1?.home_team_label), r16b = src(qf1?.away_team_label);
    const r16c = src(qf2?.home_team_label), r16d = src(qf2?.away_team_label);
    return {
      r32: [
        src(r16a?.home_team_label), src(r16a?.away_team_label),
        src(r16b?.home_team_label), src(r16b?.away_team_label),
        src(r16c?.home_team_label), src(r16c?.away_team_label),
        src(r16d?.home_team_label), src(r16d?.away_team_label),
      ],
      r16: [r16a, r16b, r16c, r16d],
      qf:  [qf1, qf2],
    };
  }

  const left  = buildHalfArrays(sf[0]);
  const right = buildHalfArrays(sf[1]);

  const typeKo = { r32: '32강', r16: '16강', qf: '8강', sf: '4강' };
  const labels = {};
  ['r32', 'r16', 'qf', 'sf'].forEach(type => {
    sorted.filter(m => m.type === type).forEach((m, i) => {
      labels[m.id] = `${typeKo[type]} ${i + 1}경기`;
    });
  });
  if (finalMatch) labels[finalMatch.id] = '결승';
  if (thirdMatch) labels[thirdMatch.id] = '3위결정전';

  const renderFn = opts.renderMatch || renderBracketMatch;

  return `
    <div class="bracket-wrapper">
      <div class="bracket-outer">
        ${renderHalf(left.r32, left.r16, left.qf, sf[0], 'left', labels, renderFn)}
        <div class="bracket-center">
          <div class="bracket-col-label">결승</div>
          <div class="bracket-center-body">
            ${opts.champion ? `
              <div class="champion-banner">
                <div class="champion-name">${opts.champion.name} 우승!!</div>
                <img src="${opts.champion.flag}" class="champion-flag">
              </div>` : ''}
            <div class="trophy">🏆</div>
            ${renderFn(finalMatch, labels[finalMatch?.id])}
          </div>
        </div>
        ${renderHalf(right.r32, right.r16, right.qf, sf[1], 'right', labels, renderFn)}
      </div>
      ${thirdMatch ? `
        <div class="third-place-wrap">
          <div class="bracket-col-label">3위결정전</div>
          ${renderFn(thirdMatch, labels[thirdMatch.id])}
        </div>` : ''}
    </div>`;
}

// ── 경기 라벨 생성 (matchId → "32강 1경기" 등) ──
function getMatchLabel(matchId) {
  const match = matchesData.find(m => String(m.id) === String(matchId));
  if (!match) return '';
  if (match.type === 'final') return '결승';
  if (match.type === 'third') return '3위결정전';
  const typeKo = { r32: '32강', r16: '16강', qf: '8강', sf: '4강' };
  const same = matchesData
    .filter(m => m.type === match.type)
    .sort((a, b) => Number(a.id) - Number(b.id));
  const idx = same.findIndex(m => String(m.id) === String(matchId));
  return `${typeKo[match.type]} ${idx + 1}경기`;
}

// ── 브라켓 경기 클릭 핸들러 ──
function handleMatchClick(event, matchId) {
  if (event.target.closest('button')) return;
  openTournamentMatchModal(matchId);
}

// ── 경기 상세 모달 (일정/결과 탭) ──
function openTournamentMatchModal(matchId) {
  const match = matchesData.find(m => String(m.id) === String(matchId));
  if (!match) return;

  const label = getMatchLabel(matchId);
  const isFinished = match.finished === true || match.finished === 'TRUE';
  const hs = Number(match.home_score);
  const as = Number(match.away_score);
  const isDraw = isFinished && hs === as;

  // 승부차기 데이터 (필드명 유연하게 처리)
  const homePen = match.home_penalties != null ? Number(match.home_penalties) : null;
  const awayPen = match.away_penalties != null ? Number(match.away_penalties) : null;
  const showPen = isDraw && homePen !== null && awayPen !== null;

  // 팀 표시
  const homeTeam = teamsMap[match.home_team_id];
  const awayTeam = teamsMap[match.away_team_id];
  const homeName = homeTeam?.name_ko || translateLabel(match.home_team_label) || '미정';
  const awayName = awayTeam?.name_ko || translateLabel(match.away_team_label) || '미정';
  const homeFlag = homeTeam?.flag ? `<img src="${homeTeam.flag}" class="flag-icon">` : '';
  const awayFlag = awayTeam?.flag ? `<img src="${awayTeam.flag}" class="flag-icon">` : '';

  // 경기장 및 시간
  const stadium = stadiumsMap[String(match.stadium_id)];
  const stadiumName = stadium?.name_en || stadium?.name || '';
  const matchTime = toKST(match.local_date, match.stadium_id);

  // 승자 판별
  const homeWins = isFinished && (showPen ? homePen > awayPen : hs > as);
  const awayWins = isFinished && (showPen ? awayPen > homePen : as > hs);

  function teamRow(flag, name, score, pen, isWinner) {
    return `
      <div class="tmd-row tmd-team${isWinner ? ' winner' : ''}">
        <span class="tmd-left">${flag}<span class="tmd-name">${name}</span></span>
        <span class="tmd-score">${isFinished ? score : '—'}</span>
        <span class="tmd-pen-col tmd-pen-yellow">${showPen && pen !== null ? pen : ''}</span>
      </div>`;
  }

  document.getElementById('tournament-match-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'tournament-match-modal';
  modal.className = 'tmd-overlay';
  modal.innerHTML = `
    <div class="tmd-box">
      <button class="tmd-close" onclick="document.getElementById('tournament-match-modal').remove()">✕</button>
      <div class="tmd-label">${label}</div>
      <div class="tmd-meta">${matchTime}${stadiumName ? ` · ${stadiumName}` : ''}</div>
      <div class="tmd-card${showPen ? ' show-pen' : ''}">
        <span class="tmd-pen-head">승부차기</span>
        ${teamRow(homeFlag, homeName, match.home_score, homePen, homeWins)}
        <div class="tmd-divider"></div>
        ${teamRow(awayFlag, awayName, match.away_score, awayPen, awayWins)}
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function renderTournament() {
  const container = document.getElementById('subtab-schedule-tournament');
  if (!matchesData || matchesData.length === 0) {
    container.innerHTML = '<p>데이터 로딩 중...</p>';
    return;
  }
  container.innerHTML = buildBracketHtml(matchesData.filter(m => m.type !== 'group'));
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.subtab === 'schedule-tournament') {
        setTimeout(renderTournament, 100);
      }
    });
  });
});
