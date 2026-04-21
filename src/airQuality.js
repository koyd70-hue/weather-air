const axios = require('axios');

// 용인시·안성시는 경기남부 권역에 해당
const TARGET_REGION = '경기남부';

const BAD_GRADES = new Set(['나쁨', '매우나쁨']);

// 날짜를 YYYY-MM-DD 형식으로 반환 (offsetDays: 0=오늘, 1=내일)
function getSearchDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// informGrade 문자열에서 특정 지역 등급 추출
// 예: "서울 : 보통,경기남부 : 나쁨,충남 : 좋음" → "나쁨"
function parseGrade(informGrade, regionName) {
  if (!informGrade) return null;
  const parts = informGrade.split(',');
  for (const part of parts) {
    const [region, grade] = part.split(':').map(s => s.trim());
    if (region === regionName) return grade;
  }
  return null;
}

// 미세먼지(PM10) 예보 조회 → 경기남부 등급 반환 (실패 시 최대 3회 재시도)
// forDate: 예보 날짜 'YYYY-MM-DD'. null이면 오늘.
// 반환: { region: string, grade: string } 또는 null
async function fetchDust(forDate = null, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const result = await _fetchDustOnce(forDate);
    if (result !== null) return result;
    if (attempt < retries) {
      console.warn(`[airQuality] 재시도 ${attempt}/${retries - 1}…`);
      await new Promise(r => setTimeout(r, 3000 * attempt));
    }
  }
  return null;
}

async function _fetchDustOnce(forDate = null) {
  const today = getSearchDate(0);
  const targetDate = forDate || today;
  // searchDate는 예보 날짜(informData)를 기준으로 검색 — 내일 예보는 내일 날짜로 조회
  const searchDate = targetDate;

  // serviceKey를 URL에 직접 포함해 axios의 이중 인코딩 방지
  const url = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth?serviceKey=${process.env.PUBLIC_DATA_API_KEY}`;

  const params = {
    returnType: 'json',
    numOfRows: 50,
    pageNo: 1,
    searchDate,
    informCode: 'PM10',
  };

  try {
    const res = await axios.get(url, { params });
    const body = res.data?.response?.body;
    // 공공데이터포털 API는 items 또는 items.item 두 형태로 반환될 수 있음
    const rawItems = body?.items;
    const items = Array.isArray(rawItems)
      ? rawItems
      : Array.isArray(rawItems?.item)
        ? rawItems.item
        : null;

    if (!items || items.length === 0) {
      const resultCode = res.data?.response?.header?.resultCode;
      const resultMsg = res.data?.response?.header?.resultMsg;
      console.error(`[airQuality] 응답 데이터 없음 (code=${resultCode}, msg=${resultMsg}, totalCount=${body?.totalCount}, rawItems type=${typeof rawItems})`);
      return null;
    }

    // targetDate에 해당하는 예보 항목 선택 (항상 informData로 정확히 매칭)
    const item = items.find(i => i.informData === targetDate);

    if (!item) {
      // targetDate 항목이 없으면 가장 최신 항목으로 폴백
      const fallback = items[0];
      console.warn(`[airQuality] ${targetDate} 예보 없음 — 최신 항목(${fallback?.informData}) 사용`);
      if (!fallback) {
        console.error('[airQuality] 사용 가능한 예보 데이터 없음');
        return null;
      }
      const fallbackGrade = parseGrade(fallback.informGrade, TARGET_REGION);
      if (!fallbackGrade) {
        console.error(`[airQuality] ${TARGET_REGION} 등급 파싱 실패`);
        return null;
      }
      return { region: TARGET_REGION, grade: fallbackGrade };
    }

    const grade = parseGrade(item.informGrade, TARGET_REGION);

    if (!grade) {
      console.error(`[airQuality] ${TARGET_REGION} 등급 파싱 실패`);
      return null;
    }

    return { region: TARGET_REGION, grade };
  } catch (err) {
    console.error('[airQuality] 조회 실패:', err.message);
    return null;
  }
}

// 나쁨 이상 여부 확인
function isBadOrWorse(grade) {
  return BAD_GRADES.has(grade);
}

module.exports = { fetchDust, isBadOrWorse, parseGrade };
