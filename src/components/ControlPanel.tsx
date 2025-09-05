import React from 'react';
import { WaveLoader } from './WaveLoader';
import { LegacyInsight } from '../types/events';

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
          <div className="control-panel control-panel--recording">
            {/* Actions section */}
            <div className="control-panel__actions">
              {/* Stop button */}
              <button
                onClick={onStopRecording}
                className="stop-button"
                style={{WebkitAppRegion: 'no-drag'} as any}
              >
                <div className="stop-button__icon"></div>
              </button>
              
              {/* Wave Loader Recording indicator */}
              <WaveLoader 
                isActive={true}
                audioLevel={audioLevel}
                className="wave-loader--recording"
              />
            </div>
            
            {/* Separator */}
            <div className="control-panel__separator"></div>
            
            {/* Drag zone */}
            <div 
              className="control-panel__drag-zone"
              style={{WebkitAppRegion: 'drag'} as any}
            >
              <div className="drag-dots">
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
                <div className="drag-dots__dot"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="recording-screen__content">
          {/* Transcript section */}
          <div className="transcript-section">
            <div className="transcript-section__header">
              <h3>Transcript</h3>
            </div>
            <div className="transcript-section__content">
              {transcript ? (
                <div className="transcript-text">
                  {transcript}
                  {partialTranscript && (
                    <span className="transcript-text--partial">
                      {partialTranscript}
                    </span>
                  )}
                </div>
              ) : (
                <div className="transcript-placeholder">
                  {partialTranscript || 'Start speaking to see transcript...'}
                </div>
              )}
            </div>
          </div>

          {/* Insights section */}
          {insights.length > 0 && (
            <div className="insights-section">
              <div className="insights-section__header">
                <h3>Insights</h3>
              </div>
              <div className="insights-section__content">
                {insights.map((insight) => (
                  <div 
                    key={insight.id} 
                    className={`insight insight--${insight.type}`}
                  >
                    {insight.text}
                  </div>
                ))}
              </div>
            </div>
          )}
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
          {/* Start button */}
          <button
            onMouseEnter={() => console.log('🖱️ [ControlPanel] Start button mouse enter')}
            onMouseLeave={() => console.log('🖱️ [ControlPanel] Start button mouse leave')}
            onClick={() => {
              console.log('🖱️ [ControlPanel] Start button clicked:', {
                hasPermission,
                hasOnStartRecording: typeof onStartRecording === 'function',
                hasOnCheckMicPermission: typeof onCheckMicPermission === 'function'
              });
              if (hasPermission) {
                console.log('🎬 [ControlPanel] Calling onStartRecording...');
                onStartRecording();
              } else {
                console.log('🎤 [ControlPanel] Calling onCheckMicPermission...');
                onCheckMicPermission();
              }
            }}
            className="start-button"
            style={{WebkitAppRegion: 'no-drag'} as any}
          >
            {/* Play icon */}
            <div className="start-button__icon">
              <div className="start-button__icon-rect"></div>
              <svg className="start-button__icon-svg" viewBox="0 0 8 10" fill="none">
                <ellipse cx="4" cy="8" rx="4" ry="2" stroke="white" strokeWidth="1.4"/>
              </svg>
            </div>
            <span>{hasPermission ? 'Start' : 'Allow Mic'}</span>
          </button>
        </div>
        
        {/* Separator */}
        <div className="control-panel__separator"></div>
        
        {/* Drag zone - простая перетаскиваемая область */}
        <div 
          className="control-panel__drag-zone"
          style={{WebkitAppRegion: 'drag'} as any}
        >
          {/* Drag dots */}
          <div className="drag-dots">
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
            <div className="drag-dots__dot"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
