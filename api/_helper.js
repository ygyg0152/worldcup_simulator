const axios = require('axios');

async function fetchWithAuth(path) {
  const authRes = await axios.post(`${process.env.WC_API_URL}/auth/authenticate`, {
    email: process.env.WC_EMAIL,
    password: process.env.WC_PASSWORD,
  });
  const token = authRes.data.token;
  const res = await axios.get(`${process.env.WC_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

module.exports = { fetchWithAuth };
