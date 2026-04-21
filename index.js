require('dotenv').config();
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { getAllPOPRegions, getDateStr } = require('./src/weather');
const { fetchDust } = require('./src/airQuality');
const { sendMessage } = require('./src/telegram');

function formatDisplayDate(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

// 중복 전송 방지용 — 날짜별 잠금 파일 (원자적 배타 생성으로 경쟁 조건 방어)
function acquireLock(key) {
  const lockPath = path.join(__dirname, `.lock_${key}`);
  try {
    fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
    return true; // 잠금 획득 성공
  } catch {
    return false; // 이미 다른 프로세스가 선점
  }
}

// 오전 8시: 오늘 날씨·대기질
async function checkToday() {
  const todayKey = `today_${getDateStr(0)}`;
  if (!acquireLock(todayKey)) {
    console.log(`[checkToday] ${todayKey} 이미 전송됨 — 건너뜀`);
    return;
  }

  console.log(`[${new Date().toLocaleString('ko-KR')}] 오늘 날씨·대기질 조회 시작`);

  const todayStr = getDateStr(0); // YYYYMMDD
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

// 오후 7시: 내일 날씨·대기질 예보
async function checkTomorrow() {
  const tomorrowKey = `tomorrow_${getDateStr(1)}`;
  if (!acquireLock(tomorrowKey)) {
    console.log(`[checkTomorrow] ${tomorrowKey} 이미 전송됨 — 건너뜀`);
    return;
  }

  console.log(`[${new Date().toLocaleString('ko-KR')}] 내일 날씨·대기질 조회 시작`);

  const tomorrowStr = getDateStr(1); // YYYYMMDD
  // 오후 5시(1700) 발표본이 내일 예보까지 포함
  const tomorrowDash = `${tomorrowStr.slice(0, 4)}-${tomorrowStr.slice(4, 6)}-${tomorrowStr.slice(6, 8)}`;

  const [allRegions, dustResult] = await Promise.all([
    getAllPOPRegions(['1700', '1400', '1100'], tomorrowStr),
    fetchDust(tomorrowDash),
  ]);

  const lines = [`[내일 날씨·대기 예보] ${formatDisplayDate(tomorrowStr)}`, ''];

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

// 매일 오전 8시: 오늘 예보
cron.schedule('0 8 * * *', checkToday, { timezone: 'Asia/Seoul' });

console.log('스케줄러 시작 — 오전 8시(오늘 예보) KST');

module.exports = { check: checkToday, checkToday, checkTomorrow };
