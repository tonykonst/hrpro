import React from 'react';
import { Button } from '../ui/Button';

/**
 * Props for StopButton component
 */
interface StopButtonProps {
  /** Stop recording handler */
  onStopRecording: () => void;
}

/**
 * Stop button component for stopping recording
 * 
 * @example
 * ```tsx
 * <StopButton onStopRecording={handleStop} />
 * ```
 */
export const StopButton: React.FC<StopButtonProps> = ({ onStopRecording }) => {
  return (
    <Button variant="stop" onClick={onStopRecording}>
      <div className="stop-button__icon"></div>
    </Button>
  );
};
