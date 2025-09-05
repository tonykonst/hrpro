import { app, globalShortcut } from 'electron';

/**
 * Application lifecycle management
 * 
 * @example
 * ```tsx
 * const appLifecycle = new AppLifecycle(windowManager);
 * appLifecycle.setup();
 * ```
 */
export class AppLifecycle {
  private windowManager: any; // WindowManager type
  private isQuitting = false;

  constructor(windowManager: any) {
    this.windowManager = windowManager;
  }

  /**
   * Setup application lifecycle handlers
   */
  setup(): void {
    this.setupAppEvents();
    this.setupGlobalShortcuts();
  }

  /**
   * Setup application events
   */
  private setupAppEvents(): void {
    // Обработка завершения приложения
    app.on('before-quit', (event) => {
      console.log('🔄 [APP] before-quit event triggered');
      this.isQuitting = true;
      
      // Закрываем DevTools если открыты
      const controlPanelWindow = this.windowManager.getControlPanelWindow();
      const dataWindow = this.windowManager.getDataWindow();
      
      if (controlPanelWindow && !controlPanelWindow.isDestroyed()) {
        controlPanelWindow.webContents.closeDevTools();
      }
      if (dataWindow && !dataWindow.isDestroyed()) {
        dataWindow.webContents.closeDevTools();
      }
    });

    app.on('will-quit', (event) => {
      console.log('🔄 [APP] will-quit event triggered');
      
      // Отменяем стандартное поведение завершения
      event.preventDefault();
      
      // Принудительно закрываем все окна
      this.windowManager.closeAllWindows();
      
      // Ждем немного и завершаем приложение
      setTimeout(() => {
        app.exit(0);
      }, 100);
    });

    app.on('window-all-closed', () => {
      console.log('🔄 [APP] window-all-closed event triggered');
      
      // На macOS приложения обычно остаются активными даже когда все окна закрыты
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      console.log('🔄 [APP] activate event triggered');
      
      // На macOS пересоздаем окно когда иконка в доке нажата
      if (this.windowManager.getControlPanelWindow() === null) {
        this.windowManager.createControlPanelWindow();
      }
    });
  }

  /**
   * Setup global shortcuts
   */
  private setupGlobalShortcuts(): void {
    // Ctrl/Cmd + \ для показа/скрытия панели управления
    globalShortcut.register('CommandOrControl+\\', () => {
      const controlPanelWindow = this.windowManager.getControlPanelWindow();
      const dataWindow = this.windowManager.getDataWindow();
      
      if (controlPanelWindow) {
        if (controlPanelWindow.isVisible()) {
          controlPanelWindow.hide();
          if (dataWindow) dataWindow.hide();
        } else {
          controlPanelWindow.show();
          controlPanelWindow.focus();
          if (dataWindow) dataWindow.show();
        }
      }
    });

    console.log('✅ Global shortcuts registered');
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Отменяем регистрацию всех глобальных горячих клавиш
    globalShortcut.unregisterAll();
    console.log('🧹 Global shortcuts unregistered');
  }

  /**
   * Check if app is quitting
   */
  isAppQuitting(): boolean {
    return this.isQuitting;
  }
}
