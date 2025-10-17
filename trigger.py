#!/usr/bin/env python3
"""
Скрипт для запуска GitHub Actions через API
"""

import requests
import os
import time
from datetime import datetime

# GitHub настройки
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
GITHUB_REPO = "velrabe/air-monitoring-andijan"
WORKFLOW_FILE = "monitor.yml"

def trigger_workflow():
    """Запускает GitHub Actions workflow через API"""
    if not GITHUB_TOKEN:
        print("❌ GITHUB_TOKEN не настроен!")
        return False
    
    url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/workflows/{WORKFLOW_FILE}/dispatches"
    
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json"
    }
    
    data = {
        "ref": "main"
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 204:
            print("✅ Workflow запущен через API")
            return True
        else:
            print(f"❌ Ошибка API: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def main():
    """Основная функция"""
    print(f"🚀 Запуск через API: {datetime.now()}")
    
    # Импортируем и запускаем мониторинг
    try:
        import monitor
        monitor.main()
    except Exception as e:
        print(f"❌ Ошибка мониторинга: {e}")
        return
    
    # Запускаем workflow через API
    trigger_workflow()

if __name__ == "__main__":
    main()
