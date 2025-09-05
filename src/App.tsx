import React, { useState, useEffect } from "react";
import { ControlPanel, DataWindow } from "./components";
import { useAudioAnalyser } from "./hooks/useAudioAnalyser";
import { useWindowManager } from "./hooks/useWindowManager";
import { useDataSync } from "./hooks/useDataSync";
import { useTranscription } from "./hooks/useTranscription";
import { useAudioRecording } from "./hooks/useAudioRecording";

// Типы для IPC - теперь используется безопасный electronAPI
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<any>;
      sendTranscript: (data: any) => Promise<any>;
      sendInsights: (data: any) => Promise<any>;
      sendRecordingState: (data: any) => Promise<any>;
      createDataWindow: () => Promise<any>;
      closeDataWindow: () => Promise<any>;
      onTranscriptUpdate: (callback: (data: any) => void) => void;
      onInsightsUpdate: (callback: (data: any) => void) => void;
      onRecordingStateChange: (callback: (data: any) => void) => void;
      onWindowCreated: (callback: (windowId: string) => void) => void;
      onWindowClosed: (callback: (windowId: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

export function App() {
  // Определяем тип окна из URL параметров
  const urlParams = new URLSearchParams(window.location.search);
  const windowType = urlParams.get('window') || 'control'; // 'control' или 'data'
  
  // Логирование для отладки
  console.log('🚀 [App] App component initialized:', { windowType, timestamp: new Date().toISOString() });

  // Состояния UI
  const [isVisible, setIsVisible] = useState(true);
  const [clickThrough, setClickThrough] = useState(false);
  
  // Хуки для функциональности
  console.log('🔧 [App] Initializing hooks...');
  const transcription = useTranscription();
  const audioRecording = useAudioRecording();
  console.log('✅ [App] Hooks initialized:', {
    hasStartRecording: typeof transcription.startRecording === 'function',
    hasStopRecording: typeof transcription.stopRecording === 'function',
    isRecording: transcription.isRecording,
    hasPermission: audioRecording.hasPermission
  });

  // Отслеживаем изменения hasPermission
  useEffect(() => {
    console.log('🔄 [App] hasPermission changed:', audioRecording.hasPermission);
  }, [audioRecording.hasPermission]);
  
  // Window manager hook
  const { createDataWindow, closeDataWindow } = useWindowManager({
    windowType: windowType as 'control' | 'data',
    isRecording: transcription.isRecording,
    onError: (error) => console.error('Window manager error:', error)
  });

  // Data sync hook
  useDataSync({
    windowType: windowType as 'control' | 'data',
    transcript: transcription.transcript,
    partialTranscript: transcription.partialTranscript,
    insights: transcription.insights,
    isRecording: transcription.isRecording,
    onTranscriptUpdate: (data) => {
      console.log('📝 [App] onTranscriptUpdate called with:', data);
      console.log('📝 [App] Current window type:', windowType);
      if (data.transcript !== undefined) {
        console.log('📝 [App] Setting transcript:', data.transcript);
        transcription.setTranscript(data.transcript);
      }
      if (data.partialTranscript !== undefined) {
        console.log('📝 [App] Setting partialTranscript:', data.partialTranscript);
        transcription.setPartialTranscript(data.partialTranscript);
      }
    },
    onInsightsUpdate: (newInsights) => {
      console.log('🤖 [App] onInsightsUpdate called with:', newInsights);
      transcription.setInsights(newInsights);
    },
    onRecordingStateChange: (recordingState) => {
      console.log('🎤 [App] onRecordingStateChange called with:', recordingState);
      transcription.setIsRecording(recordingState);
    }
  });

  // Audio analyser cleanup is now handled in useTranscription hook

  useEffect(() => {
    console.log('🚀 App component mounted');
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        setIsVisible(!isVisible);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
        setClickThrough(!clickThrough);
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [isVisible, clickThrough]);

  // Check microphone permission on mount
  useEffect(() => {
    console.log('🎤 [App] Initial microphone permission check...');
    audioRecording.checkMicPermission().catch(error => {
      console.warn('⚠️ [App] Mic permission check failed:', error);
    });
  }, [audioRecording.checkMicPermission]);

  // Render based on window type
  if (windowType === 'data') {
    return (
      <DataWindow
        transcript={transcription.transcript}
        partialTranscript={transcription.partialTranscript}
        insights={transcription.insights}
        isRecording={transcription.isRecording}
      />
    );
  }

  return (
    <ControlPanel
      isRecording={transcription.isRecording}
      hasPermission={audioRecording.hasPermission}
      transcript={transcription.transcript}
      partialTranscript={transcription.partialTranscript}
      insights={transcription.insights}
      audioLevel={transcription.audioLevel}
      isVisible={isVisible}
      clickThrough={clickThrough}
      onStartRecording={transcription.startRecording}
      onStopRecording={transcription.stopRecording}
      onCheckMicPermission={audioRecording.checkMicPermission}
    />
  );
}