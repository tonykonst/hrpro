import { useCallback } from 'react';
import { configService } from '../../services/config';
import { useAudioAnalyser } from '../useAudioAnalyser';

/**
 * Recording functionality for transcription hook
 * 
 * @example
 * ```tsx
 * const recording = useTranscriptionRecording({
 *   streamRef,
 *   audioContextRef,
 *   processorRef,
 *   cleanupRef,
 *   deepgramRef,
 *   setIsRecording,
 *   initAudioAnalyser,
 *   stopAudioAnalyser,
 *   connectToDeepgram
 * });
 * ```
 */
interface UseTranscriptionRecordingProps {
  streamRef: React.MutableRefObject<MediaStream | null>;
  audioContextRef: React.MutableRefObject<AudioContext | null>;
  processorRef: React.MutableRefObject<ScriptProcessorNode | AudioWorkletNode | null>;
  cleanupRef: React.MutableRefObject<(() => void) | null>;
  deepgramRef: React.MutableRefObject<any>;
  setIsRecording: (recording: boolean) => void;
  initAudioAnalyser: (stream: MediaStream) => void;
  stopAudioAnalyser: () => void;
  connectToDeepgram: () => Promise<() => void>;
}

export const useTranscriptionRecording = ({
  streamRef,
  audioContextRef,
  processorRef,
  cleanupRef,
  deepgramRef,
  setIsRecording,
  initAudioAnalyser,
  stopAudioAnalyser,
  connectToDeepgram
}: UseTranscriptionRecordingProps) => {

  /**
   * Start recording
   */
  const startRecording = useCallback(async (): Promise<void> => {
    console.log('🎬 [useTranscription] Starting recording...');
    
    try {
      // Обновляем UI состояние
      setIsRecording(true);
      
      // Получаем доступ к микрофону
      const audioConstraints = configService.getAudioConstraints();
      console.log('🎤 [useTranscription] Requesting microphone access...');
      
      const stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
      streamRef.current = stream;
      
      console.log('✅ [useTranscription] Microphone access granted');
      
      // Инициализируем анализатор аудио
      initAudioAnalyser(stream);
      
      // Подключаемся к Deepgram
      const cleanup = await connectToDeepgram();
      cleanupRef.current = cleanup;
      
      // Настраиваем аудио pipeline
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      console.log('🔊 [useTranscription] Setting up audio pipeline...');
      
      try {
        // Пытаемся использовать AudioWorklet (современный подход)
        await audioContext.audioWorklet.addModule('/audioWorklet.js');
        
        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        
        // Обработчик аудио данных
        workletNode.port.onmessage = (event) => {
          if (event.data.type === 'pcm-data' && deepgramRef.current) {
            deepgramRef.current.sendAudio(event.data.data);
          }
        };
        
        source.connect(workletNode);
        processorRef.current = workletNode;
        
        console.log('✅ [useTranscription] AudioWorklet pipeline ready');
        
      } catch (workletError) {
        console.warn('⚠️ [useTranscription] AudioWorklet failed, falling back to ScriptProcessor:', workletError);
        
        // Fallback на ScriptProcessor
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (event) => {
          const inputData = event.inputBuffer.getChannelData(0);
          
          // Конвертируем Float32 в Int16
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // Отправляем данные в Deepgram
          if (deepgramRef.current) {
            deepgramRef.current.sendAudio(pcm16.buffer);
          }
        };
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        processorRef.current = processor;
        
        console.log('✅ [useTranscription] ScriptProcessor pipeline ready');
      }
      
      console.log('🎉 [useTranscription] Recording started successfully!');
      
    } catch (error) {
      console.error('❌ [useTranscription] Failed to start recording:', error);
      setIsRecording(false);
      throw error;
    }
  }, [
    setIsRecording,
    streamRef,
    audioContextRef,
    processorRef,
    cleanupRef,
    deepgramRef,
    initAudioAnalyser,
    connectToDeepgram
  ]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback((): void => {
    console.log('⏹️ [useTranscription] Stopping recording...');
    
    try {
      // Останавливаем аудио pipeline
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      // Закрываем аудио контекст
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Останавливаем поток
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Останавливаем анализатор
      stopAudioAnalyser();
      
      // Отключаемся от Deepgram
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      
      // Обновляем UI состояние
      setIsRecording(false);
      
      console.log('✅ [useTranscription] Recording stopped successfully!');
      
    } catch (error) {
      console.error('❌ [useTranscription] Error stopping recording:', error);
      setIsRecording(false);
    }
  }, [
    processorRef,
    audioContextRef,
    streamRef,
    stopAudioAnalyser,
    cleanupRef,
    setIsRecording
  ]);

  return {
    startRecording,
    stopRecording
  };
};
