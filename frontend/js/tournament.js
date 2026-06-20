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
    <div class="bracket-match">
      ${matchLabel ? `<div class="match-header">${matchLabel}</div>` : ''}
      ${renderTeam(match.home_team_id, match.home_team_label, match.home_score, isFinished && s1 > s2, isFinished)}
      ${renderTeam(match.away_team_id, match.away_team_label, match.away_score, isFinished && s2 > s1, isFinished)}
    </div>`;
}

// 두 경기를 하나의 pair로 묶음 (연결선 표시용)
function renderPair(m1, m2, side, labels) {
  return `
    <div class="match-pair ${side}">
      ${renderBracketMatch(m1, labels[m1?.id])}
      ${renderBracketMatch(m2, labels[m2?.id])}
    </div>`;
}

// 한 쪽(left/right) 브라켓 렌더링
function renderHalf(r32, r16, qf, sf, side, labels) {
  const r32cols = `
    <div class="bracket-col">
      <div class="bracket-col-label">32강</div>
      <div class="bracket-col-body">
        ${renderPair(r32[0], r32[1], side, labels)}
        ${renderPair(r32[2], r32[3], side, labels)}
        ${renderPair(r32[4], r32[5], side, labels)}
        ${renderPair(r32[6], r32[7], side, labels)}
      </div>
    </div>`;

  const r16col = `
    <div class="bracket-col">
      <div class="bracket-col-label">16강</div>
      <div class="bracket-col-body">
        ${renderPair(r16[0], r16[1], side, labels)}
        ${renderPair(r16[2], r16[3], side, labels)}
      </div>
    </div>`;

  const qfcol = `
    <div class="bracket-col">
      <div class="bracket-col-label">8강</div>
      <div class="bracket-col-body">
        ${renderPair(qf[0], qf[1], side, labels)}
      </div>
    </div>`;

  const sfcol = `
    <div class="bracket-col sf-col ${side}">
      <div class="bracket-col-label">4강</div>
      <div class="bracket-col-body single">
        <div class="match-single">${renderBracketMatch(sf, labels[sf?.id])}</div>
      </div>
    </div>`;

  if (side === 'right') return sfcol + qfcol + r16col + r32cols;
  return r32cols + r16col + qfcol + sfcol;
}

function renderTournament() {
  const container = document.getElementById('subtab-schedule-tournament');
  if (!matchesData || matchesData.length === 0) {
    container.innerHTML = '<p>데이터 로딩 중...</p>';
    return;
  }

  const sorted = matchesData
    .filter(m => m.type !== 'group')
    .sort((a, b) => Number(a.id) - Number(b.id));

  const r32 = sorted.filter(m => m.type === 'r32');
  const r16 = sorted.filter(m => m.type === 'r16');
  const qf  = sorted.filter(m => m.type === 'qf');
  const sf  = sorted.filter(m => m.type === 'sf');
  const finalMatch = sorted.find(m => m.type === 'final');
  const thirdMatch = sorted.find(m => m.type === 'third');

  // 각 경기에 "32강 1경기" 형식 라벨 생성
  const typeKo = { r32: '32강', r16: '16강', qf: '8강', sf: '4강' };
  const labels = {};
  ['r32', 'r16', 'qf', 'sf'].forEach(type => {
    sorted.filter(m => m.type === type).forEach((m, i) => {
      labels[m.id] = `${typeKo[type]} ${i + 1}경기`;
    });
  });
  if (finalMatch) labels[finalMatch.id] = '결승';
  if (thirdMatch) labels[thirdMatch.id] = '3위결정전';

  const html = `
    <div class="bracket-wrapper">
      <div class="bracket-outer">
        ${renderHalf(r32.slice(0,8), r16.slice(0,4), qf.slice(0,2), sf[0], 'left', labels)}

        <div class="bracket-center">
          <div class="bracket-col-label">결승</div>
          <div class="bracket-center-body">
            <div class="trophy">🏆</div>
            ${renderBracketMatch(finalMatch, labels[finalMatch?.id])}
          </div>
        </div>

        ${renderHalf(r32.slice(8,16), r16.slice(4,8), qf.slice(2,4), sf[1], 'right', labels)}
      </div>

      ${thirdMatch ? `
        <div class="third-place-wrap">
          <div class="bracket-col-label">3위결정전</div>
          ${renderBracketMatch(thirdMatch, labels[thirdMatch.id])}
        </div>` : ''}
    </div>`;

  container.innerHTML = html;
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
