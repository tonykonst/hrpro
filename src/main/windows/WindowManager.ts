import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

/**
 * Window manager for creating and managing application windows
 * 
 * @example
 * ```tsx
 * const windowManager = new WindowManager();
 * windowManager.createControlPanelWindow();
 * ```
 */
export class WindowManager {
  private controlPanelWindow: BrowserWindow | null = null;
  private dataWindow: BrowserWindow | null = null;

  /**
   * Create the main control panel window
   */
  createControlPanelWindow(): BrowserWindow {
    // Адаптивные настройки окна - размер по содержимому
    const windowOptions = {
      width: 200,          // Начальная ширина
      height: 56,          // Начальная высота (точно по панели)
      minWidth: 100,       // Минимальная ширина
      minHeight: 56,       // Минимальная высота
      maxWidth: 800,       // Максимальная ширина
      maxHeight: 120,      // Максимальная высота
      useContentSize: true, // Размер по содержимому
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: true,     // Разрешить изменение размера
      webPreferences: {
        nodeIntegration: false,       // ✅ БЕЗОПАСНО
        contextIsolation: true,       // ✅ БЕЗОПАСНО
        backgroundThrottling: false,
        enableRemoteModule: false,
        webSecurity: true,            // ✅ БЕЗОПАСНО
        preload: path.join(__dirname, '..', '..', 'preload', 'preload.js') // ✅ PRELOAD
      }
    };

    this.controlPanelWindow = new BrowserWindow(windowOptions);

    // Загружаем панель управления
    this.controlPanelWindow.loadURL('http://localhost:5173?window=control');

    // Позиционируем окно в правом верхнем углу
    this.positionControlPanelWindow();

    // Обработчики событий окна
    this.setupControlPanelWindowEvents();

    // Автоматически создаем data window
    this.createDataWindow();

    return this.controlPanelWindow;
  }

  /**
   * Create the data display window
   */
  createDataWindow(): BrowserWindow {
    if (this.dataWindow && !this.dataWindow.isDestroyed()) {
      this.dataWindow.show();
      this.dataWindow.focus();
      return this.dataWindow;
    }

    const dataWindowOptions = {
      width: 600,
      height: 400,
      minWidth: 400,
      minHeight: 300,
      maxWidth: 1200,
      maxHeight: 800,
      useContentSize: true,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      hasShadow: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,        // ✅ БЕЗОПАСНО
        contextIsolation: true,        // ✅ БЕЗОПАСНО
        webSecurity: true,             // ✅ БЕЗОПАСНО
        backgroundThrottling: false,
        enableRemoteModule: false,
        preload: path.join(__dirname, '..', '..', 'preload', 'preload.js')
      }
    };

    this.dataWindow = new BrowserWindow(dataWindowOptions);
    this.dataWindow.loadURL('http://localhost:5173?window=data');

    // Позиционируем рядом с панелью управления
    this.positionDataWindow();

    // Обработчики событий окна
    this.setupDataWindowEvents();

    return this.dataWindow;
  }

  /**
   * Position control panel window in top-right corner
   */
  private positionControlPanelWindow(): void {
    if (!this.controlPanelWindow) return;

    const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
    const windowBounds = this.controlPanelWindow.getBounds();
    
    this.controlPanelWindow.setPosition(
      screenWidth - windowBounds.width - 20, // 20px отступ от края
      20 // 20px отступ сверху
    );
  }

  /**
   * Position data window next to control panel
   */
  private positionDataWindow(): void {
    if (!this.dataWindow || !this.controlPanelWindow) return;

    const panelBounds = this.controlPanelWindow.getBounds();
    this.dataWindow.setPosition(
      panelBounds.x - 620, // Слева от панели управления
      panelBounds.y
    );
  }

  /**
   * Setup event handlers for control panel window
   */
  private setupControlPanelWindowEvents(): void {
    if (!this.controlPanelWindow) return;

    this.controlPanelWindow.on('closed', () => {
      this.controlPanelWindow = null;
    });

    this.controlPanelWindow.on('resize', () => {
      // Обновляем позицию data window при изменении размера control panel
      if (this.dataWindow && !this.dataWindow.isDestroyed()) {
        this.positionDataWindow();
      }
    });

    this.controlPanelWindow.on('move', () => {
      // Обновляем позицию data window при перемещении control panel
      if (this.dataWindow && !this.dataWindow.isDestroyed()) {
        this.positionDataWindow();
      }
    });

    // Показываем data window когда control panel загружается
    this.controlPanelWindow.webContents.on('did-finish-load', () => {
      if (this.dataWindow && !this.dataWindow.isDestroyed()) {
        this.dataWindow.show();
      }
    });
  }

  /**
   * Setup event handlers for data window
   */
  private setupDataWindowEvents(): void {
    if (!this.dataWindow) return;

    this.dataWindow.on('closed', () => {
      this.dataWindow = null;
    });
  }

  /**
   * Get control panel window
   */
  getControlPanelWindow(): BrowserWindow | null {
    return this.controlPanelWindow;
  }

  /**
   * Get data window
   */
  getDataWindow(): BrowserWindow | null {
    return this.dataWindow;
  }

  /**
   * Close all windows
   */
  closeAllWindows(): void {
    if (this.controlPanelWindow && !this.controlPanelWindow.isDestroyed()) {
      this.controlPanelWindow.close();
    }
    if (this.dataWindow && !this.dataWindow.isDestroyed()) {
      this.dataWindow.close();
    }
  }
}
