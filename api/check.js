require('dotenv').config();
const { getAllPOPRegions, getDateStr } = require('../src/weather');
const { fetchDust } = require('../src/airQuality');
const { sendMessage } = require('../src/telegram');

function formatDisplayDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

async function checkToday() {
  const todayStr = getDateStr(0);
  const [allRegions, dustResult] = await Promise.all([
    getAllPOPRegions('0500', todayStr),
    fetchDust(),
  ]);

  const lines = [`[오늘 날씨·대기 알림] ${formatDisplayDate(todayStr)}`, ''];

  for (const { regionName, maxPOP } of allRegions) {
    lines.push(`📍 ${regionName}`);
    lines.push(`🌧 강수확률: ${maxPOP}%`);
    lines.push('');
  }

  lines.push(
    dustResult
      ? `🌫 미세먼지(PM10): ${dustResult.grade} (${dustResult.region})`
      : `🌫 미세먼지(PM10): 조회 실패`
  );

  await sendMessage(lines.join('\n').trim());
}

module.exports = async function handler(req, res) {
  // Vercel이 cron 호출 시 Authorization 헤더로 CRON_SECRET 전달
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await checkToday();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
