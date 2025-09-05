import { useTranscriptionState } from './useTranscriptionState';
import { useTranscriptionServices } from './useTranscriptionServices';
import { useTranscriptionCallbacks } from './useTranscriptionCallbacks';
import { useTranscriptionCore } from './useTranscriptionCore';
import { useTranscriptionRecording } from './useTranscriptionRecording';
import { useAudioAnalyser } from '../useAudioAnalyser';
import { LegacyInsight } from '../../types/events';

/**
 * Main transcription hook that manages speech-to-text and AI analysis
 * 
 * @example
 * ```tsx
 * const transcription = useTranscription();
 * 
 * // Start recording
 * await transcription.startRecording();
 * 
 * // Stop recording
 * transcription.stopRecording();
 * 
 * // Access transcript
 * console.log(transcription.transcript);
 * ```
 * 
 * @returns {UseTranscriptionReturn} Transcription state and methods
 */
export const useTranscription = () => {
  // State management
  const state = useTranscriptionState();
  
  // Service references
  const services = useTranscriptionServices();
  
  // Audio analyser
  const { audioLevel, initAudioAnalyser, stopAudioAnalyser } = useAudioAnalyser();
  
  // Callbacks
  const callbacks = useTranscriptionCallbacks({
    setTranscript: state.setTranscript,
    setPartialTranscript: state.setPartialTranscript,
    setInsights: state.setInsights,
    deepgramRef: services.deepgramRef,
    claudeRef: services.claudeRef,
    analysisContextRef: services.analysisContextRef
  });
  
  // Core functionality
  const core = useTranscriptionCore({
    deepgramRef: services.deepgramRef,
    claudeRef: services.claudeRef,
    analysisContextRef: services.analysisContextRef,
    cleanupRef: services.cleanupRef,
    handleTranscriptEvent: callbacks.handleTranscriptEvent
  });
  
  // Recording functionality
  const recording = useTranscriptionRecording({
    streamRef: services.streamRef,
    audioContextRef: services.audioContextRef,
    processorRef: services.processorRef,
    cleanupRef: services.cleanupRef,
    deepgramRef: services.deepgramRef,
    setIsRecording: state.setIsRecording,
    initAudioAnalyser,
    stopAudioAnalyser,
    connectToDeepgram: core.connectToDeepgram
  });

  return {
    // Состояния
    transcript: state.transcript,
    partialTranscript: state.partialTranscript,
    insights: state.insights,
    isRecording: state.isRecording,
    audioLevel,
    
    // Методы
    setTranscript: state.setTranscript,
    setPartialTranscript: state.setPartialTranscript,
    setInsights: state.setInsights,
    setIsRecording: state.setIsRecording,
    
    // Основные функции
    startRecording: recording.startRecording,
    stopRecording: recording.stopRecording,
    connectToDeepgram: core.connectToDeepgram,
    analyzeWithClaude: callbacks.analyzeWithClaude
  };
};

export interface UseTranscriptionReturn {
  // Состояния
  transcript: string;
  partialTranscript: string;
  insights: LegacyInsight[];
  isRecording: boolean;
  audioLevel: number;
  
  // Методы
  setTranscript: (transcript: string) => void;
  setPartialTranscript: (partialTranscript: string) => void;
  setInsights: (insights: LegacyInsight[]) => void;
  setIsRecording: (isRecording: boolean) => void;
  
  // Основные функции
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  connectToDeepgram: () => Promise<() => void>;
  analyzeWithClaude: (newText: string) => Promise<void>;
}
