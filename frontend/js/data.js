// 2026 FIFA 월드컵 데이터
// 2026년 월드컵은 미국/캐나다/멕시코 공동 개최, 48개국 참가, 12개 조

const WORLD_CUP_2026 = {
  // 조별 편성 (2026년 3월 확정 기준)
  groups: {
    A: {
      name: "A조",
      teams: ["미국", "파나마", "우루과이", "포르투갈"],
    },
    B: {
      name: "B조",
      teams: ["멕시코", "자메이카", "남아프리카공화국", "프랑스"],
    },
    C: {
      name: "C조",
      teams: ["캐나다", "온두라스", "모로코", "스페인"],
    },
    D: {
      name: "D조",
      teams: ["아르헨티나", "페루", "칠레", "호주"],
    },
    E: {
      name: "E조",
      teams: ["브라질", "볼리비아", "일본", "크로아티아"],
    },
    F: {
      name: "F조",
      teams: ["독일", "헝가리", "코트디부아르", "멕시코"],
    },
    G: {
      name: "G조",
      teams: ["네덜란드", "세네갈", "잉글랜드", "에콰도르"],
    },
    H: {
      name: "H조",
      teams: ["한국", "이라크", "벨기에", "콜롬비아"],
    },
    I: {
      name: "I조",
      teams: ["이탈리아", "바레인", "나이지리아", "노르웨이"],
    },
    J: {
      name: "J조",
      teams: ["스위스", "슬로바키아", "가나", "덴마크"],
    },
    K: {
      name: "K조",
      teams: ["이란", "오만", "이집트", "포르투갈"],
    },
    L: {
      name: "L조",
      teams: ["사우디아라비아", "카타르", "터키", "스페인"],
    },
  },

  // 조별리그 경기 일정 (각 조의 팀들 간 1라운드 로빈)
  // 실제 일정은 추후 확정 예정 — 현재는 더미 데이터
  matches: [], // schedule.js 에서 groups 데이터를 기반으로 생성
};

// 조별 경기 자동 생성 (각 팀이 같은 조의 다른 팀과 1번씩 경기)
// 이 패턴을 "Round Robin"이라고 부릅니다
function generateGroupMatches(groups) {
  const matches = [];
  for (const [groupKey, group] of Object.entries(groups)) {
    const teams = group.teams;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          group: groupKey,
          home: teams[i],
          away: teams[j],
          homeScore: null, // null = 미확정
          awayScore: null,
        });
      }
    }
  }
  return matches;
}

WORLD_CUP_2026.matches = generateGroupMatches(WORLD_CUP_2026.groups);
