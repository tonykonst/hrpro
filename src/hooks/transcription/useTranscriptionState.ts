import { useState, useCallback } from 'react';
import { LegacyInsight } from '../../types/events';

/**
 * State management for transcription hook
 * 
 * @example
 * ```tsx
 * const transcriptionState = useTranscriptionState();
 * ```
 */
export const useTranscriptionState = () => {
  // Состояния транскрипции
  const [transcript, setTranscriptState] = useState<string>('');
  const [partialTranscript, setPartialTranscriptState] = useState<string>('');
  const [insights, setInsightsState] = useState<LegacyInsight[]>([]);
  const [isRecording, setIsRecordingState] = useState<boolean>(false);

  // Обертки для сеттеров с поддержкой функций
  const setTranscript = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      setTranscriptState(value);
    } else {
      setTranscriptState(value);
    }
  }, []);

  const setPartialTranscript = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      setPartialTranscriptState(value);
    } else {
      setPartialTranscriptState(value);
    }
  }, []);

  const setInsights = useCallback((value: LegacyInsight[] | ((prev: LegacyInsight[]) => LegacyInsight[])) => {
    if (typeof value === 'function') {
      setInsightsState(value);
    } else {
      setInsightsState(value);
    }
  }, []);

  const setIsRecording = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === 'function') {
      setIsRecordingState(value);
    } else {
      setIsRecordingState(value);
    }
  }, []);

  return {
    // Состояния
    transcript,
    partialTranscript,
    insights,
    isRecording,
    
    // Сеттеры
    setTranscript,
    setPartialTranscript,
    setInsights,
    setIsRecording
  };
};
