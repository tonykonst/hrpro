import React from 'react';
import { WaveLoader } from './common/WaveLoader';
import { LegacyInsight } from '../types/events';

interface RecordingScreenProps {
  transcript: string;
  partialTranscript: string;
  insights: LegacyInsight[];
  audioLevel: number;
  onStopRecording: () => void;
  lastCorrectionTime?: number; // Для анимации исправлений
}

export function RecordingScreen({ 
  transcript, 
  partialTranscript, 
  insights, 
  audioLevel, 
  onStopRecording,
  lastCorrectionTime
}: RecordingScreenProps) {
  const [showCorrectionFlash, setShowCorrectionFlash] = React.useState(false);

  // Эффект для анимации исправлений
  React.useEffect(() => {
    if (lastCorrectionTime && lastCorrectionTime > Date.now() - 5000) {
      setShowCorrectionFlash(true);
      const timer = setTimeout(() => setShowCorrectionFlash(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastCorrectionTime]);
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
          
          {/* Drag zone - вся эта область перетаскиваемая */}
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
      
      {/* Content panel */}
      <div className="content-panel">
        {/* Transcript section */}
        <div className="content-section">
          <h3 className="content-section__title">Transcript</h3>
          <div className="content-section__content">
            {transcript && (
              <p className={`transcript-text ${showCorrectionFlash ? 'transcript-text--corrected' : ''}`}>
                {transcript}
              </p>
            )}
            {partialTranscript && <p className="transcript-text transcript-text--partial">{partialTranscript}</p>}
            {!transcript && !partialTranscript && (
              <p className="transcript-text transcript-text--placeholder">Listening...</p>
            )}
          </div>
        </div>
        
        {/* Insights section */}
        <div className="content-section">
          <h3 className="content-section__title">Insights</h3>
          <div className="content-section__content">
            {insights.length > 0 ? (
              insights.slice(-3).map((insight) => (
                <div key={insight.id} className="insight-item">
                  {insight.text}
                </div>
              ))
            ) : (
              <p className="insight-placeholder">No insights yet...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
