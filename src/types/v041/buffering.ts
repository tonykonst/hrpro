// v0.41 - High-Accuracy Transcription Types

export interface SmartBuffer {
  id: string;
  audioData: Float32Array;
  startTime: number;
  endTime: number;
  duration: number;
  overlapWith: string[];
  transcription?: TranscriptionResult;
  isProcessed: boolean;
  confidence?: number;
}

export interface BufferConfig {
  // Основные параметры
  baseWindowSize: number;      // 30 секунд (больше для контекста)
  overlapSize: number;         // 8 секунд (большое перекрытие)
  
  // Адаптивные параметры
  adaptToSpeechRate: boolean;  // Подстройка под скорость речи
  extendOnActiveSpeech: boolean; // Не резать посреди фразы
  
  // Детекция границ
  silenceThreshold: number;    // 0.5 секунд тишины для сегментации
  energyThreshold: number;     // 0.1 энергия сигнала
  
  // VAD с упреждением
  preSpeechBuffer: number;     // 0.5с до начала речи
  postSpeechBuffer: number;    // 1.0с после окончания речи
}

export interface SpeechSegment {
  start: number;
  end: number;
  confidence: number;
  audioData: Float32Array;
  hasPreSpeech: boolean;
  hasPostSpeech: boolean;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  wordTimestamps: WordTimestamp[];
  language: 'ru' | 'en' | 'mixed';
  isDraft: boolean;
  processingTime: number;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface BufferOverlap {
  buffer1Id: string;
  buffer2Id: string;
  overlapStart: number;
  overlapEnd: number;
  overlapDuration: number;
  wordMatches: WordMatch[];
}

export interface WordMatch {
  word: string;
  buffer1Position: number;
  buffer2Position: number;
  confidence: number;
  isConflict: boolean;
}

export interface QualityMetrics {
  wordsPerMinute: number;
  correctionRate: number;
  confidenceScore: number;
  languageSwitches: number;
  technicalTermsDetected: number;
  bufferOverlapQuality: number;
  lostWordsPrevented: number;
}

export interface VADResult {
  isSpeech: boolean;
  confidence: number;
  energyLevel: number;
  speechStart?: number;
  speechEnd?: number;
  preSpeechDetected: boolean;
}
