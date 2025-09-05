// Адаптивная система для улучшения ASR
// Умная детекция языка и оптимизация производительности

export interface LanguageStats {
  language: 'ru' | 'en' | 'mixed';
  confidence: number;
  characterCount: number;
  lastDetected: number;
}

export interface PerformanceMetrics {
  avgConfidence: number;
  avgLatency: number;
  errorRate: number;
  sessionStartTime: number;
  totalSegments: number;
}

export class LanguageDetector {
  private languageHistory: LanguageStats[] = [];
  private currentLanguage: 'ru' | 'en' | 'multi' = 'multi';
  
  detectLanguage(text: string): LanguageStats {
    const englishPattern = /[a-zA-Z]/g;
    const russianPattern = /[а-яё]/gi;
    const numberPattern = /\d/g;
    
    const englishChars = (text.match(englishPattern) || []).length;
    const russianChars = (text.match(russianPattern) || []).length;
    const numberChars = (text.match(numberPattern) || []).length;
    
    const totalLetters = englishChars + russianChars;
    const totalChars = text.length - numberChars; // Исключаем цифры
    
    if (totalLetters === 0) {
      return {
        language: 'mixed',
        confidence: 0.5,
        characterCount: totalChars,
        lastDetected: Date.now()
      };
    }
    
    const englishRatio = englishChars / totalLetters;
    const russianRatio = russianChars / totalLetters;
    
    let detectedLanguage: 'ru' | 'en' | 'mixed';
    let confidence: number;
    
    if (englishRatio > 0.8) {
      detectedLanguage = 'en';
      confidence = englishRatio;
    } else if (russianRatio > 0.8) {
      detectedLanguage = 'ru';
      confidence = russianRatio;
    } else {
      detectedLanguage = 'mixed';
      confidence = 1 - Math.abs(englishRatio - russianRatio); // Чем ближе к 50/50, тем выше уверенность в смешанном
    }
    
    const stats: LanguageStats = {
      language: detectedLanguage,
      confidence,
      characterCount: totalChars,
      lastDetected: Date.now()
    };
    
    this.updateLanguageHistory(stats);
    return stats;
  }
  
  private updateLanguageHistory(stats: LanguageStats) {
    this.languageHistory.push(stats);
    
    // Держим только последние 10 детекций
    if (this.languageHistory.length > 10) {
      this.languageHistory = this.languageHistory.slice(-10);
    }
  }
  
  // Получить доминирующий язык за последние сегменты
  getDominantLanguage(): 'ru' | 'en' | 'mixed' {
    if (this.languageHistory.length === 0) return 'mixed';
    
    const recent = this.languageHistory.slice(-5); // Последние 5 сегментов
    const langCounts = { ru: 0, en: 0, mixed: 0 };
    
    recent.forEach(stats => {
      langCounts[stats.language]++;
    });
    
    // Возвращаем язык с максимальным количеством
    const dominant = Object.entries(langCounts).reduce((a, b) => {
      const aKey = a[0] as keyof typeof langCounts;
      const bKey = b[0] as keyof typeof langCounts;
      return langCounts[aKey] > langCounts[bKey] ? a : b;
    })[0] as 'ru' | 'en' | 'mixed';
    
    return dominant;
  }
  
  // Нужно ли переключить модель Deepgram
  shouldSwitchModel(currentLanguageSetting: string): { switch: boolean, newSetting: string } {
    const dominant = this.getDominantLanguage();
    
    // Переключаемся только если есть явное доминирование (не mixed)
    if (dominant === 'mixed') {
      // Если доминирует mixed язык - переключаемся обратно на multi
      if (currentLanguageSetting !== 'multi') {
        return { switch: true, newSetting: 'multi' };
      }
      return { switch: false, newSetting: currentLanguageSetting };
    }
    
    // Если доминирует один язык, а у нас multi - можно оптимизировать
    if (currentLanguageSetting === 'multi' && (dominant === 'ru' || dominant === 'en')) {
      const recentConfidence = this.getRecentConfidence(dominant);
      
      // Переключаемся на конкретный язык только при высокой уверенности
      if (recentConfidence > 0.85) {
        return { switch: true, newSetting: dominant };
      }
    }
    
    return { switch: false, newSetting: currentLanguageSetting };
  }
  
  private getRecentConfidence(language: 'ru' | 'en'): number {
    const recentStats = this.languageHistory
      .slice(-3)
      .filter(stats => stats.language === language);
    
    if (recentStats.length === 0) return 0;
    
    return recentStats.reduce((sum, stats) => sum + stats.confidence, 0) / recentStats.length;
  }
  
  getDebugInfo() {
    return {
      currentLanguage: this.currentLanguage,
      dominantLanguage: this.getDominantLanguage(),
      historyLength: this.languageHistory.length,
      recentStats: this.languageHistory.slice(-3)
    };
  }
}

export class PerformanceOptimizer {
  private metrics: PerformanceMetrics;
  private latencyHistory: number[] = [];
  
  constructor() {
    this.metrics = {
      avgConfidence: 0.85,
      avgLatency: 200,
      errorRate: 0.1,
      sessionStartTime: Date.now(),
      totalSegments: 0
    };
  }
  
  updateMetrics(confidence: number, latency: number, hadError: boolean = false) {
    this.metrics.totalSegments++;
    
    // Обновляем среднюю уверенность (экспоненциальное сглаживание)
    this.metrics.avgConfidence = this.metrics.avgConfidence * 0.9 + confidence * 0.1;
    
    // Обновляем латентность
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > 20) {
      this.latencyHistory = this.latencyHistory.slice(-20);
    }
    this.metrics.avgLatency = this.latencyHistory.reduce((a, b) => a + b) / this.latencyHistory.length;
    
    // Обновляем частоту ошибок
    if (hadError) {
      this.metrics.errorRate = this.metrics.errorRate * 0.95 + 0.05;
    } else {
      this.metrics.errorRate = this.metrics.errorRate * 0.95;
    }
  }
  
  // Рекомендации по оптимизации модели
  getModelRecommendation(): { model: string, reason: string } {
    const sessionTime = (Date.now() - this.metrics.sessionStartTime) / (1000 * 60); // минуты
    
    // Если сессия длинная и качество падает - переходим на более точную модель
    if (sessionTime > 30 && this.metrics.avgConfidence < 0.7) {
      return {
        model: 'nova-2-general',
        reason: 'low confidence in long session'
      };
    }
    
    // Если высокое качество и нужна скорость - можем использовать быструю модель
    if (this.metrics.avgConfidence > 0.9 && this.metrics.avgLatency > 300) {
      return {
        model: 'base',
        reason: 'high confidence, optimize for speed'
      };
    }
    
    // Если много ошибок - используем самую точную модель
    if (this.metrics.errorRate > 0.2) {
      return {
        model: 'nova-2',
        reason: 'high error rate, need accuracy'
      };
    }
    
    // По умолчанию - balanced модель для интервью
    return {
      model: 'nova-2-meeting',
      reason: 'balanced for interview context'
    };
  }
  
  // Адаптивные параметры для Deepgram
  getAdaptiveParameters(): {
    endpointing: number,
    interim_results_period: number,
    confidence_threshold: number
  } {
    // Если качество низкое - увеличиваем endpointing (ждем дольше перед финализацией)
    let endpointing = 300;
    if (this.metrics.avgConfidence < 0.7) {
      endpointing = 500;
    } else if (this.metrics.avgConfidence > 0.9) {
      endpointing = 200;
    }
    
    // Если латентность высокая - уменьшаем частоту interim results
    let interimPeriod = 100;
    if (this.metrics.avgLatency > 400) {
      interimPeriod = 200;
    } else if (this.metrics.avgLatency < 150) {
      interimPeriod = 50;
    }
    
    // Адаптивный порог уверенности для постредактора
    let confidenceThreshold = 0.9;
    if (this.metrics.avgConfidence < 0.8) {
      confidenceThreshold = 0.85; // Более агрессивная коррекция при низком качестве
    } else if (this.metrics.avgConfidence > 0.95) {
      confidenceThreshold = 0.95; // Более консервативная коррекция при высоком качестве
    }
    
    return {
      endpointing,
      interim_results_period: interimPeriod,
      confidence_threshold: confidenceThreshold
    };
  }
  
  getDebugInfo() {
    return {
      ...this.metrics,
      sessionTimeMinutes: (Date.now() - this.metrics.sessionStartTime) / (1000 * 60),
      recommendation: this.getModelRecommendation(),
      adaptiveParams: this.getAdaptiveParameters()
    };
  }
}

export class AdaptiveASRManager {
  private languageDetector: LanguageDetector;
  private performanceOptimizer: PerformanceOptimizer;
  private currentLanguageSetting: string = 'multi';
  
  constructor() {
    this.languageDetector = new LanguageDetector();
    this.performanceOptimizer = new PerformanceOptimizer();
  }
  
  // Анализируем транскрипт и даем рекомендации
  analyzeTranscript(
    text: string, 
    confidence: number, 
    latency: number = 200
  ): {
    languageStats: LanguageStats,
    shouldOptimize: boolean,
    recommendations: {
      languageSwitch?: { switch: boolean, newSetting: string },
      modelSwitch?: { model: string, reason: string },
      adaptiveParams?: any
    }
  } {
    
    const languageStats = this.languageDetector.detectLanguage(text);
    this.performanceOptimizer.updateMetrics(confidence, latency);
    
    const languageSwitch = this.languageDetector.shouldSwitchModel(this.currentLanguageSetting);
    const modelRecommendation = this.performanceOptimizer.getModelRecommendation();
    const adaptiveParams = this.performanceOptimizer.getAdaptiveParameters();
    
    // Определяем, нужна ли оптимизация
    const shouldOptimize = languageSwitch.switch || 
                          modelRecommendation.model !== 'nova-2-meeting' ||
                          adaptiveParams.confidence_threshold !== 0.9;
    
    return {
      languageStats,
      shouldOptimize,
      recommendations: {
        languageSwitch: languageSwitch.switch ? languageSwitch : undefined,
        modelSwitch: modelRecommendation,
        adaptiveParams
      }
    };
  }
  
  // Обновляем текущие настройки
  updateCurrentSettings(languageSetting: string) {
    this.currentLanguageSetting = languageSetting;
  }
  
  getDebugInfo() {
    return {
      currentLanguage: this.currentLanguageSetting,
      languageDetector: this.languageDetector.getDebugInfo(),
      performance: this.performanceOptimizer.getDebugInfo()
    };
  }
}

