# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요
공공데이터포털 API를 사용해 매일 오전 7시에 경기도 용인시·안성시의 기상·대기질을 조회하고, 조건 충족 시 텔레그램 봇으로 메시지를 전송하는 Node.js 스크립트.

## 실행 명령
```bash
npm install       # 최초 1회
npm start         # 스케줄러 시작 (매일 07:00 KST 자동 실행)
```

## 즉시 테스트 (스케줄 없이 바로 실행)
```bash
node -e "require('dotenv').config(); require('./index').check()"
```

## 환경변수 (.env)
| 키 | 설명 |
|----|------|
| `PUBLIC_DATA_API_KEY` | 공공데이터포털 API 인증키 |
| `TELEGRAM_BOT_TOKEN` | @BotFather에서 발급받은 봇 토큰 |
| `TELEGRAM_CHAT_ID` | `getUpdates` API로 확인한 수신자 chat_id |

## 텔레그램 봇 초기 설정 (최초 1회)
1. 텔레그램에서 `@BotFather` → `/newbot` → **Bot Token** 획득
2. 해당 봇에게 아무 메시지 전송
3. `https://api.telegram.org/bot{TOKEN}/getUpdates` 호출 → `result[0].message.chat.id` 확인
4. `.env`에 두 값 저장

## 아키텍처
- **[index.js](index.js)** — 진입점. `node-cron`으로 매일 7시 `check()` 실행
- **[src/weather.js](src/weather.js)** — 기상청 단기예보 API. 용인시·안성시 당일 최대 강수확률 조회
- **[src/airQuality.js](src/airQuality.js)** — 에어코리아 PM10 예보 API. 경기남부 등급 파싱
- **[src/telegram.js](src/telegram.js)** — Bot API로 메시지 전송

## 알림 조건
- 강수확률 ≥ 50% (도시별 당일 최고값 기준)
- 미세먼지(PM10) 경기남부 예보 등급이 `나쁨` 또는 `매우나쁨`
- 두 조건 모두 미충족 시 메시지 미전송

## 기상청 격자 좌표 (근사값)
| 지역 | nx | ny |
|------|----|----|
| 용인시 | 64 | 119 |
| 안성시 | 76 | 107 |

좌표 조정이 필요하면 [src/weather.js](src/weather.js)의 `REGIONS` 객체를 수정.
