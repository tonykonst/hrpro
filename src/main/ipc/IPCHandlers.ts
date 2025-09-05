import { ipcMain, BrowserWindow } from 'electron';

/**
 * IPC handlers for communication between main and renderer processes
 * 
 * @example
 * ```tsx
 * const ipcHandlers = new IPCHandlers(windowManager);
 * ipcHandlers.setup();
 * ```
 */
export class IPCHandlers {
  private windowManager: any; // WindowManager type
  private pendingTranscriptData: any[] = [];
  private pendingInsightsData: any[] = [];
  private pendingRecordingStateData: any[] = [];

  constructor(windowManager: any) {
    this.windowManager = windowManager;
  }

  /**
   * Setup all IPC handlers
   */
  setup(): void {
    this.setupWindowHandlers();
    this.setupDataHandlers();
  }

  /**
   * Setup window management handlers
   */
  private setupWindowHandlers(): void {
    // Создать окно с данными
    ipcMain.handle('create-data-window', () => {
      try {
        const dataWindow = this.windowManager.createDataWindow();
        
        // Обрабатываем очередь данных после создания окна
        this.processPendingData();
        
        const controlPanelWindow = this.windowManager.getControlPanelWindow();
        if (controlPanelWindow) {
          controlPanelWindow.webContents.send('window-created', 'data');
        }
        return { success: true, message: 'Data window creation initiated' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    // Закрыть окно с данными
    ipcMain.handle('close-data-window', () => {
      try {
        const dataWindow = this.windowManager.getDataWindow();
        if (dataWindow && !dataWindow.isDestroyed()) {
          dataWindow.close();
        }
        return { success: true, message: 'Data window closed' };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Setup data transmission handlers
   */
  private setupDataHandlers(): void {
    // Передать транскрипт в окно данных
    ipcMain.handle('send-transcript', (event, data) => {
      const dataWindow = this.windowManager.getDataWindow();
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.send('transcript-update', data);
      } else {
        this.pendingTranscriptData.push(data); // Добавляем в очередь
      }
    });

    // Передать инсайты в окно данных
    ipcMain.handle('send-insights', (event, insights) => {
      const dataWindow = this.windowManager.getDataWindow();
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.send('insights-update', insights);
      } else {
        this.pendingInsightsData.push(insights);
      }
    });

    // Передать состояние записи в окно данных
    ipcMain.handle('send-recording-state', (event, data) => {
      const dataWindow = this.windowManager.getDataWindow();
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.send('recording-state-change', data);
      } else {
        this.pendingRecordingStateData.push(data);
      }
    });
  }

  /**
   * Process pending data when data window is created
   */
  processPendingData(): void {
    const dataWindow = this.windowManager.getDataWindow();
    if (!dataWindow || dataWindow.isDestroyed()) return;

    // Отправляем накопленные данные транскрипции
    this.pendingTranscriptData.forEach(data => {
      dataWindow.webContents.send('transcript-update', data);
    });
    this.pendingTranscriptData = [];

    // Отправляем накопленные данные инсайтов
    this.pendingInsightsData.forEach(data => {
      dataWindow.webContents.send('insights-update', data);
    });
    this.pendingInsightsData = [];

    // Отправляем накопленные данные состояния записи
    this.pendingRecordingStateData.forEach(data => {
      dataWindow.webContents.send('recording-state-change', data);
    });
    this.pendingRecordingStateData = [];
  }
}
