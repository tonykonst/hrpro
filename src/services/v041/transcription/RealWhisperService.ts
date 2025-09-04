import { spawn, ChildProcess } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { TranscriptionResult } from '../../../types/v041/buffering';

/**
 * Настоящий Whisper сервис через Python мост
 * Заменяет Deepgram для высокоточной транскрипции
 */
export class RealWhisperService {
  private pythonPath: string;
  private scriptPath: string;
  private isInitialized = false;
  private processingQueue: Array<{
    audioBlob: Blob;
    resolve: (result: TranscriptionResult) => void;
    reject: (error: Error) => void;
    context?: string;
  }> = [];
  private isProcessing = false;
  
  // Контекст для улучшения точности
  private contextWindow: string[] = [];
  private readonly maxContextLength = 5;
  
  // Статистика
  private stats = {
    totalProcessed: 0,
    averageConfidence: 0,
    averageProcessingTime: 0,
    languageDistribution: new Map<string, number>(),
    technicalTermsDetected: 0
  };

  constructor() {
    // Путь к Python в виртуальном окружении
    this.pythonPath = join(process.cwd(), 'venv_whisper', 'bin', 'python');
    this.scriptPath = join(process.cwd(), 'src', 'python', 'whisper_bridge.py');
    
    console.log('🤖 RealWhisperService initializing...');
  }

  /**
   * Инициализация сервиса
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Проверяем доступность Python и скрипта
      await this.validateEnvironment();
      
      // Тестируем загрузку модели
      await this.testModelLoading();
      
      this.isInitialized = true;
      console.log('✅ RealWhisperService initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize RealWhisperService:', error);
      throw error;
    }
  }

  /**
   * Транскрибирует аудио blob
   */
  async transcribe(audioBlob: Blob, context?: string): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      // Добавляем в очередь
      this.processingQueue.push({
        audioBlob,
        resolve,
        reject,
        context
      });

      // Запускаем обработку если не активна
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Обрабатывает очередь транскрипции
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`⚡ Processing Whisper queue: ${this.processingQueue.length} items`);

    while (this.processingQueue.length > 0) {
      const item = this.processingQueue.shift()!;
      
      try {
        const result = await this.processAudioBlob(item.audioBlob, item.context);
        item.resolve(result);
        
        // Обновляем контекст и статистику
        this.updateContext(result.text);
        this.updateStats(result);
        
      } catch (error) {
        console.error('❌ Queue processing error:', error);
        item.reject(error as Error);
      }
    }

    this.isProcessing = false;
    console.log('✅ Whisper queue processing completed');
  }

  /**
   * Обрабатывает аудио blob
   */
  private async processAudioBlob(audioBlob: Blob, context?: string): Promise<TranscriptionResult> {
    const startTime = Date.now();
    let tempFilePath = '';

    try {
      // Создаем временный файл
      tempFilePath = await this.saveBlobToTempFile(audioBlob);
      
      // Строим контекстный промпт
      const contextPrompt = this.buildContextPrompt(context);
      
      // Вызываем Python Whisper
      const result = await this.callWhisperPython(tempFilePath, contextPrompt);
      
      const processingTime = Date.now() - startTime;
      
      if (!result.success) {
        throw new Error(result.error || 'Whisper processing failed');
      }

      // Конвертируем в формат TranscriptionResult
      const transcriptionResult: TranscriptionResult = {
        text: result.text,
        confidence: result.confidence,
        wordTimestamps: result.word_timestamps || [],
        language: this.normalizeLanguage(result.language),
        isDraft: false,
        processingTime
      };

      console.log(`✅ Whisper transcription: "${result.text.substring(0, 50)}..." (${(result.confidence * 100).toFixed(1)}%)`);
      
      return transcriptionResult;

    } finally {
      // Удаляем временный файл
      if (tempFilePath) {
        try {
          await unlink(tempFilePath);
        } catch (error) {
          console.warn('⚠️ Failed to delete temp file:', tempFilePath);
        }
      }
    }
  }

  /**
   * Сохраняет Blob в временный файл
   */
  private async saveBlobToTempFile(blob: Blob): Promise<string> {
    const buffer = Buffer.from(await blob.arrayBuffer());
    const tempFilePath = join(process.cwd(), 'temp', `whisper_${Date.now()}.wav`);
    
    // Создаем директорию temp если не существует
    await writeFile(tempFilePath, buffer);
    
    return tempFilePath;
  }

  /**
   * Вызывает Python Whisper скрипт
   */
  private async callWhisperPython(audioFilePath: string, contextPrompt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = [
        this.scriptPath,
        audioFilePath,
        '--model', 'large-v3',
        '--faster', // Используем faster-whisper
        '--context', contextPrompt
      ];

      const python = spawn(this.pythonPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse Whisper output: ${parseError}`));
          }
        } else {
          reject(new Error(`Whisper process failed (code ${code}): ${stderr}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn Whisper process: ${error.message}`));
      });
    });
  }

  /**
   * Строит контекстный промпт
   */
  private buildContextPrompt(additionalContext?: string): string {
    let prompt = "Это техническое интервью. Термины: API, React, TypeScript, Docker, Kubernetes, DevOps, CI/CD, машинное обучение.";
    
    if (this.contextWindow.length > 0) {
      const context = this.contextWindow.slice(-3).join(' ');
      prompt += ` Предыдущий контекст: "${context}"`;
    }
    
    if (additionalContext) {
      prompt += ` Дополнительный контекст: "${additionalContext}"`;
    }
    
    return prompt;
  }

  /**
   * Обновляет контекстное окно
   */
  private updateContext(newText: string): void {
    if (newText.trim().length > 0) {
      this.contextWindow.push(newText.trim());
      
      if (this.contextWindow.length > this.maxContextLength) {
        this.contextWindow.shift();
      }
    }
  }

  /**
   * Обновляет статистику
   */
  private updateStats(result: TranscriptionResult): void {
    this.stats.totalProcessed++;
    
    // Средняя уверенность
    this.stats.averageConfidence = (
      (this.stats.averageConfidence * (this.stats.totalProcessed - 1) + result.confidence) /
      this.stats.totalProcessed
    );
    
    // Среднее время обработки
    this.stats.averageProcessingTime = (
      (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + result.processingTime) /
      this.stats.totalProcessed
    );
    
    // Распределение языков
    const currentCount = this.stats.languageDistribution.get(result.language) || 0;
    this.stats.languageDistribution.set(result.language, currentCount + 1);
  }

  /**
   * Нормализует язык в стандартный формат
   */
  private normalizeLanguage(language: string): 'ru' | 'en' | 'mixed' {
    switch (language.toLowerCase()) {
      case 'russian':
      case 'ru':
        return 'ru';
      case 'english':
      case 'en':
        return 'en';
      default:
        return 'mixed';
    }
  }

  /**
   * Валидирует Python окружение
   */
  private async validateEnvironment(): Promise<void> {
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, ['--version'], { stdio: 'pipe' });
      
      python.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python environment validation failed (code ${code})`));
        }
      });
      
      python.on('error', (error) => {
        reject(new Error(`Python not found: ${error.message}`));
      });
    });
  }

  /**
   * Тестирует загрузку модели
   */
  private async testModelLoading(): Promise<void> {
    // Создаем тестовый аудио файл (тишина)
    const testAudioPath = join(process.cwd(), 'temp', 'test_whisper.wav');
    
    // Простой WAV файл с тишиной (заголовок + 1 секунда тишины)
    const silentWav = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x08, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
      0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x40, 0x1f, 0x00, 0x00, 0x80, 0x3e, 0x00, 0x00,
      0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x08, 0x00, 0x00
    ]);
    
    // Добавляем 1 секунду тишины (16000 сэмплов по 2 байта)
    const silence = Buffer.alloc(32000, 0);
    const testWav = Buffer.concat([silentWav, silence]);
    
    try {
      await writeFile(testAudioPath, testWav);
      
      const result = await this.callWhisperPython(testAudioPath, "Test initialization");
      
      if (result.success) {
        console.log('✅ Whisper model test successful');
      } else {
        throw new Error(result.error || 'Model test failed');
      }
      
    } finally {
      try {
        await unlink(testAudioPath);
      } catch (error) {
        // Игнорируем ошибки удаления
      }
    }
  }

  /**
   * Получить статистику работы
   */
  getStats() {
    return {
      ...this.stats,
      queueSize: this.processingQueue.length,
      isProcessing: this.isProcessing,
      contextSize: this.contextWindow.length,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Очистить контекст
   */
  clearContext(): void {
    this.contextWindow = [];
    console.log('🧹 Whisper context cleared');
  }

  /**
   * Остановить сервис
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down RealWhisperService...');
    
    // Ждем завершения обработки
    while (this.isProcessing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Очищаем очередь
    this.processingQueue.forEach(item => {
      item.reject(new Error('Service shutting down'));
    });
    this.processingQueue = [];
    
    this.contextWindow = [];
    this.isInitialized = false;
    
    console.log('✅ RealWhisperService shutdown completed');
  }
}
