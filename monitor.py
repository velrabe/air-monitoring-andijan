#!/usr/bin/env python3
"""
Скрипт для мониторинга качества воздуха в Андижане
Отслеживает показатели PM 2.5 и PM 10 с сайта monitoring.meteo.uz
"""

import os
import json
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import sys

# URL страницы для мониторинга
MONITORING_URL = "https://monitoring.meteo.uz/ru/map/view/724"

# Telegram настройки
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.environ.get('TELEGRAM_CHAT_ID', '')

# Файл для хранения предыдущих значений
DATA_FILE = "previous_data.json"


def fetch_air_quality_data():
    """Получает данные о качестве воздуха с сайта"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(MONITORING_URL, headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Ищем данные PM 2.5 и PM 10
        data = {}
        
        # Парсим все элементы с концентрациями
        concentrations = soup.find_all('li')
        
        for item in concentrations:
            text = item.get_text(strip=True)
            
            if 'PM 2.5:' in text:
                # Извлекаем значение PM 2.5
                value = text.split('PM 2.5:')[1].strip().split('µg/m³')[0].strip()
                data['PM25'] = float(value)
            
            elif 'PM 10:' in text:
                # Извлекаем значение PM 10
                value = text.split('PM 10:')[1].strip().split('µg/m³')[0].strip()
                data['PM10'] = float(value)
        
        # Извлекаем дату и время обновления
        date_elem = soup.find(text=lambda t: t and 'Обновлено:' in t)
        if date_elem:
            data['timestamp'] = date_elem.split('Обновлено:')[1].strip()
        else:
            data['timestamp'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        if 'PM25' in data and 'PM10' in data:
            return data
        else:
            print("⚠️ Не удалось найти все необходимые данные на странице")
            return None
            
    except Exception as e:
        print(f"❌ Ошибка при получении данных: {e}")
        return None


def load_previous_data():
    """Загружает предыдущие данные из файла"""
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Ошибка при чтении предыдущих данных: {e}")
    return None


def save_data(data):
    """Сохраняет текущие данные в файл"""
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Ошибка при сохранении данных: {e}")


def send_telegram_message(message):
    """Отправляет сообщение в Telegram"""
    if not TELEGRAM_BOT_TOKEN:
        print("❌ TELEGRAM_BOT_TOKEN не настроен!")
        return False
    
    if not TELEGRAM_CHAT_ID:
        print("⚠️ TELEGRAM_CHAT_ID не настроен. Сообщение не отправлено.")
        print(f"Сообщение: {message}")
        return False
    
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            'chat_id': TELEGRAM_CHAT_ID,
            'text': message,
            'parse_mode': 'HTML'
        }
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        print("✅ Сообщение отправлено в Telegram")
        return True
    except Exception as e:
        print(f"❌ Ошибка при отправке в Telegram: {e}")
        return False


def get_air_quality_level(pm25, pm10):
    """Определяет уровень качества воздуха"""
    # Основываясь на стандартах AQI
    if pm25 <= 12 and pm10 <= 54:
        return "🟢 Хорошо", "Качество воздуха хорошее"
    elif pm25 <= 35.4 and pm10 <= 154:
        return "🟡 Умеренно", "Приемлемое качество воздуха"
    elif pm25 <= 55.4 and pm10 <= 254:
        return "🟠 Вредно для чувствительных групп", "Чувствительные люди могут испытывать проблемы"
    elif pm25 <= 150.4 and pm10 <= 354:
        return "🔴 Вредно", "Все могут начать испытывать проблемы со здоровьем"
    elif pm25 <= 250.4 and pm10 <= 424:
        return "🟣 Очень вредно", "Предупреждение о вреде здоровью"
    else:
        return "🟤 Опасно", "Чрезвычайная ситуация для здоровья"


def format_message(current_data, previous_data=None):
    """Форматирует сообщение для отправки"""
    pm25 = current_data['PM25']
    pm10 = current_data['PM10']
    
    quality_level, quality_desc = get_air_quality_level(pm25, pm10)
    
    # Получаем эмодзи изменений
    pm25_emoji = get_change_emoji(pm25, previous_data.get('PM25') if previous_data else None)
    pm10_emoji = get_change_emoji(pm10, previous_data.get('PM10') if previous_data else None)
    
    # Форматируем время
    timestamp_formatted = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    
    message = f"PM 2.5: {pm25:.3f}{pm25_emoji} | PM 10: {pm10:.3f}{pm10_emoji}\n\n"
    message += f"{quality_level} {quality_desc}\n"
    message += f"Обновлено: {timestamp_formatted}"
    
    return message


def get_change_emoji(current_value, previous_value):
    """Возвращает эмодзи изменения (вверх, вниз, без изменений)"""
    if previous_value is None:
        return ""
    
    if current_value > previous_value:
        return " 🔼"
    elif current_value < previous_value:
        return " 🔽"
    else:
        return " ⏺️"


def main():
    """Основная функция"""
    print(f"🚀 Запуск мониторинга: {datetime.now()}")
    
    # Получаем текущие данные
    current_data = fetch_air_quality_data()
    
    if not current_data:
        print("❌ Не удалось получить данные")
        sys.exit(1)
    
    print(f"📊 Получены данные: PM 2.5 = {current_data['PM25']}, PM 10 = {current_data['PM10']}")
    
    # Загружаем предыдущие данные
    previous_data = load_previous_data()
    
    # Проверяем, изменились ли данные
    data_changed = False
    
    if previous_data:
        if (abs(current_data['PM25'] - previous_data.get('PM25', 0)) > 5.0 or 
            abs(current_data['PM10'] - previous_data.get('PM10', 0)) > 5.0):
            data_changed = True
            print("🔄 Обнаружены изменения в данных")
        else:
            print("✓ Данные не изменились")
    else:
        data_changed = True
        print("📝 Первый запуск - сохраняем начальные данные")
    
    # Отправляем уведомление, если данные изменились
    if data_changed:
        message = format_message(current_data, previous_data)
        send_telegram_message(message)
    
    # Сохраняем текущие данные
    save_data(current_data)
    
    print("✅ Мониторинг завершен")


if __name__ == "__main__":
    main()

