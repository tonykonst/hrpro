import { useState } from 'react';
import { LegacyInsight } from '../types/events';

/**
 * Хук для управления состояниями записи
 * Централизует все состояния связанные с записью и транскрипцией
 */
export const useRecordingState = () => {
  // Основные состояния записи
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  // Состояния транскрипции
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  
  // Состояния инсайтов
  const [insights, setInsights] = useState<Array<LegacyInsight>>([]);
  
  // Дополнительные состояния (пока не используются в UI, но есть в коде)
  const [fullTranscript, setFullTranscript] = useState<string>('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [correctedSegments, setCorrectedSegments] = useState<Map<string, string>>(new Map());
  const [lastCorrectionTime, setLastCorrectionTime] = useState<number>(0);

  return {
    // Основные состояния
    isRecording,
    setIsRecording,
    hasPermission,
    setHasPermission,
    
    // Транскрипция
    transcript,
    setTranscript,
    partialTranscript,
    setPartialTranscript,
    
    // Инсайты
    insights,
    setInsights,
    
    // Дополнительные состояния (для совместимости)
    fullTranscript,
    setFullTranscript,
    showTranscript,
    setShowTranscript,
    correctedSegments,
    setCorrectedSegments,
    lastCorrectionTime,
    setLastCorrectionTime,
  };
};
