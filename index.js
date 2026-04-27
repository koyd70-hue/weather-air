require('dotenv').config();
const { getAllPOPRegions, getDateStr } = require('./src/weather');
const { fetchDust } = require('./src/airQuality');
const { sendMessage } = require('./src/telegram');

function formatDisplayDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

async function checkToday() {
  const todayStr = getDateStr(0);
  const [allRegions, dustResult] = await Promise.all([
    getAllPOPRegions(['0200', '0500'], todayStr),
    fetchDust(),
  ]);

  const lines = [`[오늘 날씨·대기 알림] ${formatDisplayDate(todayStr)}`, ''];

  if (allRegions.length === 0) {
    lines.push('🌧 날씨 정보 조회 실패');
    lines.push('');
  } else {
    for (const { regionName, maxPOP } of allRegions) {
      lines.push(`📍 ${regionName}`);
      lines.push(`🌧 강수확률: ${maxPOP}%`);
      lines.push('');
    }
  }

  lines.push(
    dustResult
      ? `🌫 미세먼지(PM10): ${dustResult.grade} (${dustResult.region})`
      : `🌫 미세먼지(PM10): 조회 실패`
  );

  await sendMessage(lines.join('\n').trim());
}

module.exports = { check: checkToday, checkToday };
