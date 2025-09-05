import React from 'react';
import { Button } from '../ui/Button';

/**
 * Props for StartButton component
 */
interface StartButtonProps {
  /** Whether microphone permission is granted */
  hasPermission: boolean;
  /** Start recording handler */
  onStartRecording: () => void;
  /** Check microphone permission handler */
  onCheckMicPermission: () => void;
}

/**
 * Start button component for initiating recording
 * 
 * @example
 * ```tsx
 * <StartButton 
 *   hasPermission={true}
 *   onStartRecording={handleStart}
 *   onCheckMicPermission={handlePermission}
 * />
 * ```
 */
export const StartButton: React.FC<StartButtonProps> = ({ 
  hasPermission, 
  onStartRecording, 
  onCheckMicPermission 
}) => {
  const handleClick = () => {
    console.log('🖱️ [StartButton] Button clicked:', {
      hasPermission,
      hasOnStartRecording: typeof onStartRecording === 'function',
      hasOnCheckMicPermission: typeof onCheckMicPermission === 'function'
    });
    
    if (hasPermission) {
      console.log('🎬 [StartButton] Calling onStartRecording...');
      onStartRecording();
    } else {
      console.log('🎤 [StartButton] Calling onCheckMicPermission...');
      onCheckMicPermission();
    }
  };

  const handleMouseEnter = () => {
    console.log('🖱️ [StartButton] Mouse enter');
  };

  const handleMouseLeave = () => {
    console.log('🖱️ [StartButton] Mouse leave');
  };

  return (
    <Button
      variant="start"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Play icon */}
      <div className="start-button__icon">
        <div className="start-button__icon-rect"></div>
        <svg className="start-button__icon-svg" viewBox="0 0 8 10" fill="none">
          <ellipse cx="4" cy="8" rx="4" ry="2" stroke="white" strokeWidth="1.4"/>
        </svg>
      </div>
      <span>{hasPermission ? 'Start' : 'Allow Mic'}</span>
    </Button>
  );
};
