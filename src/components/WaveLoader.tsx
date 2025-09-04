import React from 'react';

interface WaveLoaderProps {
  isActive: boolean;
  audioLevel: number;
  partialTranscript: string;
  width?: number;
  height?: number;
}

export function WaveLoader({
  isActive,
  audioLevel,
  partialTranscript,
  width = 120,
  height = 40,
}: WaveLoaderProps) {
  return (
    <div className="wave-loader-container" style={{ width, height }}>
      <div className={`loader ${isActive ? 'active' : ''}`}>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
}
