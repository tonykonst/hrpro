/**
 * useWindowManager - Хук для управления окнами через WindowManager
 * 
 * Предоставляет:
 * - Реактивное управление окнами
 * - Автоматический жизненный цикл окна данных
 * - Синхронизацию состояния между окнами
 */

import { useEffect, useCallback, useRef } from 'react';
import { windowManager, WindowState } from '../services/WindowManager';

export interface UseWindowManagerOptions {
  windowType: 'control' | 'data';
  isRecording: boolean;
  onWindowStateChange?: (state: WindowState) => void;
  onError?: (error: Error) => void;
}

export const useWindowManager = (options: UseWindowManagerOptions) => {
  const { windowType, isRecording, onWindowStateChange, onError } = options;
  const isInitialized = useRef(false);

  // Функция для создания окна данных
  const createDataWindow = useCallback(async () => {
    try {
      await windowManager.createDataWindow();
    } catch (error) {
      console.error('❌ [useWindowManager] Failed to create data window:', error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Функция для закрытия окна данных
  const closeDataWindow = useCallback(async () => {
    try {
      await windowManager.closeDataWindow();
    } catch (error) {
      console.error('❌ [useWindowManager] Failed to close data window:', error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Функция для получения состояния окна
  const getWindowState = useCallback((windowId: string): WindowState | undefined => {
    return windowManager.getWindowState(windowId);
  }, []);

  // Функция для проверки существования окна
  const hasWindow = useCallback((windowId: string): boolean => {
    return windowManager.hasWindow(windowId);
  }, []);

  // Инициализация
  useEffect(() => {
    if (!isInitialized.current) {
      console.log(`🚀 [useWindowManager] Initializing for ${windowType} window`);
      isInitialized.current = true;
    }
  }, [windowType]);

  // Синхронизация состояния записи
  useEffect(() => {
    windowManager.setRecordingState(isRecording);
  }, [isRecording]);

  // Слушатели событий WindowManager
  useEffect(() => {
    const handleWindowCreated = (windowId: string) => {
      console.log(`📱 [useWindowManager] Window ${windowId} created`);
    };

    const handleWindowClosed = (windowId: string) => {
      console.log(`📱 [useWindowManager] Window ${windowId} closed`);
    };

    const handleRecordingStateChanged = (recordingState: boolean) => {
      console.log(`🎤 [useWindowManager] Recording state changed: ${recordingState}`);
    };

    const handleError = (error: Error) => {
      console.error('❌ [useWindowManager] Error:', error);
      onError?.(error);
    };

    // Подписываемся на события
    windowManager.on('window-created', handleWindowCreated);
    windowManager.on('window-closed', handleWindowClosed);
    windowManager.on('recording-state-changed', handleRecordingStateChanged);
    windowManager.on('error', handleError);

    // Очистка при размонтировании
    return () => {
      windowManager.off('window-created', handleWindowCreated);
      windowManager.off('window-closed', handleWindowClosed);
      windowManager.off('recording-state-changed', handleRecordingStateChanged);
      windowManager.off('error', handleError);
    };
  }, [onError]);

  // Для data окна - слушаем изменения состояния
  useEffect(() => {
    if (windowType === 'data') {
      const handleStateChange = () => {
        const state = windowManager.getWindowState('data');
        if (state && onWindowStateChange) {
          onWindowStateChange(state);
        }
      };

      // Проверяем состояние при монтировании
      handleStateChange();

      // Подписываемся на изменения
      windowManager.on('recording-state-changed', handleStateChange);
      windowManager.on('window-created', handleStateChange);
      windowManager.on('window-closed', handleStateChange);

      return () => {
        windowManager.off('recording-state-changed', handleStateChange);
        windowManager.off('window-created', handleStateChange);
        windowManager.off('window-closed', handleStateChange);
      };
    }
  }, [windowType, onWindowStateChange]);

  return {
    createDataWindow,
    closeDataWindow,
    getWindowState,
    hasWindow,
    isRecording: windowManager.getRecordingState(),
  };
};
