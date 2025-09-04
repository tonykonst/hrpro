import { useRef, useState, useCallback } from 'react';

export function useAudioAnalyser() {
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  const initAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      
      audioAnalyserRef.current = analyser;
      
      // Analyze audio level
      const updateAudioLevel = () => {
        if (analyser) {
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          analyser.getByteFrequencyData(dataArray);
          
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedLevel = average / 255;
          
          setAudioLevel(normalizedLevel);
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
      console.log('🎤 Audio analyser initialized');
      
    } catch (error) {
      console.warn('⚠️ Failed to initialize audio analyser:', error);
    }
  }, []);

  const stopAudioAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioAnalyserRef.current) {
      audioAnalyserRef.current = null;
    }
    
    setAudioLevel(0);
    console.log('🧹 Audio analyser stopped');
  }, []);

  return {
    audioLevel,
    initAudioAnalyser,
    stopAudioAnalyser
  };
}
