// Event Types for Interview Assistant
// Centralizes all event interfaces used across the application

// UI State Events
export interface AppState {
  isVisible: boolean;
  clickThrough: boolean;
  isRecording: boolean;
  hasPermission: boolean | null;
  activePanel: 'transcript' | 'insights' | 'settings';
}

// Audio Events
export interface AudioEvent {
  type: 'audio_start' | 'audio_stop' | 'audio_error';
  data?: ArrayBuffer;
  error?: string;
}

// ASR Events (from Deepgram)
export interface ASREvent {
  type: 'asr_partial' | 'asr_final' | 'asr_corrected';
  text: string;
  confidence: number;
  timestamp: number;
  speaker?: 'candidate' | 'hr'; // Future: speaker diarization
  segment_id?: string; // For tracking corrections
  original_text?: string; // Original text before correction
}

// AI Analysis Events
export interface InsightEvent {
  type: 'nlu_insight';
  id: string;
  topic: string;
  depth_score: number;
  signals: string[];
  followups: string[];
  note: string;
  insight_type: 'strength' | 'risk' | 'question';
  confidence: number;
  timestamp: number;
}

// Score Update Events
export interface ScoreEvent {
  type: 'score_update';
  topic: string;
  score: number;
  timestamp: number;
}

// System Events
export interface NoticeEvent {
  type: 'notice';
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

// Session Events
export interface SessionEvent {
  type: 'session_start' | 'session_end' | 'session_pause' | 'session_resume';
  sessionId: string;
  timestamp: number;
  metadata?: {
    jobDescription?: string;
    candidateName?: string;
    interviewerName?: string;
  };
}

// Report Events
export interface ReportEvent {
  type: 'report_generated';
  reportId: string;
  summary: string;
  strengths: string[];
  risks: string[];
  scores: Record<string, number>;
  recommendations: string[];
  timestamp: number;
}

// Union type for all events
export type ApplicationEvent = 
  | AudioEvent
  | ASREvent
  | InsightEvent
  | ScoreEvent
  | NoticeEvent
  | SessionEvent
  | ReportEvent;

// Event Bus Interface
export interface EventHandler<T = ApplicationEvent> {
  (event: T): void;
}

export interface EventBus {
  subscribe<T extends ApplicationEvent>(
    eventType: T['type'],
    handler: EventHandler<T>
  ): () => void; // Returns unsubscribe function
  
  emit<T extends ApplicationEvent>(event: T): void;
  
  clear(): void;
}

// Configuration interfaces
export interface AudioConfig {
  sampleRate: number;
  channels: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

export interface DeepgramConfig {
  apiKey: string;
  model: string;
  language: string;
  punctuation: boolean;
  interim_results: boolean;
  smart_format: boolean;
}

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AppConfig {
  audio: AudioConfig;
  deepgram: DeepgramConfig;
  claude: ClaudeConfig;
  ui: {
    insightFrequencyMs: number;
    minInsightConfidence: number;
    transcriptBufferWords: number;
    defaultActivePanel: 'transcript' | 'insights';
    defaultClickThrough: boolean;
  };
}

// Legacy interface for backward compatibility
export interface LegacyInsight {
  id: string;
  text: string;
  type: 'strength' | 'risk' | 'question';
}
