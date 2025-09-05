import React, { useState, useEffect } from "react";
import { ControlPanel, DataWindow } from "./components";
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
  const windowType = urlParams.get('window') || 'control';

  // Состояния UI
  const [isVisible, setIsVisible] = useState(true);
  const [clickThrough, setClickThrough] = useState(false);
  
  // Хуки для функциональности
  const transcription = useTranscription();
  const audioRecording = useAudioRecording();
  
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
      if (data.transcript !== undefined) {
        transcription.setTranscript(data.transcript);
      }
      if (data.partialTranscript !== undefined) {
        transcription.setPartialTranscript(data.partialTranscript);
      }
    },
    onInsightsUpdate: (newInsights) => {
      transcription.setInsights(newInsights);
    },
    onRecordingStateChange: (recordingState) => {
      transcription.setIsRecording(recordingState);
    }
  });

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