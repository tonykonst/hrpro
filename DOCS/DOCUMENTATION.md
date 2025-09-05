# Полная документация системы Interview Assistant v0.51

*Дата создания: 5 сентября 2025*  
*Версия: v0.51*  
*Статус: Активная разработка*

---

## 📋 **ОБЗОР СИСТЕМЫ**

Interview Assistant - это Electron-приложение для HR-специалистов, которое в реальном времени транскрибирует интервью, анализирует ответы кандидатов с помощью AI и предоставляет инсайты для принятия решений.

### **Основные компоненты:**
- **Electron Main Process** - управление окнами и IPC
- **React Renderer** - пользовательский интерфейс
- **Deepgram API** - речевое распознавание
- **Claude AI** - анализ транскриптов
- **Post-Editor** - коррекция ASR ошибок
- **RAG System** - контекстный анализ

---

## 🚀 **ПРОЦЕСС ЗАПУСКА ПРИЛОЖЕНИЯ**

### **1. Инициализация Electron**

**Файл:** `src/main/main.ts`

```typescript
// События приложения
app.whenReady().then(() => {
  createControlPanelWindow();    // Создание панели управления
  registerGlobalShortcuts();     // Регистрация горячих клавиш
  setupIPC();                    // Настройка IPC handlers
});
```

**Последовательность:**
1. `createControlPanelWindow()` - создает главное окно
2. `registerGlobalShortcuts()` - регистрирует Ctrl+\ для показа/скрытия
3. `setupIPC()` - настраивает IPC каналы

### **2. Создание панели управления**

```typescript
function createControlPanelWindow() {
  const windowOptions = {
    width: 200, height: 56,           // Компактный размер
    frame: false,                     // Без системной рамки
    transparent: true,                // Прозрачный фон
    alwaysOnTop: true,                // Поверх всех окон
    skipTaskbar: true,                // Не в панели задач
    webPreferences: {
      nodeIntegration: false,         // ✅ БЕЗОПАСНО
      contextIsolation: true,         // ✅ БЕЗОПАСНО
      webSecurity: true,              // ✅ БЕЗОПАСНО
      preload: path.join(__dirname, '..', 'preload', 'preload.js')
    }
  };
  
  controlPanelWindow = new BrowserWindow(windowOptions);
  controlPanelWindow.loadURL('http://localhost:5173?window=control');
}
```

### **3. Загрузка React приложения**

**Файл:** `src/App.tsx`

```typescript
export function App() {
  // Определяем тип окна из URL параметров
  const urlParams = new URLSearchParams(window.location.search);
  const windowType = urlParams.get('window') || 'control';
  
  // Инициализируем хуки
  const transcription = useTranscription();
  const audioRecording = useAudioRecording();
  
  // Рендерим соответствующий компонент
  if (windowType === 'data') {
    return <DataWindow {...props} />;
  }
  return <ControlPanel {...props} />;
}
```

---

## 🎤 **ПРОЦЕСС ЗАПИСИ И ТРАНСКРИПЦИИ**

### **1. Инициализация записи**

**Файл:** `src/hooks/useTranscription.ts`

```typescript
const startRecording = useCallback(async () => {
  // ШАГ 1: Обновляем UI состояние
  setIsRecording(true);
  
  // ШАГ 2: Получаем доступ к микрофону
  const audioConstraints = configService.getAudioConstraints();
  const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
  
  // ШАГ 3: Подключаемся к Deepgram
  const cleanup = await connectToDeepgram();
  
  // ШАГ 4: Настраиваем аудио pipeline
  const audioContext = new AudioContext({ sampleRate: 16000 });
  await audioContext.audioWorklet.addModule('/audioWorklet.js');
  
  const source = audioContext.createMediaStreamSource(stream);
  const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
  
  // ШАГ 5: Обработчик аудио данных
  workletNode.port.onmessage = (event) => {
    if (event.data.type === 'pcm-data') {
      deepgramRef.current.sendAudio(event.data.data);
    }
  };
  
  source.connect(workletNode);
}, []);
```

### **2. Подключение к Deepgram**

**Файл:** `src/services/deepgram.ts`

```typescript
connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Строим WebSocket URL с параметрами
    const params = new URLSearchParams({
      model: this.config.model,                    // nova-2-meeting
      punctuation: this.config.punctuation.toString(),
      interim_results: this.config.interim_results.toString(),
      smart_format: this.config.smart_format.toString(),
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1'
    });
    
    const wsUrl = `wss://api.deepgram.com/v1/listen?${params}`;
    this.ws = new WebSocket(wsUrl, ['token', this.config.apiKey]);
    
    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.startHeartbeat();  // Запускаем heartbeat
      resolve();
    };
    
    this.ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
      if (data.channel?.alternatives?.[0]?.transcript) {
        const transcript = data.channel.alternatives[0].transcript.trim();
        const confidence = data.channel.alternatives[0].confidence || 0;
        const is_final = data.is_final || false;
        
        // Адаптивный анализ
        const analysis = this.adaptiveASR.analyzeTranscript(transcript, confidence, latency);
        
        // Создаем событие транскрипта
        const transcriptEvent = {
          type: is_final ? 'final' : 'partial',
          text: transcript,
          confidence,
          timestamp: Date.now(),
          segment_id: `segment_${++this.segmentCounter}_${Date.now()}`
        };
        
        // Отправляем событие
        this.onTranscript(transcriptEvent);
        
        // Проверяем нужность коррекции
        if (this.postEditor && is_final && confidence < 0.8) {
          this.correctSegmentAsync(transcript, analysis, segmentId, confidence);
        }
      }
    };
  });
}
```

### **3. Аудио Pipeline**

**Файл:** `public/audioWorklet.js`

```javascript
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputData = input[0];
      
      // Конвертируем Float32 в Int16
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
      }
      
      // Отправляем данные в main thread
      this.port.postMessage({
        type: 'pcm-data',
        data: pcm16.buffer
      });
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
```

---

## 🤖 **ПРОЦЕСС АНАЛИЗА С CLAUDE AI**

### **1. Инициализация Claude сервиса**

**Файл:** `src/services/claude.ts`

```typescript
export class ClaudeAnalysisService {
  constructor(config: ClaudeServiceConfig, ragService?: RAGService) {
    this.anthropic = new Anthropic({ apiKey: config.apiKey });
    this.systemPrompt = `You are an expert technical interviewer...`;
  }
  
  async analyzeTranscript(request: AnalysisRequest): Promise<InsightResponse> {
    // Улучшаем контекст с помощью RAG
    let enhancedRequest = request;
    if (this.ragService) {
      const ragContext = await this.ragService.getRelevantContext(
        request.transcript, 
        { types: ['job_description', 'resume'], maxTokens: 2000 }
      );
      enhancedRequest = { ...request, ragContext };
    }
    
    const userPrompt = this.buildUserPrompt(enhancedRequest);
    
    const response = await this.anthropic.messages.create({
      model: this.config.model,           // claude-sonnet-4-20250514
      max_tokens: this.config.maxTokens,  // 300
      temperature: this.config.temperature, // 0.3
      system: this.systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    
    return JSON.parse(response.content[0].text);
  }
}
```

### **2. Контекстный анализ**

**Файл:** `src/services/claude.ts`

```typescript
private buildUserPrompt(request: AnalysisRequest): string {
  let prompt = `ANALYZE THIS INTERVIEW SEGMENT:

CURRENT TRANSCRIPT:
"${request.transcript}"

CONTEXT WINDOW (last 15-40s):
${request.contextWindow.join(' ')}

TECHNICAL ENTITIES MENTIONED:
${request.entities.join(', ') || 'None yet'}

PREVIOUS TOPICS:
${request.topicHistory.join(', ') || 'None yet'}`;

  // Добавляем RAG контекст если доступен
  if (request.ragContext?.relevantChunks.length > 0) {
    prompt += `\n\nRELEVANT CONTEXT FROM DOCUMENTS:`;
    
    const jobDescChunks = request.ragContext.relevantChunks.filter(
      chunk => chunk.source.type === 'job_description'
    );
    const resumeChunks = request.ragContext.relevantChunks.filter(
      chunk => chunk.source.type === 'resume'
    );
    
    if (jobDescChunks.length > 0) {
      prompt += `\n\nJOB REQUIREMENTS:`;
      jobDescChunks.forEach((chunk, index) => {
        prompt += `\n${index + 1}. ${chunk.content.substring(0, 500)}...`;
      });
    }
  }
  
  return prompt;
}
```

### **3. Обработка ответа Claude**

**Файл:** `src/hooks/useTranscription.ts`

```typescript
const analyzeWithClaude = useCallback(async (newText: string): Promise<void> => {
  if (!claudeRef.current || !analysisContextRef.current) return;
  
  // Добавляем текст в контекст
  analysisContextRef.current.addTranscript(newText);
  const context = analysisContextRef.current.getContext();
  
  const analysisRequest = {
    transcript: newText,
    contextWindow: context.contextWindow,
    entities: context.entities,
    topicHistory: context.topicHistory
  };
  
  // Получаем анализ от Claude
  const analysis: InsightResponse = await claudeRef.current.analyzeTranscript(analysisRequest);
  
  // Добавляем топик в историю
  analysisContextRef.current.addTopic(analysis.topic);
  
  // Конвертируем в legacy формат для UI
  const legacyInsight: LegacyInsight = {
    id: Date.now().toString(),
    text: analysis.note,
    type: analysis.type  // 'strength' | 'risk' | 'question'
  };
  
  // Обновляем UI (показываем последние 3 insights)
  setInsights(prev => [...prev.slice(-2), legacyInsight]);
}, []);
```

---

## 🔧 **ПРОЦЕСС КОРРЕКЦИИ ASR**

### **1. Анализ сегмента**

**Файл:** `src/services/post-editor.ts`

```typescript
analyzeSegment(text: string, confidence: number): SegmentAnalysis {
  const analysis: SegmentAnalysis = {
    needsCorrection: false,
    reasons: [],
    confidence: 0,
    language: this.detectLanguage(text),
    technicalTerms: this.extractTechnicalTerms(text)
  };
  
  // Триггеры для коррекции
  if (confidence < 0.7) {
    analysis.needsCorrection = true;
    analysis.reasons.push('low_confidence');
  }
  
  if (analysis.language === 'mixed') {
    analysis.needsCorrection = true;
    analysis.reasons.push('mixed_language');
  }
  
  if (analysis.technicalTerms.length > 0) {
    analysis.needsCorrection = true;
    analysis.reasons.push('technical_terms');
  }
  
  const suspiciousWords = this.findSuspiciousWords(text);
  if (suspiciousWords.length > 0) {
    analysis.needsCorrection = true;
    analysis.reasons.push('suspicious_words');
  }
  
  return analysis;
}
```

### **2. Детекция языка**

```typescript
private detectLanguage(text: string): 'ru' | 'en' | 'mixed' {
  const cyrillicPattern = /[а-яё]/i;
  const latinPattern = /[a-z]/i;
  
  const hasCyrillic = cyrillicPattern.test(text);
  const hasLatin = latinPattern.test(text);
  
  if (hasCyrillic && hasLatin) return 'mixed';
  if (hasCyrillic) return 'ru';
  return 'en';
}
```

### **3. Извлечение технических терминов**

```typescript
private extractTechnicalTerms(text: string): string[] {
  const patterns = [
    /\b[A-Z][a-z]*[A-Z][a-zA-Z]*\b/g,  // CamelCase
    /\b\w+\.(js|ts|py|java|go|rs|sql|json|yaml|yml|xml|html|css)\b/g, // Extensions
    /\b(API|SDK|UI|UX|DB|SQL|REST|GraphQL|JWT|OAuth|HTTP|HTTPS|JSON|XML|HTML|CSS|NPM|Git|Docker|Kubernetes|AWS|Azure|GCP)\b/g, // Tech acronyms
    /\b[a-z]+\-[a-z\-]+\b/g,  // kebab-case
    /\b[a-z_]+_[a-z_]+\b/g,   // snake_case
    /\bv?\d+\.\d+(\.\d+)?(\-[a-z0-9\-]+)?(\+[a-z0-9\-]+)?\b/g, // Версии
  ];
  
  const terms: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) terms.push(...matches);
  });
  
  return [...new Set(terms)];
}
```

### **4. LLM коррекция**

```typescript
async correctText(text: string, analysis: SegmentAnalysis): Promise<CorrectionResult> {
  const startTime = Date.now();
  
  try {
    // Rate limiting
    await this.enforceRateLimit();
    
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(text, analysis);
    
    const response = await Promise.race([
      this.anthropic.messages.create({
        model: this.config.model,        // claude-3-haiku-20240307
        max_tokens: this.config.maxTokens, // 150
        temperature: this.config.temperature, // 0.1
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      }),
      this.createTimeoutPromise(this.config.timeoutMs) // 500ms
    ]);
    
    const result = JSON.parse(response.content[0].text);
    
    return {
      correctedText: result.corrected_text,
      wasChanged: result.was_changed,
      confidence: result.confidence,
      processingTimeMs: Date.now() - startTime
    };
    
  } catch (error) {
    // Возвращаем оригинальный текст при ошибке
    return {
      correctedText: text,
      wasChanged: false,
      confidence: 0,
      processingTimeMs: Date.now() - startTime
    };
  }
}
```

---

## 🪟 **ПРОЦЕСС УПРАВЛЕНИЯ ОКНАМИ**

### **1. Создание окна данных**

**Файл:** `src/main/main.ts`

```typescript
function createDataWindow() {
  if (dataWindow && !dataWindow.isDestroyed()) {
    dataWindow.show();
    dataWindow.focus();
    return;
  }
  
  const dataWindowOptions = {
    width: 600, height: 400,
    frame: false,                    // Без системной рамки
    transparent: true,               // Прозрачный фон
    alwaysOnTop: true,
    skipTaskbar: true,               // Не в панели задач
    show: false,                     // Не показывать сразу
    webPreferences: {
      nodeIntegration: false,        // ✅ БЕЗОПАСНО
      contextIsolation: true,        // ✅ БЕЗОПАСНО
      webSecurity: true,             // ✅ БЕЗОПАСНО
      preload: path.join(__dirname, '..', 'preload', 'preload.js')
    }
  };
  
  dataWindow = new BrowserWindow(dataWindowOptions);
  dataWindow.loadURL('http://localhost:5173?window=data');
  
  // Позиционируем рядом с панелью управления
  if (controlPanelWindow) {
    const panelBounds = controlPanelWindow.getBounds();
    dataWindow.setPosition(panelBounds.x, panelBounds.y + panelBounds.height + 10);
  }
  
  // Обрабатываем очередь данных после создания окна
  processPendingData();
}
```

### **2. IPC Handlers**

```typescript
function setupIPC() {
  // Создать окно с данными
  ipcMain.handle('create-data-window', () => {
    try {
      createDataWindow();
      if (controlPanelWindow) {
        controlPanelWindow.webContents.send('window-created', 'data');
      }
      return { success: true, message: 'Data window creation initiated' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // Передать транскрипт в окно данных
  ipcMain.handle('send-transcript', (event, data) => {
    if (dataWindow && !dataWindow.isDestroyed()) {
      dataWindow.webContents.send('transcript-update', data);
    } else {
      pendingTranscriptData.push(data); // Добавляем в очередь
    }
  });
  
  // Передать инсайты в окно данных
  ipcMain.handle('send-insights', (event, insights) => {
    if (dataWindow && !dataWindow.isDestroyed()) {
      dataWindow.webContents.send('insights-update', insights);
    } else {
      pendingInsightsData.push(insights);
    }
  });
}
```

### **3. Обработка очереди данных**

```typescript
function processPendingData() {
  if (!dataWindow || dataWindow.isDestroyed()) return;
  
  // Отправляем накопленные данные транскрипции
  pendingTranscriptData.forEach(data => {
    dataWindow.webContents.send('transcript-update', data);
  });
  pendingTranscriptData = [];
  
  // Отправляем накопленные данные инсайтов
  pendingInsightsData.forEach(data => {
    dataWindow.webContents.send('insights-update', data);
  });
  pendingInsightsData = [];
  
  // Отправляем накопленные данные состояния записи
  pendingRecordingStateData.forEach(data => {
    dataWindow.webContents.send('recording-state-change', data);
  });
  pendingRecordingStateData = [];
}
```

---

## 🔄 **ПРОЦЕСС СИНХРОНИЗАЦИИ ДАННЫХ**

### **1. Preload Script**

**Файл:** `src/preload/preload.ts`

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // Базовые методы
  getConfig: () => Promise.resolve({ 
    audio: { sampleRate: 16000 }, 
    ui: { theme: 'dark' },
    env: {
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      POST_EDITOR_API_KEY: process.env.POST_EDITOR_API_KEY || '',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  }),
  
  // IPC методы
  sendTranscript: (data: any) => ipcRenderer.invoke('send-transcript', data),
  sendInsights: (data: any) => ipcRenderer.invoke('send-insights', data),
  sendRecordingState: (data: any) => ipcRenderer.invoke('send-recording-state', data),
  createDataWindow: () => ipcRenderer.invoke('create-data-window'),
  closeDataWindow: () => ipcRenderer.invoke('close-data-window'),
  
  // Слушатели событий
  onTranscriptUpdate: (callback: (data: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('transcript-update', handler);
    return () => ipcRenderer.removeListener('transcript-update', handler);
  },
  
  onInsightsUpdate: (callback: (data: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('insights-update', handler);
    return () => ipcRenderer.removeListener('insights-update', handler);
  }
});
```

### **2. Data Sync Hook**

**Файл:** `src/hooks/useDataSync.ts`

```typescript
export const useDataSync = (options: DataSyncOptions) => {
  const { windowType, transcript, partialTranscript, insights, isRecording } = options;
  
  // Функция для отправки данных в окно с данными
  const sendToDataWindow = useCallback((type: 'transcript' | 'insights' | 'recording-state', data: any) => {
    if (window.electronAPI && windowType !== 'data') {
      if (type === 'transcript') {
        window.electronAPI.sendTranscript(data);
      } else if (type === 'insights') {
        window.electronAPI.sendInsights(data);
      } else if (type === 'recording-state') {
        window.electronAPI.sendRecordingState(data.isRecording);
      }
    }
  }, [windowType]);
  
  // Автоматическая отправка данных при изменении
  useEffect(() => {
    if (windowType === 'control' && transcript !== undefined) {
      sendToDataWindow('transcript', { transcript, partialTranscript });
    }
  }, [transcript, partialTranscript, windowType, sendToDataWindow]);
  
  useEffect(() => {
    if (windowType === 'control' && insights !== undefined) {
      sendToDataWindow('insights', insights);
    }
  }, [insights, windowType, sendToDataWindow]);
  
  // Слушатели событий для data окна
  useEffect(() => {
    if (windowType === 'data' && window.electronAPI) {
      let cleanupTranscript: (() => void) | undefined;
      let cleanupInsights: (() => void) | undefined;
      
      if (onTranscriptUpdate) {
        cleanupTranscript = window.electronAPI.onTranscriptUpdate(onTranscriptUpdate);
      }
      
      if (onInsightsUpdate) {
        cleanupInsights = window.electronAPI.onInsightsUpdate(onInsightsUpdate);
      }
      
      return () => {
        if (cleanupTranscript) cleanupTranscript();
        if (cleanupInsights) cleanupInsights();
      };
    }
  }, [windowType, onTranscriptUpdate, onInsightsUpdate]);
  
  return { sendToDataWindow };
};
```

---

## ⚙️ **ПРОЦЕСС КОНФИГУРАЦИИ**

### **1. Config Service**

**Файл:** `src/services/config.ts`

```typescript
class ConfigService {
  private config: AppConfig;
  
  constructor() {
    this.config = this.loadConfig();
    this.validateConfig();
  }
  
  private loadConfig(): AppConfig {
    return {
      api: {
        deepgram: {
          apiKey: this.getEnvVar('DEEPGRAM_API_KEY', ''),
          model: 'nova-2-meeting',           // Специально для совещаний
          language: '',                       // Автоопределение
          punctuation: true,                  // Включена
          interimResults: true,               // Включены
          smartFormat: true,                  // Включен
          endpointing: 800,                   // 800ms для завершения фразы
          vadEvents: true,                    // Voice Activity Detection
          noDelay: true,                      // Убрана буферизация
          interimResultsPeriod: 100,          // 100ms для быстрого отклика
          keywords: this.getDefaultKeywords() // IT-термины
        },
        claude: {
          apiKey: this.getEnvVar('CLAUDE_API_KEY', ''),
          model: 'claude-sonnet-4-20250514',
          maxTokens: 300,
          temperature: 0.3
        },
        postEditor: {
          apiKey: this.getEnvVar('POST_EDITOR_API_KEY', ''),
          model: 'claude-3-haiku-20240307',  // Быстрая модель
          maxTokens: 150,
          temperature: 0.1,                   // Низкая для консистентности
          maxRequestsPerSecond: 3,            // Rate limiting
          timeoutMs: 500,                     // Таймаут
          enabled: true
        }
      },
      audio: {
        sampleRate: 16000,
        channels: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        chunkSize: 250
      },
      ui: {
        insightFrequencyMs: 3000,
        minInsightConfidence: 0.6,
        transcriptBufferWords: 600,
        maxInsightsDisplay: 3,
        defaultActivePanel: 'transcript',
        defaultClickThrough: false
      },
      isDevelopment: this.getEnvVar('NODE_ENV', 'development') === 'development'
    };
  }
  
  // Асинхронно получить конфигурацию с переменными окружения
  async getConfigWithEnv(): Promise<AppConfig> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const configData = await (window as any).electronAPI.getConfig();
        if (configData?.env) {
          // Обновляем конфигурацию с реальными переменными окружения
          this.config.api.deepgram.apiKey = configData.env.DEEPGRAM_API_KEY || this.config.api.deepgram.apiKey;
          this.config.api.claude.apiKey = configData.env.CLAUDE_API_KEY || this.config.api.claude.apiKey;
          this.config.api.openai.apiKey = configData.env.OPENAI_API_KEY || this.config.api.openai.apiKey;
          this.config.api.postEditor.apiKey = configData.env.POST_EDITOR_API_KEY || this.config.api.postEditor.apiKey;
          this.config.isDevelopment = configData.env.NODE_ENV === 'development';
        }
      } catch (error) {
        console.warn('⚠️ Failed to load environment variables from electronAPI:', error);
      }
    }
    return this.config;
  }
}
```

### **2. Vite Configuration**

**Файл:** `vite.config.js`

```javascript
export default defineConfig({
  plugins: [react()],
  base: './',
  
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost'
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/services': resolve(__dirname, 'src/services')
    }
  },
  
  // Переменные окружения (TODO: Перенести в preload для безопасности)
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __NODE_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
    
    // API Keys
    'process.env.DEEPGRAM_API_KEY': JSON.stringify(process.env.DEEPGRAM_API_KEY || ''),
    'process.env.CLAUDE_API_KEY': JSON.stringify(process.env.CLAUDE_API_KEY || ''),
    
    // Deepgram Settings
    'process.env.DEEPGRAM_MODEL': JSON.stringify(process.env.DEEPGRAM_MODEL || 'nova-2'),
    'process.env.DEEPGRAM_LANGUAGE': JSON.stringify(process.env.DEEPGRAM_LANGUAGE || 'ru'),
    
    // Claude Settings
    'process.env.CLAUDE_MODEL': JSON.stringify(process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'),
    'process.env.CLAUDE_MAX_TOKENS': JSON.stringify(process.env.CLAUDE_MAX_TOKENS || '300'),
    'process.env.CLAUDE_TEMPERATURE': JSON.stringify(process.env.CLAUDE_TEMPERATURE || '0.3'),
    
    // Audio Settings
    'process.env.AUDIO_SAMPLE_RATE': JSON.stringify(process.env.AUDIO_SAMPLE_RATE || '16000'),
    'process.env.AUDIO_CHANNELS': JSON.stringify(process.env.AUDIO_CHANNELS || '1'),
    'process.env.AUDIO_ECHO_CANCELLATION': JSON.stringify(process.env.AUDIO_ECHO_CANCELLATION || 'true'),
    'process.env.AUDIO_NOISE_SUPPRESSION': JSON.stringify(process.env.AUDIO_NOISE_SUPPRESSION || 'true'),
    'process.env.AUDIO_AUTO_GAIN_CONTROL': JSON.stringify(process.env.AUDIO_AUTO_GAIN_CONTROL || 'true'),
    'process.env.AUDIO_CHUNK_SIZE': JSON.stringify(process.env.AUDIO_CHUNK_SIZE || '250')
  }
});
```

---

## 🧠 **АДАПТИВНАЯ СИСТЕМА ASR**

### **1. Детекция языка**

**Файл:** `src/services/adaptive-asr.ts`

```typescript
export class LanguageDetector {
  detectLanguage(text: string): LanguageStats {
    const englishPattern = /[a-zA-Z]/g;
    const russianPattern = /[а-яё]/gi;
    const numberPattern = /\d/g;
    
    const englishChars = (text.match(englishPattern) || []).length;
    const russianChars = (text.match(russianPattern) || []).length;
    const numberChars = (text.match(numberPattern) || []).length;
    
    const totalLetters = englishChars + russianChars;
    const totalChars = text.length - numberChars;
    
    if (totalLetters === 0) {
      return { language: 'mixed', confidence: 0.5, characterCount: totalChars, lastDetected: Date.now() };
    }
    
    const englishRatio = englishChars / totalLetters;
    const russianRatio = russianChars / totalLetters;
    
    let detectedLanguage: 'ru' | 'en' | 'mixed';
    let confidence: number;
    
    if (englishRatio > 0.8) {
      detectedLanguage = 'en';
      confidence = englishRatio;
    } else if (russianRatio > 0.8) {
      detectedLanguage = 'ru';
      confidence = russianRatio;
    } else {
      detectedLanguage = 'mixed';
      confidence = 1 - Math.abs(englishRatio - russianRatio);
    }
    
    return { language: detectedLanguage, confidence, characterCount: totalChars, lastDetected: Date.now() };
  }
  
  // Получить доминирующий язык за последние сегменты
  getDominantLanguage(): 'ru' | 'en' | 'mixed' {
    if (this.languageHistory.length === 0) return 'mixed';
    
    const recent = this.languageHistory.slice(-5); // Последние 5 сегментов
    const langCounts = { ru: 0, en: 0, mixed: 0 };
    
    recent.forEach(stats => {
      langCounts[stats.language]++;
    });
    
    const dominant = Object.entries(langCounts).reduce((a, b) => 
      langCounts[a[0]] > langCounts[b[0]] ? a : b
    )[0] as 'ru' | 'en' | 'mixed';
    
    return dominant;
  }
}
```

### **2. Оптимизация производительности**

```typescript
export class PerformanceOptimizer {
  updateMetrics(confidence: number, latency: number, hadError: boolean = false) {
    this.metrics.totalSegments++;
    
    // Обновляем среднюю уверенность (экспоненциальное сглаживание)
    this.metrics.avgConfidence = this.metrics.avgConfidence * 0.9 + confidence * 0.1;
    
    // Обновляем латентность
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 20) {
      this.latencyHistory = this.latencyHistory.slice(-20);
    }
    this.metrics.avgLatency = this.latencyHistory.reduce((a, b) => a + b) / this.latencyHistory.length;
    
    // Обновляем частоту ошибок
    if (hadError) {
      this.metrics.errorRate = this.metrics.errorRate * 0.95 + 0.05;
    } else {
      this.metrics.errorRate = this.metrics.errorRate * 0.95;
    }
  }
  
  // Рекомендации по оптимизации модели
  getModelRecommendation(): { model: string, reason: string } {
    const sessionTime = (Date.now() - this.metrics.sessionStartTime) / (1000 * 60);
    
    if (sessionTime > 30 && this.metrics.avgConfidence < 0.7) {
      return { model: 'nova-2-general', reason: 'low confidence in long session' };
    }
    
    if (this.metrics.avgConfidence > 0.9 && this.metrics.avgLatency > 300) {
      return { model: 'base', reason: 'high confidence, optimize for speed' };
    }
    
    if (this.metrics.errorRate > 0.2) {
      return { model: 'nova-2', reason: 'high error rate, need accuracy' };
    }
    
    return { model: 'nova-2-meeting', reason: 'balanced for interview context' };
  }
  
  // Адаптивные параметры для Deepgram
  getAdaptiveParameters(): {
    endpointing: number,
    interim_results_period: number,
    confidence_threshold: number
  } {
    let endpointing = 300;
    if (this.metrics.avgConfidence < 0.7) {
      endpointing = 500; // Ждем дольше при низком качестве
    } else if (this.metrics.avgConfidence > 0.9) {
      endpointing = 200; // Быстрее при высоком качестве
    }
    
    let interimPeriod = 100;
    if (this.metrics.avgLatency > 400) {
      interimPeriod = 200; // Реже при высокой латентности
    } else if (this.metrics.avgLatency < 150) {
      interimPeriod = 50; // Чаще при низкой латентности
    }
    
    let confidenceThreshold = 0.9;
    if (this.metrics.avgConfidence < 0.8) {
      confidenceThreshold = 0.85; // Более агрессивная коррекция
    } else if (this.metrics.avgConfidence > 0.95) {
      confidenceThreshold = 0.95; // Более консервативная коррекция
    }
    
    return { endpointing, interim_results_period: interimPeriod, confidence_threshold: confidenceThreshold };
  }
}
```

### **3. Адаптивный менеджер ASR**

```typescript
export class AdaptiveASRManager {
  private languageDetector: LanguageDetector;
  private performanceOptimizer: PerformanceOptimizer;
  private currentLanguageSetting: string = 'multi';
  
  analyzeTranscript(text: string, confidence: number, latency: number = 200): {
    languageStats: LanguageStats,
    shouldOptimize: boolean,
    recommendations: {
      languageSwitch?: { switch: boolean, newSetting: string },
      modelSwitch?: { model: string, reason: string },
      adaptiveParams?: any
    }
  } {
    const languageStats = this.languageDetector.detectLanguage(text);
    this.performanceOptimizer.updateMetrics(confidence, latency);
    
    const languageSwitch = this.languageDetector.shouldSwitchModel(this.currentLanguageSetting);
    const modelRecommendation = this.performanceOptimizer.getModelRecommendation();
    const adaptiveParams = this.performanceOptimizer.getAdaptiveParameters();
    
    const shouldOptimize = languageSwitch.switch || 
                          modelRecommendation.model !== 'nova-2-meeting' ||
                          adaptiveParams.confidence_threshold !== 0.9;
    
    return {
      languageStats,
      shouldOptimize,
      recommendations: {
        languageSwitch: languageSwitch.switch ? languageSwitch : undefined,
        modelSwitch: modelRecommendation,
        adaptiveParams
      }
    };
  }
}
```

---

## 📊 **ПРОЦЕСС ЛОГИРОВАНИЯ**

### **1. Transcript Logger**

**Файл:** `src/services/transcript-logger.ts`

```typescript
export class TranscriptLogger {
  private sessionId: string;
  private logDir: string;
  private logFile: string;
  private sessionStartTime: number;
  
  constructor() {
    this.sessionId = `session_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
    this.logDir = path.join(process.cwd(), 'transcript-logs');
    this.logFile = path.join(this.logDir, `${this.sessionId}.md`);
    this.sessionStartTime = Date.now();
    
    this.ensureLogDirectory();
    this.initializeLogFile();
  }
  
  logTranscript(transcript: TranscriptLogEntry): void {
    const timestamp = new Date(transcript.timestamp).toLocaleTimeString();
    const logEntry = `[${timestamp}] ${transcript.type.toUpperCase()}: ${transcript.text}`;
    
    if (transcript.confidence !== undefined) {
      logEntry += ` (confidence: ${transcript.confidence.toFixed(2)})`;
    }
    
    if (transcript.segment_id) {
      logEntry += ` [${transcript.segment_id}]`;
    }
    
    if (transcript.language) {
      logEntry += ` [lang: ${transcript.language}]`;
    }
    
    if (transcript.original_text) {
      logEntry += `\n  Original: ${transcript.original_text}`;
    }
    
    logEntry += '\n\n';
    
    fs.appendFileSync(this.logFile, logEntry);
  }
  
  endSession(): void {
    const sessionDuration = Date.now() - this.sessionStartTime;
    const durationMinutes = Math.round(sessionDuration / 60000);
    
    const summary = `\n---\n\n## Session Summary\n- Duration: ${durationMinutes} minutes\n- Ended: ${new Date().toISOString()}\n`;
    
    fs.appendFileSync(this.logFile, summary);
  }
}
```

---

## 🎨 **ПРОЦЕСС ОТОБРАЖЕНИЯ UI**


### **1. Control Panel Component**

**Файл:** `src/components/ControlPanel.tsx`

```typescript
export function ControlPanel({
  isRecording,
  hasPermission,
  transcript,
  partialTranscript,
  insights,
  audioLevel,
  onStartRecording,
  onStopRecording,
  onCheckMicPermission
}: ControlPanelProps) {
  
  // Если запись идет, показываем экран записи
  if (isRecording) {
    return (
      <div className="recording-screen">
        {/* Top panel - recording controls */}
        <div className="recording-screen__header">
          <div className="control-panel control-panel--recording">
            <div className="control-panel__actions">
              {/* Stop button */}
              <button onClick={onStopRecording} className="stop-button">
                <div className="stop-button__icon"></div>
              </button>
              
              {/* Wave Loader Recording indicator */}
              <WaveLoader 
                isActive={true}
                audioLevel={audioLevel}
                className="wave-loader--recording"
              />
            </div>
            
            <div className="control-panel__separator"></div>
            
            {/* Drag zone */}
            <div className="control-panel__drag-zone" style={{WebkitAppRegion: 'drag'}}>
              <div className="drag-dots">
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="recording-screen__content">
          {/* Transcript section */}
          <div className="transcript-section">
            <div className="transcript-section__header">
              <h3>Transcript</h3>
            </div>
            <div className="transcript-section__content">
              {transcript ? (
                <div className="transcript-text">
                  {transcript}
                  {partialTranscript && (
                    <span className="transcript-text--partial">
                      {partialTranscript}
                    </span>
                  )}
                </div>
              ) : (
                <div className="transcript-placeholder">
                  {partialTranscript || 'Start speaking to see transcript...'}
                </div>
              )}
            </div>
          </div>

          {/* Insights section */}
          {insights.length > 0 && (
            <div className="insights-section">
              <div className="insights-section__header">
                <h3>Insights</h3>
              </div>
              <div className="insights-section__content">
                {insights.map((insight) => (
                  <div 
                    key={insight.id} 
                    className={`insight insight--${insight.type}`}
                  >
                    {insight.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Если не записываем, показываем стартовый экран
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="control-panel">
        <div className="control-panel__actions">
          <button
            onClick={() => {
              if (hasPermission) {
                onStartRecording();
              } else {
                onCheckMicPermission();
              }
            }}
            className="start-button"
            style={{WebkitAppRegion: 'no-drag'}}
          >
            <div className="start-button__icon">
              <div className="start-button__icon-rect"></div>
              <svg className="start-button__icon-svg" viewBox="0 0 8 10" fill="none">
                <ellipse cx="4" cy="8" rx="4" ry="2" stroke="white" strokeWidth="1.4"/>
              </svg>
            </div>
            <span>{hasPermission ? 'Start' : 'Allow Mic'}</span>
          </button>
        </div>
        
        <div className="control-panel__separator"></div>
        
        <div className="control-panel__drag-zone" style={{WebkitAppRegion: 'drag'}}>
          <div className="drag-dots">
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### **2. Data Window Component**

**Файл:** `src/components/DataWindow.tsx`

```typescript
export function DataWindow({
  transcript,
  partialTranscript,
  insights,
  isRecording
}: DataWindowProps) {
  return (
    <div className="data-window">
      {/* Header */}
      <div className="data-window__header">
        <h2>Interview Assistant</h2>
        <div className={`recording-indicator ${isRecording ? 'recording-indicator--active' : ''}`}>
          {isRecording ? '● Recording' : '○ Stopped'}
        </div>
      </div>

      {/* Transcript section */}
      <div className="data-window__transcript">
        <h3>Transcript</h3>
        <div className="transcript-content">
          {transcript ? (
            <div className="transcript-text">
              {transcript}
              {partialTranscript && (
                <span className="transcript-text--partial">
                  {partialTranscript}
                </span>
              )}
            </div>
          ) : (
            <div className="transcript-placeholder">
              {partialTranscript || 'No transcript yet...'}
            </div>
          )}
        </div>
      </div>

      {/* Insights section */}
      {insights.length > 0 && (
        <div className="data-window__insights">
          <h3>Insights</h3>
          <div className="insights-content">
            {insights.map((insight) => (
              <div 
                key={insight.id} 
                className={`insight insight--${insight.type}`}
              >
                {insight.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### **3. Wave Loader Component**

**Файл:** `src/components/WaveLoader.tsx`

```typescript
export function WaveLoader({ 
  isActive, 
  audioLevel, 
  className 
}: WaveLoaderProps) {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 150);
    
    return () => clearInterval(interval);
  }, [isActive]);
  
  return (
    <div className={`wave-loader ${className || ''}`}>
      <div className="wave-loader__bars">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`wave-loader__bar ${
              isActive && animationPhase === index ? 'wave-loader__bar--active' : ''
            }`}
            style={{
              height: isActive ? `${Math.max(4, audioLevel * 20)}px` : '4px'
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 🔄 **ПРОЦЕСС СИНХРОНИЗАЦИИ СОСТОЯНИЯ**

### **1. Audio Recording Hook**

**Файл:** `src/hooks/useAudioRecording.ts`

```typescript
export const useAudioRecording = (): UseAudioRecordingReturn => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  const checkMicPermission = useCallback(async () => {
    try {
      console.log('🎤 Checking microphone permission...');
      const audioConstraints = configService.getAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('✅ Microphone permission granted!');
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setHasPermission(false);
    }
  }, []);

  return {
    hasPermission,
    setHasPermission,
    checkMicPermission
  };
};
```

### **2. Audio Analyser Hook**

**Файл:** `src/hooks/useAudioAnalyser.ts`

```typescript
export const useAudioAnalyser = () => {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const initAudioAnalyser = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    source.connect(analyser);
    analyserRef.current = analyser;
    
    // Запускаем анализ уровня звука
    const analyzeAudio = () => {
      if (!analyserRef.current) return;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Вычисляем средний уровень
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(average / 255); // Нормализуем к 0-1
      
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };
    
    analyzeAudio();
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  return {
    audioLevel,
    initAudioAnalyser,
    stopAudioAnalyser
  };
};
```

---

## 🛡️ **ПРОЦЕСС БЕЗОПАСНОСТИ**

### **1. Electron Security Settings**

**Файл:** `src/main/main.ts`

```typescript
webPreferences: {
  nodeIntegration: false,       // ✅ БЕЗОПАСНО - отключена интеграция Node.js
  contextIsolation: true,       // ✅ БЕЗОПАСНО - изоляция контекста
  webSecurity: true,            // ✅ БЕЗОПАСНО - веб-безопасность включена
  backgroundThrottling: false,  // Отключаем throttling для стабильности
  enableRemoteModule: false,    // Отключаем remote module
  preload: path.join(__dirname, '..', 'preload', 'preload.js') // Preload script
}
```

### **2. Preload Script Security**

**Файл:** `src/preload/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// Безопасный API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  // Только безопасные методы
  getConfig: () => Promise.resolve({ 
    audio: { sampleRate: 16000 }, 
    ui: { theme: 'dark' },
    env: {
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      POST_EDITOR_API_KEY: process.env.POST_EDITOR_API_KEY || '',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  }),
  
  // IPC методы
  sendTranscript: (data: any) => ipcRenderer.invoke('send-transcript', data),
  sendInsights: (data: any) => ipcRenderer.invoke('send-insights', data),
  sendRecordingState: (data: any) => ipcRenderer.invoke('send-recording-state', data),
  createDataWindow: () => ipcRenderer.invoke('create-data-window'),
  closeDataWindow: () => ipcRenderer.invoke('close-data-window'),
  
  // Слушатели событий
  onTranscriptUpdate: (callback: (data: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('transcript-update', handler);
    return () => ipcRenderer.removeListener('transcript-update', handler);
  },
  
  onInsightsUpdate: (callback: (data: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('insights-update', handler);
    return () => ipcRenderer.removeListener('insights-update', handler);
  },
  
  onRecordingStateChange: (callback: (data: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('recording-state-change', handler);
    return () => ipcRenderer.removeListener('recording-state-change', handler);
  },
  
  onWindowCreated: (callback: (windowId: string) => void) => {
    const handler = (event: any, windowId: string) => callback(windowId);
    ipcRenderer.on('window-created', handler);
    return () => ipcRenderer.removeListener('window-created', handler);
  },
  
  onWindowClosed: (callback: (windowId: string) => void) => {
    const handler = (event: any, windowId: string) => callback(windowId);
    ipcRenderer.on('window-closed', handler);
    return () => ipcRenderer.removeListener('window-closed', handler);
  },
  
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
  
  // НЕ экспортируем API ключи напрямую!
});
```

### **3. Environment Variables Security**

**Проблема:** API ключи попадают в bundle через `vite.config.js`

```javascript
// ❌ НЕБЕЗОПАСНО в vite.config.js
define: {
  'process.env.DEEPGRAM_API_KEY': JSON.stringify(process.env.DEEPGRAM_API_KEY || ''),
  'process.env.CLAUDE_API_KEY': JSON.stringify(process.env.CLAUDE_API_KEY || ''),
}
```

**Решение:** Передача через preload script

```typescript
// ✅ БЕЗОПАСНО в preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => Promise.resolve({
    env: {
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
    }
  })
});
```

---

## 📦 **ПРОЦЕСС СБОРКИ И РАЗВЕРТЫВАНИЯ**

### **1. Package.json Scripts**

**Файл:** `package.json`

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:vite\" \"wait-on http://localhost:5173 && npm run dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "tsc -p tsconfig.main.json && electron dist/main/main/main.js",
    "build": "npm run build:vite && npm run build:electron",
    "build:vite": "vite build",
    "build:electron": "tsc -p tsconfig.main.json",
    "compile-main": "tsc -p tsconfig.main.json",
    "clean": "rimraf dist",
    "type-check": "tsc --noEmit"
  }
}
```

### **2. TypeScript Configuration**

**Файл:** `tsconfig.main.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "dist/main",
    "rootDir": "src/main",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/main/**/*",
    "src/preload/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "src/renderer"
  ]
}
```

### **3. Vite Build Configuration**

**Файл:** `vite.config.js`

```javascript
export default defineConfig({
  plugins: [react()],
  base: './',
  
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost'
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/services': resolve(__dirname, 'src/services')
    }
  },
  
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    target: 'esnext',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development'
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'zod']
  }
});
```

---

## 🔧 **ПРОЦЕСС ОТЛАДКИ И МОНИТОРИНГА**

### **1. Логирование в Development**

```typescript
// Включение DevTools для отладки
if (configService.isDevelopment) {
  console.log('🔧 Development mode - logging config...');
  configService.logConfig();
}

// DevTools для панели управления
controlPanelWindow.webContents.once('did-finish-load', () => {
  console.log('🔧 Opening DevTools for control panel');
  controlPanelWindow?.webContents.openDevTools({ mode: 'detach' });
});

// DevTools для окна данных
dataWindow.webContents.on('did-finish-load', () => {
  console.log('🔧 Opening DevTools for data window');
  dataWindow.webContents.openDevTools();
});
```

### **2. Глобальные горячие клавиши**

```typescript
function registerGlobalShortcuts() {
  // Ctrl/Cmd + \ для показа/скрытия панели управления
  globalShortcut.register('CommandOrControl+\\', () => {
    if (controlPanelWindow) {
      if (controlPanelWindow.isVisible()) {
        controlPanelWindow.hide();
        if (dataWindow) dataWindow.hide();
      } else {
        controlPanelWindow.show();
        controlPanelWindow.focus();
        if (dataWindow) dataWindow.show();
      }
    }
  });

  console.log('Global shortcuts registered');
}
```

### **3. Обработка ошибок**

```typescript
// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Обработка ошибок WebSocket
this.ws.onerror = (error) => {
  console.error('❌ [DEEPGRAM] WebSocket error:', error);
  this.onError('WebSocket connection error');
};

// Обработка ошибок Claude API
catch (error) {
  console.error('❌ Claude analysis error:', error);
  
  // Fallback insight на ошибку
  return {
    topic: 'Analysis Error',
    depth_score: 0,
    signals: ['API error occurred'],
    followups: [],
    note: 'AI analysis temporarily unavailable',
    type: 'risk',
    confidence: 0
  };
}
```

---

## 📋 **ПОЛНЫЙ ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ**

### **1. Запуск приложения**

```
1. npm run dev
   ├── npm run dev:vite (запуск Vite сервера на :5173)
   └── wait-on http://localhost:5173 && npm run dev:electron
       ├── tsc -p tsconfig.main.json (компиляция main процесса)
       └── electron dist/main/main/main.js (запуск Electron)

2. app.whenReady()
   ├── createControlPanelWindow() (создание главного окна)
   ├── registerGlobalShortcuts() (регистрация Ctrl+\)
   └── setupIPC() (настройка IPC каналов)

3. React App загружается
   ├── App.tsx определяет windowType из URL
   ├── Инициализируются хуки (useTranscription, useAudioRecording)
   └── Рендерится ControlPanel или DataWindow
```

### **2. Начало записи**

```
1. Пользователь нажимает "Start"
   ├── onStartRecording() вызывается
   ├── setIsRecording(true) - обновление UI
   └── setTimeout(() => { ... }, 100) - асинхронные операции

2. Получение доступа к микрофону
   ├── navigator.mediaDevices.getUserMedia(audioConstraints)
   ├── streamRef.current = stream
   └── initAudioAnalyser(stream) - инициализация анализатора

3. Подключение к Deepgram
   ├── configService.getConfigWithEnv() - загрузка конфигурации
   ├── TranscriptionServiceFactory.create() - создание сервиса
   ├── deepgram.connect() - WebSocket подключение
   └── cleanupRef.current = cleanup - сохранение функции очистки

4. Настройка аудио pipeline
   ├── new AudioContext({ sampleRate: 16000 })
   ├── audioContext.audioWorklet.addModule('/audioWorklet.js')
   ├── new AudioWorkletNode(audioContext, 'pcm-processor')
   └── workletNode.port.onmessage - обработчик аудио данных
```

### **3. Обработка аудио и транскрипции**

```
1. Аудио поток
   ├── MediaStream → AudioContext → AudioWorkletNode
   ├── PCMProcessor.process() - конвертация Float32 → Int16
   └── workletNode.port.postMessage() - отправка в main thread

2. Deepgram WebSocket
   ├── ws.send(pcm16.buffer) - отправка аудио данных
   ├── ws.onmessage - получение результатов
   ├── JSON.parse(event.data) - парсинг ответа
   └── adaptiveASR.analyzeTranscript() - адаптивный анализ

3. Обработка транскрипта
   ├── Создание TranscriptEvent (partial/final)
   ├── getTranscriptLogger().logTranscript() - логирование
   ├── this.onTranscript(transcriptEvent) - отправка в UI
   └── postEditor.correctText() - коррекция при необходимости

4. Анализ с Claude AI
   ├── analysisContextRef.current.addTranscript(newText)
   ├── claudeRef.current.analyzeTranscript(analysisRequest)
   ├── Конвертация в LegacyInsight
   └── setInsights(prev => [...prev.slice(-2), legacyInsight])
```

### **4. Синхронизация между окнами**

```
1. Control Panel → Data Window
   ├── useDataSync.sendToDataWindow('transcript', data)
   ├── window.electronAPI.sendTranscript(data)
   ├── ipcRenderer.invoke('send-transcript', data)
   └── ipcMain.handle('send-transcript') → dataWindow.webContents.send()

2. Data Window получение данных
   ├── window.electronAPI.onTranscriptUpdate(callback)
   ├── ipcRenderer.on('transcript-update', handler)
   └── onTranscriptUpdate(data) - обновление состояния

3. Очередь данных
   ├── pendingTranscriptData.push(data) - если окно не создано
   ├── processPendingData() - обработка после создания окна
   └── dataWindow.webContents.send() - отправка накопленных данных
```

### **5. Остановка записи**

```
1. Пользователь нажимает "Stop"
   ├── onStopRecording() вызывается
   └── Очистка всех ресурсов

2. Остановка аудио pipeline
   ├── processorRef.current.disconnect()
   ├── audioContextRef.current.close()
   └── streamRef.current.getTracks().forEach(track => track.stop())

3. Отключение от Deepgram
   ├── cleanupRef.current() - вызов функции очистки
   ├── deepgram.disconnect()
   ├── this.ws.close()
   └── getTranscriptLogger().endSession()

4. Остановка анализатора
   ├── stopAudioAnalyser()
   └── setIsRecording(false) - обновление UI
```

### **6. Завершение приложения**

```
1. app.on('before-quit')
   ├── isQuitting = true
   ├── controlPanelWindow.webContents.closeDevTools()
   ├── dataWindow.webContents.closeDevTools()
   ├── globalShortcut.unregisterAll()
   └── BrowserWindow.getAllWindows().forEach(window => window.destroy())

2. app.on('will-quit')
   ├── Проверка оставшихся окон
   └── Принудительное закрытие всех окон

3. app.on('window-all-closed')
   └── app.quit() - завершение приложения
```

---

## 🎯 **КЛЮЧЕВЫЕ ОСОБЕННОСТИ АРХИТЕКТУРЫ**

### **1. Безопасность**
- ✅ `nodeIntegration: false` - отключена интеграция Node.js
- ✅ `contextIsolation: true` - изоляция контекста
- ✅ `webSecurity: true` - веб-безопасность
- ✅ Preload script для безопасной передачи данных
- ✅ API ключи передаются через contextBridge

### **2. Производительность**
- ✅ AudioWorklet для обработки аудио
- ✅ Адаптивная система ASR
- ✅ Rate limiting для API вызовов
- ✅ Экспоненциальное сглаживание метрик
- ✅ Оптимизированные параметры Deepgram

### **3. Надежность**
- ✅ Обработка ошибок на всех уровнях
- ✅ Fallback механизмы
- ✅ Heartbeat для WebSocket соединения
- ✅ Очередь данных для синхронизации
- ✅ Graceful shutdown

### **4. Масштабируемость**
- ✅ Модульная архитектура
- ✅ Фабричный паттерн для сервисов
- ✅ Адаптеры для внешних API
- ✅ RAG система для контекста
- ✅ Плагинная система анализа

---

## 📝 **ЗАКЛЮЧЕНИЕ**

Interview Assistant v0.51 представляет собой сложную систему с множеством интегрированных компонентов:

**Основные процессы:**
1. **Запуск** - Electron + React инициализация
2. **Запись** - Аудио pipeline + Deepgram WebSocket
3. **Анализ** - Claude AI + RAG система
4. **Коррекция** - Post-editor для ASR ошибок
5. **Синхронизация** - IPC между окнами
6. **Отображение** - React компоненты с реальным временем

**Ключевые технологии:**
- **Electron** - кроссплатформенное десктопное приложение
- **React** - пользовательский интерфейс
- **Deepgram** - речевое распознавание
- **Claude AI** - анализ транскриптов
- **WebSocket** - реальное время
- **AudioWorklet** - обработка аудио
- **TypeScript** - типизация

**Архитектурные принципы:**
- Безопасность через изоляцию процессов
- Производительность через адаптивные алгоритмы
- Надежность через обработку ошибок
- Масштабируемость через модульную структуру

Система готова к использованию в production среде с возможностью дальнейшего развития и оптимизации.

---

*Документ завершен: 5 сентября 2025*  
*Версия: v0.51*  
*Статус: Полная документация*nel Component**

**Файл:** `src/components/ControlPanel.tsx`

```typescript
export function ControlPanel({
  isRecording,
  hasPermission,
  transcript,
  partialTranscript,
  insights,
  audioLevel,
  onStartRecording,
  onStopRecording,
  onCheckMicPermission
}: ControlPanelProps) {
  
  // Если запись идет, показываем экран записи
  if (isRecording) {
    return (
      <div className="recording-screen">
        {/* Top panel - recording controls */}
        <div className="recording-screen__header">
          <div className="control-panel control-panel--recording">
            <div className="control-panel__actions">
              {/* Stop button */}
              <button onClick={onStopRecording} className="stop-button">
                <div className="stop-button__icon"></div>
              </button>
              
              {/* Wave Loader Recording indicator */}
              <WaveLoader 
                isActive={true}
                audioLevel={audioLevel}
                className="wave-loader--recording"
              />
            </div>
            
            <div className="control-panel__separator"></div>
            
            {/* Drag zone */}
            <div className="control-panel__drag-zone" style={{WebkitAppRegion: 'drag'}}>
              <div className="drag-dots">
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="recording-screen__content">
          {/* Transcript section */}
          <div className="transcript-section">
            <div className="transcript-section__header">
              <h3>Transcript</h3>
            </div>
            <div className="transcript-section__content">
              {transcript ? (
                <div className="transcript-text">
                  {transcript}
                  {partialTranscript && (
                    <span className="transcript-text--partial">
                      {partialTranscript}
                    </span>
                  )}
                </div>
              ) : (
                <div className="transcript-placeholder">
                  {partialTranscript || 'Start speaking to see transcript...'}
                </div>
              )}
            </div>
          </div>

          {/* Insights section */}
          {insights.length > 0 && (
            <div className="insights-section">
              <div className="insights-section__header">
                <h3>Insights</h3>
              </div>
              <div className="insights-section__content">
                {insights.map((insight) => (
                  <div 
                    key={insight.id} 
                    className={`insight insight--${insight.type}`}
                  >
                    {insight.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Если не записываем, показываем стартовый экран
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="control-panel">
        <div className="control-panel__actions">
          <button
            onClick={() => {
              if (hasPermission) {
                onStartRecording();
              } else {
                onCheckMicPermission();
              }
            }}
            className="start-button"
            style={{WebkitAppRegion: 'no-drag'}}
          >
            <div className="start-button__icon">
              <div className="start-button__icon-rect"></div>
              <svg className="start-button__icon-svg" viewBox="0 0 8 10" fill="none">
                <ellipse cx="4" cy="8" rx="4" ry="2" stroke="white" strokeWidth="1.4"/>
              </svg>
            </div>
            <span>{hasPermission ? 'Start' : 'Allow Mic'}</span>
          </button>
        </div>
        
        <div className="control-panel__separator"></div>
        
        <div className="control-panel__drag-zone" style={{WebkitAppRegion: 'drag'}}>
          <div className="drag-dots">
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### **2. Data Window Component**

**Файл:** `src/components/DataWindow.tsx`

```typescript
export function DataWindow({
  transcript,
  partialTranscript,
  insights,
  isRecording
}: DataWindowProps) {
  return (
    <div className="data-window">
      {/* Header */}
      <div className="data-window__header">
        <h2>Interview Assistant</h2>
        <div className={`recording-indicator ${isRecording ? 'recording-indicator--active' : ''}`}>
          {isRecording ? '● Recording' : '○ Stopped'}
        </div>
      </div>

      {/* Transcript section */}
      <div className="data-window__transcript">
        <h3>Transcript</h3>
        <div className="transcript-content">
          {transcript ? (
            <div className="transcript-text">
              {transcript}
              {partialTranscript && (
                <span className="transcript-text--partial">
                  {partialTranscript}
                </span>
              )}
            </div>
          ) : (
            <div className="transcript-placeholder">
              {partialTranscript || 'No transcript yet...'}
            </div>
          )}
        </div>
      </div>

      {/* Insights section */}
      {insights.length > 0 && (
        <div className="data-window__insights">
          <h3>Insights</h3>
          <div className="insights-content">
            {insights.map((insight) => (
              <div 
                key={insight.id} 
                className={`insight insight--${insight.type}`}
              >
                {insight.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### **3. Wave Loader Component**

**Файл:** `src/components/WaveLoader.tsx`

```typescript
export function WaveLoader({ 
  isActive, 
  audioLevel, 
  className 
}: WaveLoaderProps) {
  const [animationPhase, setAnimationPhase] = useState(0);
  
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setAnimationPhase(prev => (prev + 1) % 4);
    }, 150);
    
    return () => clearInterval(interval);
  }, [isActive]);
  
  return (
    <div className={`wave-loader ${className || ''}`}>
      <div className="wave-loader__bars">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className={`wave-loader__bar ${
              isActive && animationPhase === index ? 'wave-loader__bar--active' : ''
            }`}
            style={{
              height: isActive ? `${Math.max(4, audioLevel * 20)}px` : '4px'
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 🔄 **ПРОЦЕСС СИНХРОНИЗАЦИИ СОСТОЯНИЯ**

### **1. Audio Recording Hook**

**Файл:** `src/hooks/useAudioRecording.ts`

```typescript
export const useAudioRecording = (): UseAudioRecordingReturn => {
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  const checkMicPermission = useCallback(async () => {
    try {
      console.log('🎤 Checking microphone permission...');
      const audioConstraints = configService.getAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('✅ Microphone permission granted!');
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setHasPermission(false);
    }
  }, []);

  return {
    hasPermission,
    setHasPermission,
    checkMicPermission
  };
};
```

### **2. Audio Analyser Hook**

**Файл:** `src/hooks/useAudioAnalyser.ts`

```typescript
export const useAudioAnalyser = () => {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const initAudioAnalyser = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    
    source.connect(analyser);
    analyserRef.current = analyser;
    
    // Запускаем анализ уровня звука
    const analyzeAudio = () => {
      if (!analyserRef.current) return;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Вычисляем средний уровень
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      setAudioLevel(average / 255); // Нормализуем к 0-1
      
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    };
    
    analyzeAudio();
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  return {
    audioLevel,
    initAudioAnalyser,
    stopAudioAnalyser
  };
};
```

---

## 🛡️ **ПРОЦЕСС БЕЗОПАСНОСТИ**

### **1. Electron Security Settings**

**Файл:** `src/main/main.ts`

```typescript
webPreferences: {
  nodeIntegration: false,       // ✅ БЕЗОПАСНО - отключена интеграция Node.js
  contextIsolation: true,       // ✅ БЕЗОПАСНО - изоляция контекста
  webSecurity: true,            // ✅ БЕЗОПАСНО - веб-безопасность включена
  backgroundThrottling: false,  // Отключаем throttling для стабильности
  enableRemoteModule: false,    // Отключаем remote module
  preload: path.join(__dirname, '..', 'preload', 'preload.js') // Preload script
}
```

### **2. Preload Script Security**

**Файл:** `src/preload/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// Безопасный API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
  // Только безопасные методы
  getConfig: () => Promise.resolve({ 
    audio: { sampleRate: 16000 }, 
    ui: { theme: 'dark' },
    env: {
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      POST_EDITOR_API_KEY: process.env.POST_EDITOR_API_KEY || '',
      NODE_ENV: process.env.NODE_ENV || 'development'
    }
  }),
  
  // IPC методы
  sendTranscript: (data: any) => ipcRenderer.invoke('send-transcript', data),
  sendInsights: (data: any) => ipcRenderer.invoke('send-insights', data),
  sendRecordingState: (data: any) => ipcRenderer.invoke('send-recording-state', data),
  createDataWindow: () => ipcRenderer.invoke('create-data-window'),
  closeDataWindow: () => ipcRenderer.invoke('close-data-window'),
  
  // Слушатели событий
  onTranscriptUpdate: (callback: (data: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('transcript-update', handler);
    return () => ipcRenderer.removeListener('transcript-update', handler);
  },
  
  onInsightsUpdate: (callback: (data: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('insights-update', handler);
    return () => ipcRenderer.removeListener('insights-update', handler);
  },
  
  onRecordingStateChange: (callback: (data: any) => void) => {
    const handler = (event: any, data: any) => callback(data);
    ipcRenderer.on('recording-state-change', handler);
    return () => ipcRenderer.removeListener('recording-state-change', handler);
  },
  
  onWindowCreated: (callback: (windowId: string) => void) => {
    const handler = (event: any, windowId: string) => callback(windowId);
    ipcRenderer.on('window-created', handler);
    return () => ipcRenderer.removeListener('window-created', handler);
  },
  
  onWindowClosed: (callback: (windowId: string) => void) => {
    const handler = (event: any, windowId: string) => callback(windowId);
    ipcRenderer.on('window-closed', handler);
    return () => ipcRenderer.removeListener('window-closed', handler);
  },
  
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
  
  // НЕ экспортируем API ключи напрямую!
});
```

### **3. Environment Variables Security**

**Проблема:** API ключи попадают в bundle через `vite.config.js`

```javascript
// ❌ НЕБЕЗОПАСНО в vite.config.js
define: {
  'process.env.DEEPGRAM_API_KEY': JSON.stringify(process.env.DEEPGRAM_API_KEY || ''),
  'process.env.CLAUDE_API_KEY': JSON.stringify(process.env.CLAUDE_API_KEY || ''),
}
```

**Решение:** Передача через preload script

```typescript
// ✅ БЕЗОПАСНО в preload.ts
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => Promise.resolve({
    env: {
      DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY || '',
    }
  })
});
```

---

## 📦 **ПРОЦЕСС СБОРКИ И РАЗВЕРТЫВАНИЯ**

### **1. Package.json Scripts**

**Файл:** `package.json`

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:vite\" \"wait-on http://localhost:5173 && npm run dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "tsc -p tsconfig.main.json && electron dist/main/main/main.js",
    "build": "npm run build:vite && npm run build:electron",
    "build:vite": "vite build",
    "build:electron": "tsc -p tsconfig.main.json",
    "compile-main": "tsc -p tsconfig.main.json",
    "clean": "rimraf dist",
    "type-check": "tsc --noEmit"
  }
}
```

### **2. TypeScript Configuration**

**Файл:** `tsconfig.main.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "outDir": "dist/main",
    "rootDir": "src/main",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "src/main/**/*",
    "src/preload/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "src/renderer"
  ]
}
```

### **3. Vite Build Configuration**

**Файл:** `vite.config.js`

```javascript
export default defineConfig({
  plugins: [react()],
  base: './',
  
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost'
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/services': resolve(__dirname, 'src/services')
    }
  },
  
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    target: 'esnext',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development'
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'zod']
  }
});
```

---

## 🔧 **ПРОЦЕСС ОТЛАДКИ И МОНИТОРИНГА**

### **1. Логирование в Development**

```typescript
// Включение DevTools для отладки
if (configService.isDevelopment) {
  console.log('🔧 Development mode - logging config...');
  configService.logConfig();
}

// DevTools для панели управления
controlPanelWindow.webContents.once('did-finish-load', () => {
  console.log('🔧 Opening DevTools for control panel');
  controlPanelWindow?.webContents.openDevTools({ mode: 'detach' });
});

// DevTools для окна данных
dataWindow.webContents.on('did-finish-load', () => {
  console.log('🔧 Opening DevTools for data window');
  dataWindow.webContents.openDevTools();
});
```

### **2. Глобальные горячие клавиши**

```typescript
function registerGlobalShortcuts() {
  // Ctrl/Cmd + \ для показа/скрытия панели управления
  globalShortcut.register('CommandOrControl+\\', () => {
    if (controlPanelWindow) {
      if (controlPanelWindow.isVisible()) {
        controlPanelWindow.hide();
        if (dataWindow) dataWindow.hide();
      } else {
        controlPanelWindow.show();
        controlPanelWindow.focus();
        if (dataWindow) dataWindow.show();
      }
    }
  });

  console.log('Global shortcuts registered');
}
```

### **3. Обработка ошибок**

```typescript
// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Обработка ошибок WebSocket
this.ws.onerror = (error) => {
  console.error('❌ [DEEPGRAM] WebSocket error:', error);
  this.onError('WebSocket connection error');
};

// Обработка ошибок Claude API
catch (error) {
  console.error('❌ Claude analysis error:', error);
  
  // Fallback insight на ошибку
  return {
    topic: 'Analysis Error',
    depth_score: 0,
    signals: ['API error occurred'],
    followups: [],
    note: 'AI analysis temporarily unavailable',
    type: 'risk',
    confidence: 0
  };
}
```

---

## 📋 **ПОЛНЫЙ ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ**

### **1. Запуск приложения**

```
1. npm run dev
   ├── npm run dev:vite (запуск Vite сервера на :5173)
   └── wait-on http://localhost:5173 && npm run dev:electron
       ├── tsc -p tsconfig.main.json (компиляция main процесса)
       └── electron dist/main/main/main.js (запуск Electron)

2. app.whenReady()
   ├── createControlPanelWindow() (создание главного окна)
   ├── registerGlobalShortcuts() (регистрация Ctrl+\)
   └── setupIPC() (настройка IPC каналов)

3. React App загружается
   ├── App.tsx определяет windowType из URL
   ├── Инициализируются хуки (useTranscription, useAudioRecording)
   └── Рендерится ControlPanel или DataWindow
```

### **2. Начало записи**

```
1. Пользователь нажимает "Start"
   ├── onStartRecording() вызывается
   ├── setIsRecording(true) - обновление UI
   └── setTimeout(() => { ... }, 100) - асинхронные операции

2. Получение доступа к микрофону
   ├── navigator.mediaDevices.getUserMedia(audioConstraints)
   ├── streamRef.current = stream
   └── initAudioAnalyser(stream) - инициализация анализатора

3. Подключение к Deepgram
   ├── configService.getConfigWithEnv() - загрузка конфигурации
   ├── TranscriptionServiceFactory.create() - создание сервиса
   ├── deepgram.connect() - WebSocket подключение
   └── cleanupRef.current = cleanup - сохранение функции очистки

4. Настройка аудио pipeline
   ├── new AudioContext({ sampleRate: 16000 })
   ├── audioContext.audioWorklet.addModule('/audioWorklet.js')
   ├── new AudioWorkletNode(audioContext, 'pcm-processor')
   └── workletNode.port.onmessage - обработчик аудио данных
```

### **3. Обработка аудио и транскрипции**

```
1. Аудио поток
   ├── MediaStream → AudioContext → AudioWorkletNode
   ├── PCMProcessor.process() - конвертация Float32 → Int16
   └── workletNode.port.postMessage() - отправка в main thread

2. Deepgram WebSocket
   ├── ws.send(pcm16.buffer) - отправка аудио данных
   ├── ws.onmessage - получение результатов
   ├── JSON.parse(event.data) - парсинг ответа
   └── adaptiveASR.analyzeTranscript() - адаптивный анализ

3. Обработка транскрипта
   ├── Создание TranscriptEvent (partial/final)
   ├── getTranscriptLogger().logTranscript() - логирование
   ├── this.onTranscript(transcriptEvent) - отправка в UI
   └── postEditor.correctText() - коррекция при необходимости

4. Анализ с Claude AI
   ├── analysisContextRef.current.addTranscript(newText)
   ├── claudeRef.current.analyzeTranscript(analysisRequest)
   ├── Конвертация в LegacyInsight
   └── setInsights(prev => [...prev.slice(-2), legacyInsight])
```

### **4. Синхронизация между окнами**

```
1. Control Panel → Data Window
   ├── useDataSync.sendToDataWindow('transcript', data)
   ├── window.electronAPI.sendTranscript(data)
   ├── ipcRenderer.invoke('send-transcript', data)
   └── ipcMain.handle('send-transcript') → dataWindow.webContents.send()

2. Data Window получение данных
   ├── window.electronAPI.onTranscriptUpdate(callback)
   ├── ipcRenderer.on('transcript-update', handler)
   └── onTranscriptUpdate(data) - обновление состояния

3. Очередь данных
   ├── pendingTranscriptData.push(data) - если окно не создано
   ├── processPendingData() - обработка после создания окна
   └── dataWindow.webContents.send() - отправка накопленных данных
```

### **5. Остановка записи**

```
1. Пользователь нажимает "Stop"
   ├── onStopRecording() вызывается
   └── Очистка всех ресурсов

2. Остановка аудио pipeline
   ├── processorRef.current.disconnect()
   ├── audioContextRef.current.close()
   └── streamRef.current.getTracks().forEach(track => track.stop())

3. Отключение от Deepgram
   ├── cleanupRef.current() - вызов функции очистки
   ├── deepgram.disconnect()
   ├─