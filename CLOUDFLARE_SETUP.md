# 🚀 Настройка Cloudflare Workers для мониторинга качества воздуха

## 📋 Пошаговая инструкция

### 1. Создание аккаунта Cloudflare
1. Перейдите на [cloudflare.com](https://cloudflare.com)
2. Зарегистрируйтесь (бесплатно)
3. Подтвердите email

### 2. Установка Wrangler CLI
```bash
npm install -g wrangler
```

### 3. Авторизация в Cloudflare
```bash
wrangler auth login
```

### 4. Создание KV Namespace
```bash
wrangler kv:namespace create "AIR_DATA"
```
Скопируйте полученный ID и вставьте в `wrangler.toml` вместо `your-kv-namespace-id`

### 5. Настройка переменных окружения
```bash
# Установка токена бота
wrangler secret put TELEGRAM_BOT_TOKEN
# Введите: 7378826222:AAFKyODYXtKrvue7wA4gF2e1HQ9XEC9TrDk

# Установка Chat ID
wrangler secret put TELEGRAM_CHAT_ID
# Введите: 225901139
```

### 6. Развертывание Worker
```bash
npm install
wrangler deploy
```

### 7. Настройка Cron Trigger
1. Перейдите в [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Выберите Workers & Pages
3. Найдите ваш worker "air-monitoring-andijan"
4. Перейдите в Triggers
5. Убедитесь что cron настроен: `5 * * * *` (каждый час на 5-й минуте)

## ✅ Преимущества Cloudflare Workers:

- **Быстрее**: Запуск за секунды, а не минуты
- **Точнее**: Cron работает с точностью до минуты
- **Надежнее**: 99.9% uptime
- **Бесплатно**: 100,000 запросов в день
- **Глобально**: Работает из любой точки мира

## 🔧 Тестирование

После развертывания можете протестировать:
```bash
# Локальный запуск
wrangler dev

# Ручной запуск scheduled функции
wrangler dev --test-scheduled
```

## 📊 Мониторинг

- Логи доступны в Cloudflare Dashboard
- Метрики использования в реальном времени
- Уведомления об ошибках

## 🆚 Сравнение с GitHub Actions:

| Параметр | GitHub Actions | Cloudflare Workers |
|----------|----------------|-------------------|
| Время запуска | 1-15 минут | 10-30 секунд |
| Точность расписания | ±15 минут | ±1 минута |
| Лимит бесплатного тарифа | 2000 мин/месяц | 100,000 запросов/день |
| Простота настройки | Средняя | Высокая |
| Надежность | Хорошая | Отличная |
