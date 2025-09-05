import { app } from 'electron';
import { config } from 'dotenv';
import { WindowManager } from './windows/WindowManager';
import { IPCHandlers } from './ipc/IPCHandlers';
import { AppLifecycle } from './lifecycle/AppLifecycle';

// Загружаем переменные окружения из .env файла
config();

/**
 * Main Electron process entry point
 * 
 * This file coordinates the application initialization and manages
 * the main process lifecycle.
 */
class MainProcess {
  private windowManager: WindowManager;
  private ipcHandlers: IPCHandlers;
  private appLifecycle: AppLifecycle;

  constructor() {
    this.windowManager = new WindowManager();
    this.ipcHandlers = new IPCHandlers(this.windowManager);
    this.appLifecycle = new AppLifecycle(this.windowManager);
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    console.log('🚀 [MAIN] Starting Interview Assistant...');

    // Setup application lifecycle
    this.appLifecycle.setup();

    // Setup IPC handlers
    this.ipcHandlers.setup();

    // Create control panel window
    this.createControlPanelWindow();

    console.log('✅ [MAIN] Application initialized successfully');
  }

  /**
   * Create and setup control panel window
   */
  private createControlPanelWindow(): void {
    const controlPanelWindow = this.windowManager.createControlPanelWindow();

    // DevTools для отладки в development режиме
    if (process.env.NODE_ENV === 'development') {
      controlPanelWindow.webContents.once('did-finish-load', () => {
        console.log('🔧 Opening DevTools for control panel');
        controlPanelWindow.webContents.openDevTools({ mode: 'detach' });
      });
    }

    // Обработка создания data window
    controlPanelWindow.webContents.on('did-finish-load', () => {
      console.log('📱 Control panel loaded');
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    console.log('🧹 [MAIN] Cleaning up resources...');
    this.appLifecycle.cleanup();
  }
}

// Создаем экземпляр главного процесса
const mainProcess = new MainProcess();

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('❌ [MAIN] Uncaught Exception:', error);
  mainProcess.cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [MAIN] Unhandled Rejection at:', promise, 'reason:', reason);
  mainProcess.cleanup();
  process.exit(1);
});

// Инициализация приложения когда Electron готов
app.whenReady().then(async () => {
  try {
    await mainProcess.initialize();
  } catch (error) {
    console.error('❌ [MAIN] Failed to initialize application:', error);
    app.quit();
  }
});

// Cleanup при завершении
app.on('before-quit', () => {
  mainProcess.cleanup();
});