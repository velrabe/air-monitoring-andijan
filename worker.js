// Cloudflare Worker для мониторинга качества воздуха в Андижане
const MONITORING_URL = "https://monitoring.meteo.uz/ru/map/view/724";

// Функция для получения данных о качестве воздуха
async function fetchAirQualityData() {
  try {
    const response = await fetch(MONITORING_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // Парсим данные PM 2.5 и PM 10 из HTML
    // Ищем значения после PM 2.5: и PM 10:
    const pm25Match = html.match(/PM 2\.5:.*?(\d+\.?\d*)/);
    const pm10Match = html.match(/PM 10:.*?(\d+\.?\d*)/);
    
    if (!pm25Match || !pm10Match) {
      console.log('HTML content preview:', html.substring(0, 1000));
      throw new Error('Не удалось найти данные PM 2.5 или PM 10');
    }
    
    const pm25 = parseFloat(pm25Match[1]);
    const pm10 = parseFloat(pm10Match[1]);
    
    return {
      PM25: pm25,
      PM10: pm10,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Ошибка при получении данных:', error);
    return null;
  }
}

// Функция для определения уровня качества воздуха
function getAirQualityLevel(pm25, pm10) {
  if (pm25 <= 12 && pm10 <= 54) {
    return ["Хорошо", "🟢"];
  } else if (pm25 <= 35.4 && pm10 <= 154) {
    return ["Умеренно", "🟡"];
  } else if (pm25 <= 55.4 && pm10 <= 254) {
    return ["Вредно для чувствительных", "🟠"];
  } else if (pm25 <= 150.4 && pm10 <= 354) {
    return ["Вредно", "🔴"];
  } else if (pm25 <= 250.4 && pm10 <= 424) {
    return ["Очень вредно", "🟣"];
  } else {
    return ["Опасно", "🟤"];
  }
}

// Функция для получения эмодзи изменений
function getChangeEmoji(current, previous) {
  if (previous === null || previous === undefined) {
    return "";
  }
  
  if (current > previous) {
    return " 🔼";
  } else if (current < previous) {
    return " 🔽";
  } else {
    return " ⏺️";
  }
}

// Функция для отправки сообщения в Telegram
async function sendTelegramMessage(message, botToken, chatId) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка при отправке в Telegram:', error);
    return false;
  }
}

// Функция для форматирования сообщения
function formatMessage(currentData, previousData) {
  const pm25 = currentData.PM25;
  const pm10 = currentData.PM10;
  
  const [qualityLevel, qualityEmoji] = getAirQualityLevel(pm25, pm10);
  
  const pm25Emoji = getChangeEmoji(pm25, previousData?.PM25);
  const pm10Emoji = getChangeEmoji(pm10, previousData?.PM10);
  
  const timestamp = new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  return `PM 2.5: ${pm25.toFixed(3)}${pm25Emoji} | PM 10: ${pm10.toFixed(3)}${pm10Emoji}

${qualityLevel} ${qualityEmoji}
Обновлено: ${timestamp}`;
}

// Основная функция Worker
export default {
  async scheduled(event, env, ctx) {
    // Получаем данные
    const currentData = await fetchAirQualityData();
    if (!currentData) {
      console.log('Не удалось получить данные');
      return;
    }
    
    // Загружаем предыдущие данные из KV
    const previousData = await env.AIR_DATA.get('previous', 'json');
    
    // Проверяем изменения (порог 5.0)
    const threshold = 5.0;
    let shouldNotify = false;
    
    if (!previousData) {
      // Первый запуск
      shouldNotify = true;
      console.log('Первый запуск - отправляем уведомление');
    } else {
      const pm25Changed = Math.abs(currentData.PM25 - previousData.PM25) > threshold;
      const pm10Changed = Math.abs(currentData.PM10 - previousData.PM10) > threshold;
      
      if (pm25Changed || pm10Changed) {
        shouldNotify = true;
        console.log('Обнаружены значительные изменения - отправляем уведомление');
      } else {
        console.log('Изменения незначительные - уведомление не отправляем');
      }
    }
    
    // Отправляем уведомление если нужно
    if (shouldNotify) {
      const message = formatMessage(currentData, previousData);
      const success = await sendTelegramMessage(
        message, 
        env.TELEGRAM_BOT_TOKEN, 
        env.TELEGRAM_CHAT_ID
      );
      
      if (success) {
        console.log('Уведомление отправлено успешно');
      } else {
        console.log('Ошибка при отправке уведомления');
      }
    }
    
    // Сохраняем текущие данные
    await env.AIR_DATA.put('previous', JSON.stringify(currentData));
    console.log('Данные сохранены');
  }
};
