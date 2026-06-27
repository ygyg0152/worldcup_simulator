const { fetchWithAuth } = require('./_helper');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    res.json(await fetchWithAuth('/get/teams'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
