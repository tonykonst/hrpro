import React from 'react';
import { StopButton } from './StopButton';
import { DragZone } from './DragZone';
import { WaveLoader } from '../common/WaveLoader';

/**
 * Props for RecordingControls component
 */
interface RecordingControlsProps {
  /** Stop recording handler */
  onStopRecording: () => void;
  /** Current audio level for visualization */
  audioLevel: number;
}

/**
 * Recording controls component for the recording state
 * 
 * @example
 * ```tsx
 * <RecordingControls 
 *   onStopRecording={handleStop}
 *   audioLevel={0.5}
 * />
 * ```
 */
export const RecordingControls: React.FC<RecordingControlsProps> = ({ 
  onStopRecording, 
  audioLevel 
}) => {
  return (
    <div className="control-panel control-panel--recording">
      {/* Actions section */}
      <div className="control-panel__actions">
        <StopButton onStopRecording={onStopRecording} />
        
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
      <DragZone />
    </div>
  );
};
