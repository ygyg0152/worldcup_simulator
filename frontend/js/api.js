// 백엔드에서 데이터를 가져오는 모듈
const API_BASE = "http://localhost:3000/api";

// FIFA 코드 → 한국어 팀명 매핑
const TEAM_NAME_KO = {
  MEX: "멕시코", RSA: "남아프리카공화국", KOR: "대한민국", CZE: "체코",
  CAN: "캐나다", BIH: "보스니아 헤르체고비나", QAT: "카타르", SUI: "스위스",
  BRA: "브라질", MAR: "모로코", HAI: "아이티", SCO: "스코틀랜드",
  USA: "미국", PAR: "파라과이", AUS: "호주", TUR: "터키",
  GER: "독일", CUW: "퀴라소", CIV: "코트디부아르", ECU: "에콰도르",
  NED: "네덜란드", JPN: "일본", SWE: "스웨덴", TUN: "튀니지",
  BEL: "벨기에", EGY: "이집트", IRN: "이란", NZL: "뉴질랜드",
  ESP: "스페인", CPV: "카보베르데", KSA: "사우디아라비아", URU: "우루과이",
  FRA: "프랑스", SEN: "세네갈", IRQ: "이라크", NOR: "노르웨이",
  ARG: "아르헨티나", AUT: "오스트리아", ALG: "알제리", JOR: "요르단",
  POR: "포르투갈", COD: "콩고민주공화국", UZB: "우즈베키스탄", COL: "콜롬비아",
  ENG: "잉글랜드", CRO: "크로아티아", GHA: "가나", PAN: "파나마",
};

// stadium_id → local_date 기준 KST 변환 오프셋 (단위: 시간)
// 멕시코는 2023년 서머타임 폐지로 상시 CST(UTC-6)
const STADIUM_KST_OFFSET = {
  "1": 15, "2": 15, "3": 15,           // 멕시코 (CST = UTC-6)
  "4": 14, "5": 14, "6": 14,           // 미국 중부 (CDT = UTC-5)
  "7": 13, "8": 13, "9": 13,
  "10": 13, "11": 13, "12": 13,        // 미국/캐나다 동부 (EDT = UTC-4)
  "13": 16, "14": 16, "15": 16, "16": 16, // 미국/캐나다 서부 (PDT = UTC-7)
};

// local_date("MM/DD/YYYY HH:mm") + 경기장 오프셋 → KST 문자열("MM/DD HH:mm")
function toKST(localDateStr, stadiumId) {
  if (!localDateStr) return "";
  const offset = STADIUM_KST_OFFSET[String(stadiumId)] ?? 14;
  const [datePart, timePart] = localDateStr.split(" ");
  const [month, day, year] = datePart.split("/").map(Number);
  const [hours, mins] = timePart.split(":").map(Number);
  const kstMs = Date.UTC(year, month - 1, day, hours, mins) + offset * 3600000;
  const d = new Date(kstMs);
  const km = String(d.getUTCMonth() + 1).padStart(2, "0");
  const kd = String(d.getUTCDate()).padStart(2, "0");
  const kh = String(d.getUTCHours()).padStart(2, "0");
  const kmin = String(d.getUTCMinutes()).padStart(2, "0");
  return `${km}/${kd}  ${kh}:${kmin}`;
}

// 전역 데이터 저장소
let teamsMap = {};   // { "1": { name_en, flag, ... }, ... }
let groupsData = []; // 조별 순위 데이터
let matchesData = []; // 경기 목록

async function loadAllData() {
  const [teamsRes, groupsRes, matchesRes] = await Promise.all([
    fetch(`${API_BASE}/teams`).then(r => r.json()),
    fetch(`${API_BASE}/groups`).then(r => r.json()),
    fetch(`${API_BASE}/matches`).then(r => r.json()),
  ]);

  teamsRes.teams.forEach(team => {
    team.name_ko = TEAM_NAME_KO[team.fifa_code] || team.name_en;
    teamsMap[team.id] = team;
  });

  groupsData = groupsRes.groups.sort((a, b) => a.name.localeCompare(b.name));
  matchesData = matchesRes.games;
}
