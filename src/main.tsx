import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";
import "./styles/components.css";

console.log('🎯 Main.tsx loaded');

try {
  // Создаем и рендерим приложение
  console.log('🎯 Creating React root...');
  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
  );

  console.log('🎯 Rendering App component...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Failed to render App:', error);
}

// Скрываем загрузочный экран
setTimeout(() => {
  if (window.hideLoadingScreen) {
    window.hideLoadingScreen();
  }
}, 500);

// Добавляем типы для window
declare global {
  interface Window {
    hideLoadingScreen?: () => void;
  }
}
