import React from 'react';

/**
 * Props for DataWindowHeader component
 */
interface DataWindowHeaderProps {
  /** Whether recording is active */
  isRecording: boolean;
}

/**
 * Header component for the data window
 * 
 * @example
 * ```tsx
 * <DataWindowHeader isRecording={true} />
 * ```
 */
export const DataWindowHeader: React.FC<DataWindowHeaderProps> = ({ isRecording }) => {
  return (
    <div className="data-window__header">
      <h2>Interview Assistant</h2>
      <div className={`recording-indicator ${isRecording ? 'recording-indicator--active' : ''}`}>
        {isRecording ? '● Recording' : '○ Stopped'}
      </div>
    </div>
  );
};
