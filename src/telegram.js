const axios = require('axios');

async function sendMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    await axios.get(url, {
      params: { chat_id: chatId, text },
    });
    console.log('[telegram] 메시지 전송 완료');
  } catch (err) {
    console.error('[telegram] 전송 실패:', err.message);
  }
}

module.exports = { sendMessage };
