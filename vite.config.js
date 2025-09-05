/**
 * vite.config.ts
 * Конфигурация Vite для renderer процесса Electron
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { config } from 'dotenv';

// Загружаем переменные окружения из .env файла
config();

export default defineConfig({
  plugins: [react()],
  
  // Базовая конфигурация для Electron
  base: './',
  
  // Настройки сервера для разработки
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost'
  },

  // Разрешение путей
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/components': resolve(__dirname, 'src/components'),
      '@/hooks': resolve(__dirname, 'src/hooks'),
      '@/services': resolve(__dirname, 'src/services')
    }
  },

  // Настройки сборки
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    target: 'esnext',
    minify: process.env.NODE_ENV === 'production',
    sourcemap: process.env.NODE_ENV === 'development'
  },

  // Оптимизация зависимостей
  optimizeDeps: {
    include: ['react', 'react-dom', 'zod']
  },

  // CSS настройки
  css: {
    postcss: {
      plugins: [
        require('tailwindcss'),
        require('autoprefixer')
      ]
    }
  },

  // Переменные окружения - только базовые, остальные через preload script
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __NODE_ENV__: JSON.stringify(process.env.NODE_ENV || 'development')
  }
});