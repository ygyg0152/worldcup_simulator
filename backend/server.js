const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.WC_API_URL;

app.use(cors());
app.use(express.json());

// 서버가 시작될 때 자동으로 로그인해서 토큰을 받아두는 변수
let token = null;

async function login() {
  try {
    const res = await axios.post(`${API_URL}/auth/authenticate`, {
      email: process.env.WC_EMAIL,
      password: process.env.WC_PASSWORD,
    });
    token = res.data.token;
    console.log("API 로그인 성공");
  } catch (err) {
    console.error("API 로그인 실패:", err.message);
  }
}

// 토큰을 헤더에 담아서 API 요청하는 함수
function apiRequest(path) {
  return axios.get(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// 캐시 저장소: 각 경로별로 { data, savedAt } 보관
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5분 (밀리초)

async function cachedRequest(path) {
  const now = Date.now();
  const hit = cache[path];

  // 캐시가 있고 아직 5분 안 지났으면 바로 반환
  if (hit && now - hit.savedAt < CACHE_TTL) {
    console.log(`캐시 사용: ${path}`);
    return hit.data;
  }

  // 없거나 만료됐으면 외부 API 호출 후 저장
  console.log(`외부 API 호출: ${path}`);
  const response = await apiRequest(path);
  cache[path] = { data: response.data, savedAt: now };
  return response.data;
}

// 서버 동작 확인용
app.get("/api/ping", (req, res) => {
  res.json({ message: "서버 정상 동작 중" });
});

// 전체 조 목록 + 순위
app.get("/api/groups", async (req, res) => {
  try {
    res.json(await cachedRequest("/get/groups"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 전체 경기 목록
app.get("/api/matches", async (req, res) => {
  try {
    res.json(await cachedRequest("/get/games"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 전체 팀 목록 (국기 포함)
app.get("/api/teams", async (req, res) => {
  try {
    res.json(await cachedRequest("/get/teams"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 전체 경기장 목록
app.get("/api/stadiums", async (req, res) => {
  try {
    res.json(await cachedRequest("/get/stadiums"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 서버 시작 시 자동 로그인 후 서버 열기
login().then(() => {
  app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
  });
});
