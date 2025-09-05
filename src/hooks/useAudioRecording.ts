import { useState, useCallback } from 'react';
import { configService } from '../services/config';

export interface UseAudioRecordingReturn {
  // Состояния
  hasPermission: boolean;
  
  // Методы
  setHasPermission: (hasPermission: boolean) => void;
  
  // Основные функции
  checkMicPermission: () => Promise<void>;
}

export const useAudioRecording = (): UseAudioRecordingReturn => {
  // Состояние разрешения микрофона
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // Проверка разрешения микрофона
  const checkMicPermission = useCallback(async () => {
    try {
      console.log('🎤 [useAudioRecording] Checking microphone permission...');
      const audioConstraints = configService.getAudioConstraints();
      console.log('🔧 [useAudioRecording] Audio constraints:', audioConstraints);
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      console.log('✅ [useAudioRecording] Microphone permission granted!');
      setHasPermission(true);
      console.log('🔄 [useAudioRecording] hasPermission set to true');
      stream.getTracks().forEach(track => track.stop());
      console.log('🛑 [useAudioRecording] Stream tracks stopped');
    } catch (error) {
      console.error('❌ [useAudioRecording] Microphone permission denied:', error);
      setHasPermission(false);
      console.log('🔄 [useAudioRecording] hasPermission set to false');
    }
  }, []);

  return {
    // Состояния
    hasPermission,
    
    // Методы
    setHasPermission,
    
    // Основные функции
    checkMicPermission
  };
};
