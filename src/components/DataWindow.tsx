import React from 'react';
import { LegacyInsight } from '../types/events';

interface DataWindowProps {
  // Состояния
  transcript: string;
  partialTranscript: string;
  insights: LegacyInsight[];
  isRecording: boolean;
}

export function DataWindow({
  transcript,
  partialTranscript,
  insights,
  isRecording
}: DataWindowProps) {
  return (
    <div className="data-window">
      {/* Header */}
      <div className="data-window__header">
        <h2>Interview Assistant</h2>
        <div className={`recording-indicator ${isRecording ? 'recording-indicator--active' : ''}`}>
          {isRecording ? '● Recording' : '○ Stopped'}
        </div>
      </div>

      {/* Transcript section */}
      <div className="data-window__transcript">
        <h3>Transcript</h3>
        <div className="transcript-content">
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
      </div>

      {/* Insights section */}
      {insights.length > 0 && (
        <div className="data-window__insights">
          <h3>Insights</h3>
          <div className="insights-content">
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
  );
}
