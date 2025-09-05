import React from 'react';
import { LegacyInsight } from '../../types/events';
import { StartButton } from './StartButton';
import { RecordingControls } from './RecordingControls';
import { DragZone } from './DragZone';
import { TranscriptSection } from '../data/TranscriptSection';
import { InsightsSection } from '../data/InsightsSection';

/**
 * Props for ControlPanel component
 */
interface ControlPanelProps {
  // Состояния
  isRecording: boolean;
  hasPermission: boolean | null;
  transcript: string;
  partialTranscript: string;
  insights: LegacyInsight[];
  audioLevel: number;
  isVisible: boolean;
  clickThrough: boolean;
  
  // Методы
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCheckMicPermission: () => void;
  lastCorrectionTime?: number;
}

/**
 * Main control panel component for the interview assistant
 * 
 * @example
 * ```tsx
 * <ControlPanel
 *   isRecording={false}
 *   hasPermission={true}
 *   transcript=""
 *   partialTranscript=""
 *   insights={[]}
 *   audioLevel={0}
 *   isVisible={true}
 *   clickThrough={false}
 *   onStartRecording={handleStart}
 *   onStopRecording={handleStop}
 *   onCheckMicPermission={handlePermission}
 * />
 * ```
 */
export function ControlPanel({
  isRecording,
  hasPermission,
  transcript,
  partialTranscript,
  insights,
  audioLevel,
  isVisible,
  clickThrough,
  onStartRecording,
  onStopRecording,
  onCheckMicPermission,
  lastCorrectionTime
}: ControlPanelProps) {
  console.log('🎨 [ControlPanel] Rendering with props:', {
    isRecording,
    hasPermission,
    isVisible,
    hasOnStartRecording: typeof onStartRecording === 'function',
    hasOnCheckMicPermission: typeof onCheckMicPermission === 'function'
  });

  const [showCorrectionFlash, setShowCorrectionFlash] = React.useState(false);

  // Эффект для анимации исправлений
  React.useEffect(() => {
    if (lastCorrectionTime && lastCorrectionTime > Date.now() - 5000) {
      setShowCorrectionFlash(true);
      const timer = setTimeout(() => setShowCorrectionFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastCorrectionTime]);

  // Если не видимый, не рендерим
  if (!isVisible) {
    return null;
  }

  // Если запись идет, показываем экран записи
  if (isRecording) {
    return (
      <div className="recording-screen">
        {/* Top panel - recording controls */}
        <div className="recording-screen__header">
          <RecordingControls 
            onStopRecording={onStopRecording}
            audioLevel={audioLevel}
          />
        </div>

        {/* Main content area */}
        <div className="recording-screen__content">
          <TranscriptSection 
            transcript={transcript} 
            partialTranscript={partialTranscript} 
          />
          <InsightsSection insights={insights} />
        </div>
      </div>
    );
  }

  // Если не записываем, показываем стартовый экран
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="control-panel">
        {/* Actions section */}
        <div className="control-panel__actions">
          <StartButton 
            hasPermission={hasPermission || false}
            onStartRecording={onStartRecording}
            onCheckMicPermission={onCheckMicPermission}
          />
        </div>
        
        {/* Separator */}
        <div className="control-panel__separator"></div>
        
        {/* Drag zone */}
        <DragZone />
      </div>
    </div>
  );
}
