import React from 'react';
import { Transcript } from '../ui/Transcript';

/**
 * Props for TranscriptSection component
 */
interface TranscriptSectionProps {
  /** Main transcript text */
  transcript: string;
  /** Partial transcript text (interim results) */
  partialTranscript: string;
  /** Section title */
  title?: string;
}

/**
 * Transcript section component for displaying speech-to-text results
 * 
 * @example
 * ```tsx
 * <TranscriptSection 
 *   transcript="Hello world" 
 *   partialTranscript="how are you"
 *   title="Transcript"
 * />
 * ```
 */
export const TranscriptSection: React.FC<TranscriptSectionProps> = ({ 
  transcript, 
  partialTranscript, 
  title = 'Transcript' 
}) => {
  return (
    <div className="transcript-section">
      <div className="transcript-section__header">
        <h3>{title}</h3>
      </div>
      <div className="transcript-section__content">
        <Transcript 
          transcript={transcript} 
          partialTranscript={partialTranscript} 
        />
      </div>
    </div>
  );
};
