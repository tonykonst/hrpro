// Transcript Logger - сохранение всей транскрипции в локальные файлы
// Для отладки качества ASR и анализа улучшений

// Browser-compatible imports
let fs: any;
let path: any;

// Dynamic imports for Node.js modules (only in Electron main process)
try {
  if (typeof window !== 'undefined' && (window as any).require) {
    fs = (window as any).require('fs');
    path = (window as any).require('path');
  } else if (typeof require !== 'undefined') {
    fs = require('fs');
    path = require('path');
  }
} catch (error) {
  console.warn('⚠️ Node.js modules not available, transcript logger will use fallback mode');
}

export interface TranscriptEntry {
  timestamp: number;
  type: 'partial' | 'final' | 'corrected';
  text: string;
  confidence: number;
  segment_id?: string;
  original_text?: string;
  language?: string;
  session_id: string;
}

export interface SessionMetadata {
  session_id: string;
  start_time: number;
  end_time?: number;
  total_segments: number;
  avg_confidence: number;
  language_distribution: Record<string, number>;
  corrections_count: number;
}

export class TranscriptLogger {
  private logsDir: string;
  private currentSessionId: string;
  private sessionStartTime: number;
  private transcriptEntries: TranscriptEntry[] = [];
  private sessionMetadata: SessionMetadata;

  constructor(baseDir: string = './logs') {
    if (!this.isFileSystemAvailable()) {
      console.warn('📝 Transcript logger running in memory-only mode (file system not available)');
      this.logsDir = baseDir;
      this.startNewSession();
      return;
    }
    
    this.logsDir = path.resolve(baseDir);
    this.ensureLogsDirectory();
    this.startNewSession();
  }

  private isFileSystemAvailable(): boolean {
    return !!(fs && path);
  }

  private ensureLogsDirectory(): void {
    if (!this.isFileSystemAvailable()) return;
    
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
      console.log('📁 Created transcript logs directory:', this.logsDir);
    }
  }

  private startNewSession(): void {
    this.currentSessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.transcriptEntries = [];
    
    this.sessionMetadata = {
      session_id: this.currentSessionId,
      start_time: this.sessionStartTime,
      total_segments: 0,
      avg_confidence: 0,
      language_distribution: {},
      corrections_count: 0
    };

    console.log('📝 Started new transcript session:', this.currentSessionId);
  }

  private generateSessionId(): string {
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // 2024-01-15
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // 14-30-45
    return `session_${date}_${time}`;
  }

  // Логирование транскрипции
  logTranscript(entry: Omit<TranscriptEntry, 'session_id'>): void {
    const fullEntry: TranscriptEntry = {
      ...entry,
      session_id: this.currentSessionId
    };

    this.transcriptEntries.push(fullEntry);
    this.updateSessionMetadata(fullEntry);

    // Сохраняем в реальном времени для отладки
    this.appendToMarkdownFile(fullEntry);

    console.log('📝 Logged transcript:', {
      type: entry.type,
      text: entry.text.substring(0, 50) + (entry.text.length > 50 ? '...' : ''),
      confidence: entry.confidence
    });
  }

  // Обновление метаданных сессии
  private updateSessionMetadata(entry: TranscriptEntry): void {
    this.sessionMetadata.total_segments++;
    
    // Обновляем среднюю уверенность
    const prevAvg = this.sessionMetadata.avg_confidence;
    const count = this.sessionMetadata.total_segments;
    this.sessionMetadata.avg_confidence = (prevAvg * (count - 1) + entry.confidence) / count;

    // Обновляем распределение языков
    if (entry.language) {
      this.sessionMetadata.language_distribution[entry.language] = 
        (this.sessionMetadata.language_distribution[entry.language] || 0) + 1;
    }

    // Считаем коррекции
    if (entry.type === 'corrected') {
      this.sessionMetadata.corrections_count++;
    }
  }

  // Добавление записи в MD файл
  private appendToMarkdownFile(entry: TranscriptEntry): void {
    if (!this.isFileSystemAvailable()) {
      // В fallback режиме просто логируем в консоль
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      if (entry.type === 'corrected') {
        console.log(`📝 ${timestamp} [CORRECTED] ${entry.original_text} → ${entry.text}`);
      } else {
        console.log(`📝 ${timestamp} [${entry.type.toUpperCase()}] ${entry.text} (conf: ${entry.confidence.toFixed(2)})`);
      }
      return;
    }

    const mdPath = path.join(this.logsDir, `${this.currentSessionId}.md`);
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    
    let mdEntry = '';

    if (entry.type === 'partial') {
      mdEntry = `**${timestamp}** *(partial, conf: ${entry.confidence.toFixed(2)})* - ${entry.text}\n\n`;
    } else if (entry.type === 'final') {
      mdEntry = `**${timestamp}** *(final, conf: ${entry.confidence.toFixed(2)})* - **${entry.text}**\n\n`;
    } else if (entry.type === 'corrected') {
      mdEntry = `**${timestamp}** *(corrected)* - ~~${entry.original_text}~~ → **${entry.text}** ✨\n\n`;
    }

    // Создаем файл с заголовком если его нет
    if (!fs.existsSync(mdPath)) {
      const header = this.generateMarkdownHeader();
      fs.writeFileSync(mdPath, header);
    }

    // Добавляем запись
    fs.appendFileSync(mdPath, mdEntry);
  }

  // Генерация заголовка MD файла
  private generateMarkdownHeader(): string {
    const date = new Date(this.sessionStartTime).toLocaleString();
    return `# Transcript Session: ${this.currentSessionId}

**Started:** ${date}  
**Session ID:** \`${this.currentSessionId}\`

## Live Transcript

`;
  }

  // Завершение сессии и сохранение финального отчета
  endSession(): void {
    this.sessionMetadata.end_time = Date.now();
    const duration = (this.sessionMetadata.end_time - this.sessionStartTime) / 1000 / 60; // минуты

    if (this.isFileSystemAvailable()) {
      // Добавляем статистику в конец MD файла
      const mdPath = path.join(this.logsDir, `${this.currentSessionId}.md`);
      const stats = this.generateSessionStats(duration);
      
      fs.appendFileSync(mdPath, stats);

      // Сохраняем JSON метаданные отдельно
      const jsonPath = path.join(this.logsDir, `${this.currentSessionId}_metadata.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(this.sessionMetadata, null, 2));
    }

    console.log('📊 Session ended and saved:', {
      session_id: this.currentSessionId,
      duration_minutes: duration.toFixed(1),
      total_segments: this.sessionMetadata.total_segments,
      avg_confidence: this.sessionMetadata.avg_confidence.toFixed(3),
      corrections: this.sessionMetadata.corrections_count,
      files_saved: this.isFileSystemAvailable() ? 'yes' : 'memory-only'
    });

    // Готовимся к новой сессии
    this.startNewSession();
  }

  // Генерация статистики сессии
  private generateSessionStats(durationMinutes: number): string {
    const stats = `

---

## Session Statistics

**Duration:** ${durationMinutes.toFixed(1)} minutes  
**Total Segments:** ${this.sessionMetadata.total_segments}  
**Average Confidence:** ${this.sessionMetadata.avg_confidence.toFixed(3)}  
**Corrections Applied:** ${this.sessionMetadata.corrections_count}  
**Correction Rate:** ${(this.sessionMetadata.corrections_count / this.sessionMetadata.total_segments * 100).toFixed(1)}%

### Language Distribution
${Object.entries(this.sessionMetadata.language_distribution)
  .map(([lang, count]) => `- **${lang}:** ${count} segments (${(count / this.sessionMetadata.total_segments * 100).toFixed(1)}%)`)
  .join('\n')}

### Quality Metrics
- **Segments per minute:** ${(this.sessionMetadata.total_segments / durationMinutes).toFixed(1)}
- **High confidence (>0.9):** ${this.getHighConfidencePercentage().toFixed(1)}%
- **Low confidence (<0.7):** ${this.getLowConfidencePercentage().toFixed(1)}%

### Files Generated
- Transcript: \`${this.currentSessionId}.md\`
- Metadata: \`${this.currentSessionId}_metadata.json\`
- Raw entries: ${this.transcriptEntries.length} records

---
*Generated by Transcript Logger on ${new Date().toLocaleString()}*
`;

    return stats;
  }

  // Вспомогательные методы для статистики
  private getHighConfidencePercentage(): number {
    const highConfidenceCount = this.transcriptEntries.filter(e => e.confidence > 0.9).length;
    return (highConfidenceCount / this.transcriptEntries.length) * 100;
  }

  private getLowConfidencePercentage(): number {
    const lowConfidenceCount = this.transcriptEntries.filter(e => e.confidence < 0.7).length;
    return (lowConfidenceCount / this.transcriptEntries.length) * 100;
  }

  // Получение текущей статистики (для отладки)
  getCurrentStats(): {
    session_id: string,
    entries_count: number,
    avg_confidence: number,
    duration_minutes: number,
    corrections_count: number
  } {
    const duration = (Date.now() - this.sessionStartTime) / 1000 / 60;
    
    return {
      session_id: this.currentSessionId,
      entries_count: this.transcriptEntries.length,
      avg_confidence: this.sessionMetadata.avg_confidence,
      duration_minutes: duration,
      corrections_count: this.sessionMetadata.corrections_count
    };
  }

  // Экспорт полного транскрипта как текста
  exportFullTranscript(): string {
    return this.transcriptEntries
      .filter(entry => entry.type === 'final' || entry.type === 'corrected')
      .map(entry => {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        if (entry.type === 'corrected') {
          return `[${time}] ${entry.text} (corrected from: "${entry.original_text}")`;
        }
        return `[${time}] ${entry.text}`;
      })
      .join('\n');
  }

  // Очистка старых логов (оставляем последние N сессий)
  cleanupOldLogs(keepLastN: number = 10): void {
    if (!this.isFileSystemAvailable()) {
      console.log('🧹 Cleanup skipped (file system not available)');
      return;
    }

    try {
      const files = fs.readdirSync(this.logsDir)
        .filter(file => file.startsWith('session_') && file.endsWith('.md'))
        .sort()
        .reverse(); // Новые файлы сначала

      const filesToDelete = files.slice(keepLastN);
      
      filesToDelete.forEach(file => {
        const mdPath = path.join(this.logsDir, file);
        const jsonPath = path.join(this.logsDir, file.replace('.md', '_metadata.json'));
        
        if (fs.existsSync(mdPath)) fs.unlinkSync(mdPath);
        if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      });

      if (filesToDelete.length > 0) {
        console.log(`🧹 Cleaned up ${filesToDelete.length} old transcript sessions`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old logs:', error);
    }
  }
}

// Singleton instance для глобального использования
let globalTranscriptLogger: TranscriptLogger | null = null;

export const getTranscriptLogger = (): TranscriptLogger => {
  if (!globalTranscriptLogger) {
    const logsDir = path.join(process.cwd(), 'transcript-logs');
    globalTranscriptLogger = new TranscriptLogger(logsDir);
  }
  return globalTranscriptLogger;
};

export const endCurrentSession = (): void => {
  if (globalTranscriptLogger) {
    globalTranscriptLogger.endSession();
  }
};
