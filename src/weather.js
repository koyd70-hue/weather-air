const axios = require('axios');

// 기상청 단기예보 격자 좌표
const REGIONS = {
  '용인시': { nx: 64, ny: 119 },
  '안성시': { nx: 76, ny: 107 },
};

// offsetDays 후 날짜를 YYYYMMDD 형식으로 반환 (KST 기준)
function getDateStr(offsetDays = 0) {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() + offsetDays);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

// 지역별 최대 강수확률(%) 조회
// baseTime: API 발표 시각 (예: '0500', '1700')
// fcstDate: 예보 날짜 YYYYMMDD
async function fetchPOP(regionName, baseTime, fcstDate) {
  const { nx, ny } = REGIONS[regionName];
  const baseDate = getDateStr(0); // 오늘 발표 기준

  const params = {
    serviceKey: process.env.PUBLIC_DATA_API_KEY,
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx,
    ny,
    numOfRows: 1000,
    pageNo: 1,
  };

  const url = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';

  try {
    const res = await axios.get(url, { params });
    const items = res.data?.response?.body?.items?.item;

    if (!items || !Array.isArray(items)) {
      console.error(`[weather] ${regionName}: 응답 데이터 없음`);
      return null;
    }

    const popValues = items
      .filter(item => item.category === 'POP' && item.fcstDate === fcstDate)
      .map(item => parseInt(item.fcstValue, 10))
      .filter(v => !isNaN(v));

    if (popValues.length === 0) return null;

    return { regionName, maxPOP: Math.max(...popValues) };
  } catch (err) {
    console.error(`[weather] ${regionName} 조회 실패:`, err.message);
    return null;
  }
}

// 모든 지역 POP 조회 → 전체 반환
// baseTime: 단일 문자열 또는 우선순위 배열 (앞에서부터 시도, 첫 성공 시 반환)
async function getAllPOPRegions(baseTime, fcstDate) {
  const baseTimeList = Array.isArray(baseTime) ? baseTime : [baseTime];

  for (const bt of baseTimeList) {
    const results = await Promise.all(Object.keys(REGIONS).map(r => fetchPOP(r, bt, fcstDate)));
    const valid = results.filter(r => r !== null);
    if (valid.length > 0) return valid;
    if (baseTimeList.length > 1) console.warn(`[weather] base_time ${bt} 결과 없음 — 다음 발표본 시도`);
  }
  return [];
}

module.exports = { fetchPOP, getAllPOPRegions, getDateStr };
