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

  // Переменные окружения
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    __NODE_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
    
    // API Keys (TODO: Перенести в preload script для большей безопасности)
    'process.env.DEEPGRAM_API_KEY': JSON.stringify(process.env.DEEPGRAM_API_KEY || ''),
    'process.env.CLAUDE_API_KEY': JSON.stringify(process.env.CLAUDE_API_KEY || ''),
    
    // Deepgram Settings
    'process.env.DEEPGRAM_MODEL': JSON.stringify(process.env.DEEPGRAM_MODEL || 'nova-2'),
    'process.env.DEEPGRAM_LANGUAGE': JSON.stringify(process.env.DEEPGRAM_LANGUAGE || 'ru'),
    'process.env.DEEPGRAM_PUNCTUATION': JSON.stringify(process.env.DEEPGRAM_PUNCTUATION || 'true'),
    'process.env.DEEPGRAM_INTERIM_RESULTS': JSON.stringify(process.env.DEEPGRAM_INTERIM_RESULTS || 'true'),
    'process.env.DEEPGRAM_SMART_FORMAT': JSON.stringify(process.env.DEEPGRAM_SMART_FORMAT || 'true'),
    
    // Claude Settings
    'process.env.CLAUDE_MODEL': JSON.stringify(process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'),
    'process.env.CLAUDE_MAX_TOKENS': JSON.stringify(process.env.CLAUDE_MAX_TOKENS || '300'),
    'process.env.CLAUDE_TEMPERATURE': JSON.stringify(process.env.CLAUDE_TEMPERATURE || '0.3'),
    
    // Audio Settings
    'process.env.AUDIO_SAMPLE_RATE': JSON.stringify(process.env.AUDIO_SAMPLE_RATE || '16000'),
    'process.env.AUDIO_CHANNELS': JSON.stringify(process.env.AUDIO_CHANNELS || '1'),
    'process.env.AUDIO_ECHO_CANCELLATION': JSON.stringify(process.env.AUDIO_ECHO_CANCELLATION || 'true'),
    'process.env.AUDIO_NOISE_SUPPRESSION': JSON.stringify(process.env.AUDIO_NOISE_SUPPRESSION || 'true'),
    'process.env.AUDIO_AUTO_GAIN_CONTROL': JSON.stringify(process.env.AUDIO_AUTO_GAIN_CONTROL || 'true'),
    'process.env.AUDIO_CHUNK_SIZE': JSON.stringify(process.env.AUDIO_CHUNK_SIZE || '250'),
    
    // UI Settings
    'process.env.UI_INSIGHT_FREQUENCY_MS': JSON.stringify(process.env.UI_INSIGHT_FREQUENCY_MS || '3000'),
    'process.env.UI_MIN_INSIGHT_CONFIDENCE': JSON.stringify(process.env.UI_MIN_INSIGHT_CONFIDENCE || '0.6'),
    'process.env.UI_TRANSCRIPT_BUFFER_WORDS': JSON.stringify(process.env.UI_TRANSCRIPT_BUFFER_WORDS || '600'),
    'process.env.UI_MAX_INSIGHTS_DISPLAY': JSON.stringify(process.env.UI_MAX_INSIGHTS_DISPLAY || '3'),
    'process.env.UI_DEFAULT_ACTIVE_PANEL': JSON.stringify(process.env.UI_DEFAULT_ACTIVE_PANEL || 'transcript'),
    'process.env.UI_DEFAULT_CLICK_THROUGH': JSON.stringify(process.env.UI_DEFAULT_CLICK_THROUGH || 'false'),
    
    // General
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});