import React from 'react';
import { LegacyInsight } from '../../types/events';
import { DataWindowHeader } from './DataWindowHeader';
import { TranscriptSection } from './TranscriptSection';
import { InsightsSection } from './InsightsSection';

/**
 * Props for DataWindow component
 */
interface DataWindowProps {
  // Состояния
  transcript: string;
  partialTranscript: string;
  insights: LegacyInsight[];
  isRecording: boolean;
}

/**
 * Data window component for displaying interview data
 * 
 * @example
 * ```tsx
 * <DataWindow
 *   transcript="Hello world"
 *   partialTranscript="how are you"
 *   insights={insightsArray}
 *   isRecording={true}
 * />
 * ```
 */
export function DataWindow({
  transcript,
  partialTranscript,
  insights,
  isRecording
}: DataWindowProps) {
  return (
    <div className="data-window">
      <DataWindowHeader isRecording={isRecording} />
      
      <div className="data-window__transcript">
        <h3>Transcript</h3>
        <TranscriptSection 
          transcript={transcript} 
          partialTranscript={partialTranscript} 
        />
      </div>

      {insights.length > 0 && (
        <div className="data-window__insights">
          <h3>Insights</h3>
          <InsightsSection insights={insights} />
        </div>
      )}
    </div>
  );
}
