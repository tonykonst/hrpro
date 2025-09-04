import React from 'react';

interface StartScreenProps {
  hasPermission: boolean | null;
  onStartRecording: () => void;
  onCheckMicPermission: () => void;
}

export function StartScreen({ hasPermission, onStartRecording, onCheckMicPermission }: StartScreenProps) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="control-panel">
        {/* Actions section */}
        <div className="control-panel__actions">
          {/* Start button */}
          <button
            onClick={hasPermission ? onStartRecording : onCheckMicPermission}
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
