# Stage 2: Критические исправления безопасности и архитектуры

*Дата создания: 4 сентября 2025*  
*Версия: v0.52*  
*Принцип: Исправить критические проблемы, улучшить безопасность*

---

## 🚨 **КРИТИЧЕСКОЕ ПРАВИЛО ДЛЯ ВСЕХ ЭТАПОВ**

### **🚫 ЗАПРЕЩЕНО:**
- ❌ **ПРИДУМЫВАТЬ НОВЫЕ ФУНКЦИИ**
- ❌ **ДОБАВЛЯТЬ НОВЫЕ КНОПКИ ИЛИ UI ЭЛЕМЕНТЫ**
- ❌ **СОЗДАВАТЬ НОВУЮ ФУНКЦИОНАЛЬНОСТЬ**
- ❌ **ДОБАВЛЯТЬ НОВЫЕ ВОЗМОЖНОСТИ**

### **✅ РАЗРЕШЕНО:**
- ✅ **ТОЛЬКО РЕФАКТОРИНГ СУЩЕСТВУЮЩЕГО КОДА**
- ✅ **ОЧИСТКА АРХИТЕКТУРЫ**
- ✅ **ИСПРАВЛЕНИЕ БЕЗОПАСНОСТИ**
- ✅ **УЛУЧШЕНИЕ СТРУКТУРЫ КОДА**
- ✅ **УДАЛЕНИЕ ДУБЛИРОВАНИЯ**
- ✅ **УПРОЩЕНИЕ СЛОЖНОЙ ЛОГИКИ**

### **🎯 ЦЕЛЬ:**
**МЫ ЗАНИМАЕМСЯ ТОЛЬКО РЕФАКТОРИНГОМ И ОЧИСТКОЙ АРХИТЕКТУРЫ КОДА!**

---

## 🚨 **КРИТИЧЕСКИЕ ПРОБЛЕМЫ, ТРЕБУЮЩИЕ НЕМЕДЛЕННОГО ИСПРАВЛЕНИЯ**

### **1. УЯЗВИМОСТЬ API КЛЮЧЕЙ (КРИТИЧНО!)**
```typescript
// ПРОБЛЕМА: vite.config.js:60-70
'process.env.DEEPGRAM_API_KEY': JSON.stringify(process.env.DEEPGRAM_API_KEY || ''),
'process.env.CLAUDE_API_KEY': JSON.stringify(process.env.CLAUDE_API_KEY || ''),
```
- **Риск**: API ключи попадают в bundle и могут быть украдены
- **Статус**: ❌ НЕ ИСПРАВЛЕНО
- **Приоритет**: 🔥 КРИТИЧНО

### **2. НЕБЕЗОПАСНЫЕ Electron настройки (КРИТИЧНО!)**
```typescript
// ПРОБЛЕМА: src/main/main.ts:30-35
webPreferences: {
  nodeIntegration: true,        // ❌ ОПАСНО!
  contextIsolation: false,      // ❌ ОПАСНО!
  webSecurity: false            // ❌ ОПАСНО!
}
```
- **Риск**: Полный доступ к Node.js API из renderer процесса
- **Статус**: ❌ НЕ ИСПРАВЛЕНО
- **Приоритет**: 🔥 КРИТИЧНО

---

## 🎯 **ЦЕЛИ STAGE 2**

### **🔥 КРИТИЧЕСКИЕ ЦЕЛИ (сделать СЕЙЧАС):**
1. **Исправить безопасность Electron** - защитить от вредоносного кода
2. **Скрыть API ключи** - перенести в preload script
3. **Включить contextIsolation** - изолировать процессы

### **⚡ ВАЖНЫЕ ЦЕЛИ (сделать в ближайшее время):**
4. **Разбить монолитный App.tsx** - улучшить архитектуру
5. **Унифицировать конфигурацию** - убрать дублирование
6. **Реализовать реальные адаптеры** - завершить архитектуру

---

## 🏗️ **ПЛАН РЕАЛИЗАЦИИ**

### **ЭТАП 1: БЕЗОПАСНОСТЬ ELECTRON (КРИТИЧНО!)**

> **🚨 НАПОМИНАНИЕ:** ТОЛЬКО РЕФАКТОРИНГ! НИКАКИХ НОВЫХ ФУНКЦИЙ!

**Цель:** Пошагово внедрить безопасность без потери функциональности

**Принцип:** После каждого шага **СРАЗУ тестируем** - окно данных должно работать, транскрипция должна работать!

---

#### **ШАГ 1.1: ОТКЛЮЧЕНИЕ NODE.JS ИНТЕГРАЦИИ (БЕЗОПАСНОСТЬ)**

**Что изменить:**
```typescript
// src/main/main.ts - ИЗМЕНЕНИЕ 1
webPreferences: {
  nodeIntegration: false,       // ✅ БЕЗОПАСНО (было true)
  contextIsolation: false,      // ❌ ОСТАВЛЯЕМ ПОКА (будет в шаге 1.2)
  webSecurity: false,           // ❌ ОСТАВЛЯЕМ ПОКА (будет в шаге 1.3)
  // preload: пока НЕ добавляем
}
```

**Тестирование после шага:**
1. ✅ Приложение запускается
2. ✅ Окно данных создается при нажатии "Start"
3. ✅ Транскрипция работает
4. ✅ Логи пишутся в MMD

**Если что-то сломалось:** Откатываемся к `nodeIntegration: true`

---

#### **ШАГ 1.2: ВКЛЮЧЕНИЕ CONTEXT ISOLATION (БЕЗОПАСНОСТЬ)**

**Что изменить:**
```typescript
// src/main/main.ts - ИЗМЕНЕНИЕ 2
webPreferences: {
  nodeIntegration: false,       // ✅ БЕЗОПАСНО
  contextIsolation: true,       // ✅ БЕЗОПАСНО (было false)
  webSecurity: false,           // ❌ ОСТАВЛЯЕМ ПОКА (будет в шаге 1.3)
  // preload: пока НЕ добавляем
}
```

**Тестирование после шага:**
1. ✅ Приложение запускается
2. ✅ Окно данных создается при нажатии "Start"
3. ✅ Транскрипция работает
4. ✅ Логи пишутся в MMD

**Если что-то сломалось:** Откатываемся к `contextIsolation: false`

---

#### **ШАГ 1.3: ВКЛЮЧЕНИЕ WEB SECURITY (БЕЗОПАСНОСТЬ)**

**Что изменить:**
```typescript
// src/main/main.ts - ИЗМЕНЕНИЕ 3
webPreferences: {
  nodeIntegration: false,       // ✅ БЕЗОПАСНО
  contextIsolation: true,       // ✅ БЕЗОПАСНО
  webSecurity: true,            // ✅ БЕЗОПАСНО (было false)
  // preload: пока НЕ добавляем
}
```

**Тестирование после шага:**
1. ✅ Приложение запускается
2. ✅ Окно данных создается при нажатии "Start"
3. ✅ Транскрипция работает
4. ✅ Логи пишутся в MMD

**Если что-то сломалось:** Откатываемся к `webSecurity: false`

---

#### **ШАГ 1.4: СОЗДАНИЕ PRELOAD SCRIPT (БЕЗОПАСНОСТЬ)**

**Что создать:**
```typescript
// src/preload/preload.ts - НОВЫЙ ФАЙЛ
import { contextBridge, ipcRenderer } from 'electron';

// Безопасный API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  // Только безопасные методы
  getConfig: () => ipcRenderer.invoke('get-config'),
  sendTranscript: (data: any) => ipcRenderer.invoke('send-transcript', data),
  // НЕ экспортируем API ключи!
});
```

**Что изменить:**
```typescript
// src/main/main.ts - ИЗМЕНЕНИЕ 4
webPreferences: {
  nodeIntegration: false,       // ✅ БЕЗОПАСНО
  contextIsolation: true,       // ✅ БЕЗОПАСНО
  webSecurity: true,            // ✅ БЕЗОПАСНО
  preload: path.join(__dirname, 'preload.js') // ✅ PRELOAD
}
```

**Тестирование после шага:**
1. ✅ Приложение запускается
2. ✅ Окно данных создается при нажатии "Start"
3. ✅ Транскрипция работает
4. ✅ Логи пишутся в MMD

**Если что-то сломалось:** Откатываемся к удалению preload

---

#### **ШАГ 1.5: СОЗДАНИЕ БЕЗОПАСНЫХ IPC HANDLERS (БЕЗОПАСНОСТЬ)**

**Что создать:**
```typescript
// src/main/ipc-handlers.ts - НОВЫЙ ФАЙЛ
ipcMain.handle('get-config', () => {
  // Возвращаем только безопасную конфигурацию
  return {
    audio: configService.getAudioConfig(),
    ui: configService.getUIConfig(),
    // НЕ возвращаем API ключи!
  };
});
```

**Тестирование после шага:**
1. ✅ Приложение запускается
2. ✅ Окно данных создается при нажатии "Start"
3. ✅ Транскрипция работает
4. ✅ Логи пишутся в MMD

**Если что-то сломалось:** Откатываемся к удалению ipc-handlers

---

#### **ШАГ 1.6: ОБНОВЛЕНИЕ App.tsx (БЕЗОПАСНОСТЬ)**

**Что заменить:**
```typescript
// src/App.tsx - ИЗМЕНЕНИЕ 5
// window.require('electron') → window.electronAPI
// Все IPC вызовы теперь через безопасный API
```

**Тестирование после шага:**
1. ✅ Приложение запускается
2. ✅ Окно данных создается при нажатии "Start"
3. ✅ Транскрипция работает
4. ✅ Логи пишутся в MMD

**Если что-то сломалось:** Откатываемся к `window.require('electron')`

---

## **🎯 ПЛАН ТЕСТИРОВАНИЯ КАЖДОГО ШАГА:**

**После КАЖДОГО шага проверяем:**
1. **Запуск приложения** - `npm run dev` работает
2. **Окно данных** - нажимаем "Start", окно открывается
3. **Транскрипция** - говорим, текст распознается
4. **Логи MMD** - файлы создаются в transcript-logs/

**Если что-то сломалось:**
- ❌ **НЕ переходим к следующему шагу**
- ❌ **НЕ пытаемся исправить**
- ✅ **СРАЗУ откатываемся** к предыдущему рабочему состоянию
- ✅ **Анализируем проблему** и корректируем план

**Цель:** Каждый шаг должен быть **полностью рабочим** перед переходом к следующему!

---

#### **1.1 Создание preload script**
```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Безопасный API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  // Только безопасные методы
  getConfig: () => ipcRenderer.invoke('get-config'),
  sendTranscript: (data: any) => ipcRenderer.invoke('send-transcript', data),
  // НЕ экспортируем API ключи!
});
```

#### **1.2 Исправление main.ts**
```typescript
// src/main/main.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
webPreferences: {
  nodeIntegration: false,       // ✅ БЕЗОПАСНО
  contextIsolation: true,       // ✅ БЕЗОПАСНО
  webSecurity: true,            // ✅ БЕЗОПАСНО
  preload: path.join(__dirname, 'preload.js') // ✅ PRELOAD
}
```

#### **1.3 Создание IPC handlers**
```typescript
// src/main/ipc-handlers.ts
ipcMain.handle('get-config', () => {
  // Возвращаем только безопасную конфигурацию
  return {
    audio: configService.getAudioConfig(),
    ui: configService.getUIConfig(),
    // НЕ возвращаем API ключи!
  };
});
```

### **ЭТАП 2: РАЗБИЕНИЕ App.tsx**

#### **2.1 Создание хуков**
```typescript
// src/hooks/useTranscription.ts
export const useTranscription = () => {
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  
  const startRecording = useCallback(async () => {
    // Вся логика записи
  }, []);
  
  const stopRecording = useCallback(() => {
    // Вся логика остановки
  }, []);
  
  return {
    transcript,
    partialTranscript,
    startRecording,
    stopRecording
  };
};
```

#### **2.2 Создание компонентов**
```typescript
// src/components/ControlPanel.tsx
export const ControlPanel = () => {
  const transcription = useTranscription();
  const audioRecording = useAudioRecording();
  
  return (
    <div className="control-panel">
      {/* UI логика */}
    </div>
  );
};
```

#### **2.3 Упрощение App.tsx**
```typescript
// src/App.tsx - УПРОЩЕННАЯ ВЕРСИЯ
export function App() {
  const windowType = useWindowType();
  
  if (windowType === 'data') {
    return <DataWindow />;
  }
  
  return <ControlPanel />;
}
```

### **ЭТАП 3: УНИФИКАЦИЯ КОНФИГУРАЦИИ**

#### **3.1 Единый ConfigService**
```typescript
// src/services/config/ConfigService.ts
class ConfigService {
  private config: AppConfig;
  
  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }
  
  // Единые методы для всех настроек
  getDeepgramConfig(): DeepgramConfig { /* ... */ }
  getClaudeConfig(): ClaudeConfig { /* ... */ }
  getAudioConfig(): AudioConfig { /* ... */ }
}
```

#### **3.2 Убрать дублирование из vite.config.js**
```typescript
// vite.config.js - УПРОЩЕННАЯ ВЕРСИЯ
export default defineConfig({
  plugins: [react()],
  // УБИРАЕМ все process.env - они будут в preload
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __NODE_ENV__: JSON.stringify(process.env.NODE_ENV || 'development')
  }
});
```

### **ЭТАП 4: РЕАЛИЗАЦИЯ АДАПТЕРОВ**

#### **4.1 Исправление DeepgramAdapter**
```typescript
// src/services/transcription/DeepgramAdapter.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
export class DeepgramAdapter implements ITranscriptionService {
  private deepgramService: DeepgramService;
  private onTranscriptCallback?: (event: TranscriptEvent) => void;
  private onErrorCallback?: (error: string) => void;

  constructor(deepgramService: DeepgramService) {
    this.deepgramService = deepgramService;
  }

  onTranscript(callback: (event: TranscriptEvent) => void): void {
    this.onTranscriptCallback = callback;
    // Подписываемся на события DeepgramService
    this.deepgramService.onTranscript(callback);
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
    // Подписываемся на ошибки DeepgramService
    this.deepgramService.onError(callback);
  }
}
```

#### **4.2 Добавление методов в DeepgramService**
```typescript
// src/services/deepgram.ts - ДОБАВЛЯЕМ МЕТОДЫ
export class DeepgramService {
  private onTranscriptCallback?: (event: TranscriptEvent) => void;
  private onErrorCallback?: (error: string) => void;

  onTranscript(callback: (event: TranscriptEvent) => void): void {
    this.onTranscriptCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  // Используем callbacks в обработчиках
  private handleTranscript(event: TranscriptEvent): void {
    if (this.onTranscriptCallback) {
      this.onTranscriptCallback(event);
    }
  }
}
```

---

## 🚀 **ПОШАГОВЫЙ ПЛАН ВЫПОЛНЕНИЯ**

### **ШАГ 1: Безопасность (КРИТИЧНО!)**
1. Создать `src/preload/preload.ts`
2. Исправить `src/main/main.ts`
3. Создать `src/main/ipc-handlers.ts`
4. **СРАЗУ протестировать** - приложение должно запуститься

### **ШАГ 2: Разбиение App.tsx**
1. Создать `src/hooks/useTranscription.ts`
2. Создать `src/hooks/useAudioRecording.ts`
3. Создать `src/components/ControlPanel.tsx`
4. Создать `src/components/DataWindow.tsx`
5. Упростить `src/App.tsx`
6. **СРАЗУ протестировать** - функциональность должна работать

### **ШАГ 3: Унификация конфигурации**
1. Упростить `vite.config.js`
2. Обновить `src/services/config.ts`
3. **СРАЗУ протестировать** - настройки должны работать

### **ШАГ 4: Реализация адаптеров**
1. Исправить `DeepgramAdapter.ts`
2. Добавить методы в `DeepgramService.ts`
3. **СРАЗУ протестировать** - транскрипция должна работать

---

## 🧪 **ПРАВИЛА ТЕСТИРОВАНИЯ**

!!!НИКАКИХ МОКОВ И ДЕМО ДАННЫХ!!! ТОЛЬКО ВСЕ РЕАЛЬНОЕ И БОЕВОЕ

### **После КАЖДОГО шага:**
1. **Запустить проект** - `npm run dev`
2. **Проверить запуск** - приложение должно открыться
3. **Проверить базовую функциональность** - кнопки, интерфейс
4. **При проблемах - СРАЗУ откат**

### **Критерии успеха:**
- ✅ Проект запускается без ошибок
- ✅ Интерфейс отображается корректно
- ✅ Базовые функции работают
- ✅ Нет ошибок в консоли
- ✅ **Безопасность улучшена**

---

## 📋 **ЧЕКЛИСТ БЕЗОПАСНОСТИ**

### **Перед каждым изменением:**
- [ ] Сделать git commit текущего состояния
- [ ] Убедиться что проект работает
- [ ] Подготовить план отката

### **После каждого изменения:**
- [ ] Запустить проект
- [ ] Проверить базовую функциональность
- [ ] При проблемах - откат
- [ ] При успехе - commit изменений

### **Никогда не делаем:**
- ❌ Большие изменения за раз
- ❌ Изменения без тестирования
- ❌ Продолжение при ошибках
- ❌ Изменения в нескольких файлах одновременно

---

## 🎯 **ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ**

### **После Stage 2:**
- ✅ **Безопасность**: API ключи скрыты, Electron защищен
- ✅ **Архитектура**: App.tsx разбит на компоненты
- ✅ **Конфигурация**: Единый источник истины
- ✅ **Адаптеры**: Полностью реализованы
- ✅ **Надежность**: Обработка ошибок улучшена

### **Метрики улучшения:**
- **App.tsx**: 604 → ~100 строк
- **Безопасность**: 0% → 90%
- **Архитектура**: 30% → 80%
- **Поддерживаемость**: 40% → 85%

---

## 📝 **ЗАКЛЮЧЕНИЕ**

Stage 2 рефакторинг фокусируется на **критических проблемах безопасности** и **архитектурных улучшениях**.

**Принцип**: "Сначала безопасность, потом архитектура"

**Время выполнения**: ~4-6 часов  
**Количество этапов**: 4  
**Приоритет**: Критический  

**Результат**: Безопасное, модульное, поддерживаемое приложение

---

*Документ создан: 4 сентября 2025*  
*Статус: Планирование*  
*Приоритет: Критический*
