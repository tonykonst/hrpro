import React from 'react';

/**
 * Props for Transcript component
 */
interface TranscriptProps {
  /** Main transcript text */
  transcript: string;
  /** Partial transcript text (interim results) */
  partialTranscript: string;
  /** Additional CSS class */
  className?: string;
}

/**
 * Reusable Transcript component for displaying speech-to-text results
 * 
 * @example
 * ```tsx
 * <Transcript 
 *   transcript="Hello world" 
 *   partialTranscript="how are you"
 *   className="transcript-content"
 * />
 * ```
 */
export const Transcript: React.FC<TranscriptProps> = ({ 
  transcript, 
  partialTranscript, 
  className = 'transcript-content' 
}) => {
  return (
    <div className={className}>
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
          {partialTranscript || 'No transcript yet...'}
        </div>
      )}
    </div>
  );
};
