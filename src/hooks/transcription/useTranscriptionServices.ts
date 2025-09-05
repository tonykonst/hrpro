import { useRef } from 'react';
import { ITranscriptionService } from '../../types/ITranscriptionService';
import { ClaudeAnalysisService, AnalysisContext } from '../../services/claude';

/**
 * Service references for transcription hook
 * 
 * @example
 * ```tsx
 * const services = useTranscriptionServices();
 * ```
 */
export const useTranscriptionServices = () => {
  // Refs для сервисов
  const streamRef = useRef<MediaStream | null>(null);
  const deepgramRef = useRef<ITranscriptionService | null>(null);
  const claudeRef = useRef<ClaudeAnalysisService | null>(null);
  const analysisContextRef = useRef<AnalysisContext | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);

  return {
    streamRef,
    deepgramRef,
    claudeRef,
    analysisContextRef,
    cleanupRef,
    audioContextRef,
    processorRef
  };
};
