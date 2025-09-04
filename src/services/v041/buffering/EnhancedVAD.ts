import { VADResult } from '../../../types/v041/buffering';

/**
 * Улучшенный Voice Activity Detection с предварительной детекцией речи
 * Основан на анализе энергии сигнала и спектральных характеристик
 */
export class EnhancedVAD {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private frequencyData: Uint8Array;
  
  // Параметры детекции
  private energyThreshold = 0.1;
  private spectralThreshold = 0.15;
  private preSpeechSensitivity = 0.05; // Более чувствительная детекция для pre-speech
  
  // Буферы для анализа
  private energyHistory: number[] = [];
  private spectralHistory: number[] = [];
  private readonly historySize = 10; // Последние 10 измерений
  
  // Состояние
  private isSpeechActive = false;
  private preSpeechDetected = false;
  private speechStartTime = 0;
  private lastActivityTime = 0;
  
  constructor(audioContext: AudioContext, stream: MediaStream) {
    this.audioContext = audioContext;
    
    // Создаем анализатор
    const source = audioContext.createMediaStreamSource(stream);
    this.analyser = audioContext.createAnalyser();
    
    // Настройки анализатора для лучшей детекции
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.3;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;
    
    source.connect(this.analyser);
    
    // Буферы для данных
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    
    console.log('🎤 EnhancedVAD initialized:', {
      fftSize: this.analyser.fftSize,
      frequencyBinCount: this.analyser.frequencyBinCount
    });
  }

  /**
   * Анализирует аудио чанк и возвращает результат VAD
   */
  analyze(audioChunk: Float32Array): VADResult {
    // Получаем данные от анализатора
    this.analyser.getByteTimeDomainData(this.dataArray);
    this.analyser.getByteFrequencyData(this.frequencyData);
    
    // Вычисляем метрики
    const energyLevel = this.calculateEnergyLevel(audioChunk);
    const spectralCentroid = this.calculateSpectralCentroid();
    const spectralFlux = this.calculateSpectralFlux();
    
    // Обновляем историю
    this.updateHistory(energyLevel, spectralCentroid);
    
    // Определяем активность речи
    const speechDetection = this.detectSpeechActivity(energyLevel, spectralCentroid, spectralFlux);
    
    // Детекция pre-speech (подготовка к речи)
    const preSpeechDetection = this.detectPreSpeech(energyLevel, spectralCentroid);
    
    const result: VADResult = {
      isSpeech: speechDetection.isSpeech,
      confidence: speechDetection.confidence,
      energyLevel: energyLevel,
      speechStart: speechDetection.speechStart,
      speechEnd: speechDetection.speechEnd,
      preSpeechDetected: preSpeechDetection
    };

    this.updateState(result);
    
    return result;
  }

  /**
   * Вычисляет уровень энергии сигнала
   */
  private calculateEnergyLevel(audioChunk: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < audioChunk.length; i++) {
      sum += audioChunk[i] * audioChunk[i];
    }
    return Math.sqrt(sum / audioChunk.length);
  }

  /**
   * Вычисляет спектральный центроид (характеристика тембра)
   */
  private calculateSpectralCentroid(): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < this.frequencyData.length; i++) {
      const magnitude = this.frequencyData[i] / 255.0;
      const frequency = (i * this.audioContext.sampleRate) / (2 * this.frequencyData.length);
      
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * Вычисляет спектральный флакс (изменение спектра)
   */
  private calculateSpectralFlux(): number {
    if (this.spectralHistory.length < 2) return 0;
    
    const current = this.spectralHistory[this.spectralHistory.length - 1];
    const previous = this.spectralHistory[this.spectralHistory.length - 2];
    
    return Math.abs(current - previous);
  }

  /**
   * Обновляет историю измерений
   */
  private updateHistory(energy: number, spectral: number): void {
    // Добавляем новые значения
    this.energyHistory.push(energy);
    this.spectralHistory.push(spectral);
    
    // Ограничиваем размер истории
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
    }
    if (this.spectralHistory.length > this.historySize) {
      this.spectralHistory.shift();
    }
  }

  /**
   * Детекция активности речи
   */
  private detectSpeechActivity(energy: number, spectral: number, flux: number): {
    isSpeech: boolean;
    confidence: number;
    speechStart?: number;
    speechEnd?: number;
  } {
    // Базовая детекция по энергии
    const energyScore = energy > this.energyThreshold ? 1 : 0;
    
    // Спектральная детекция (речь имеет характерный спектр)
    const spectralScore = this.isVoiceSpectrum(spectral) ? 1 : 0;
    
    // Детекция изменений (речь динамична)
    const fluxScore = flux > 0.1 ? 1 : 0;
    
    // Адаптивная детекция на основе истории
    const adaptiveScore = this.getAdaptiveScore(energy, spectral);
    
    // Комбинированная оценка
    const totalScore = (energyScore * 0.4) + (spectralScore * 0.3) + (fluxScore * 0.2) + (adaptiveScore * 0.1);
    const isSpeech = totalScore > 0.5;
    
    const now = Date.now() / 1000;
    let speechStart: number | undefined;
    let speechEnd: number | undefined;
    
    // Определяем начало и конец речи
    if (isSpeech && !this.isSpeechActive) {
      speechStart = now;
      this.speechStartTime = now;
    } else if (!isSpeech && this.isSpeechActive) {
      speechEnd = now;
    }
    
    return {
      isSpeech,
      confidence: totalScore,
      speechStart,
      speechEnd
    };
  }

  /**
   * Детекция подготовки к речи (pre-speech)
   */
  private detectPreSpeech(energy: number, spectral: number): boolean {
    // Pre-speech детектируется по слабым признакам активности
    // (дыхание, движение губ, подготовка к речи)
    
    if (this.isSpeechActive) {
      return false; // Уже говорим
    }
    
    // Небольшое увеличение энергии
    const energyIncrease = this.getEnergyTrend() > 0.02;
    
    // Изменения в спектре (подготовка артикуляции)
    const spectralChange = this.getSpectralVariance() > 100;
    
    // Слабые признаки голосовой активности
    const weakVoiceActivity = energy > this.preSpeechSensitivity && energy < this.energyThreshold;
    
    return energyIncrease || spectralChange || weakVoiceActivity;
  }

  /**
   * Проверяет, является ли спектр голосовым
   */
  private isVoiceSpectrum(spectralCentroid: number): boolean {
    // Человеческий голос обычно имеет спектральный центроид в диапазоне 500-4000 Hz
    return spectralCentroid >= 500 && spectralCentroid <= 4000;
  }

  /**
   * Адаптивная оценка на основе истории
   */
  private getAdaptiveScore(energy: number, spectral: number): number {
    if (this.energyHistory.length < 3) return 0;
    
    // Сравниваем с недавней историей
    const recentAvgEnergy = this.energyHistory.slice(-3).reduce((a, b) => a + b) / 3;
    const recentAvgSpectral = this.spectralHistory.slice(-3).reduce((a, b) => a + b) / 3;
    
    // Если текущие значения значительно выше средних - возможно речь
    const energyRatio = energy / (recentAvgEnergy + 0.001);
    const spectralRatio = spectral / (recentAvgSpectral + 1);
    
    return Math.min(1, (energyRatio - 1) * 2 + (spectralRatio - 1) * 0.5);
  }

  /**
   * Вычисляет тренд энергии
   */
  private getEnergyTrend(): number {
    if (this.energyHistory.length < 3) return 0;
    
    const recent = this.energyHistory.slice(-3);
    const older = this.energyHistory.slice(-6, -3);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((a, b) => a + b) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b) / older.length;
    
    return recentAvg - olderAvg;
  }

  /**
   * Вычисляет вариацию спектра
   */
  private getSpectralVariance(): number {
    if (this.spectralHistory.length < 3) return 0;
    
    const recent = this.spectralHistory.slice(-3);
    const mean = recent.reduce((a, b) => a + b) / recent.length;
    
    return recent.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / recent.length;
  }

  /**
   * Обновляет внутреннее состояние VAD
   */
  private updateState(result: VADResult): void {
    const now = Date.now() / 1000;
    
    if (result.isSpeech) {
      this.lastActivityTime = now;
      if (!this.isSpeechActive) {
        this.isSpeechActive = true;
        console.log('🗣️ Speech started');
      }
    } else if (this.isSpeechActive) {
      // Речь прекратилась, но даем небольшую задержку
      if (now - this.lastActivityTime > 0.5) { // 500ms тишины
        this.isSpeechActive = false;
        console.log('🤫 Speech ended');
      }
    }
    
    if (result.preSpeechDetected && !this.preSpeechDetected) {
      this.preSpeechDetected = true;
      console.log('👂 Pre-speech detected');
    } else if (!result.preSpeechDetected && this.preSpeechDetected) {
      this.preSpeechDetected = false;
    }
  }

  /**
   * Настройка чувствительности
   */
  setSensitivity(energy: number, spectral: number, preSpeech: number): void {
    this.energyThreshold = energy;
    this.spectralThreshold = spectral;
    this.preSpeechSensitivity = preSpeech;
    
    console.log('🎛️ VAD sensitivity updated:', {
      energy: this.energyThreshold,
      spectral: this.spectralThreshold,
      preSpeech: this.preSpeechSensitivity
    });
  }

  /**
   * Получение статистики VAD
   */
  getStats(): {
    averageEnergy: number;
    averageSpectral: number;
    speechTime: number;
    isActive: boolean;
  } {
    const avgEnergy = this.energyHistory.length > 0 
      ? this.energyHistory.reduce((a, b) => a + b) / this.energyHistory.length 
      : 0;
      
    const avgSpectral = this.spectralHistory.length > 0 
      ? this.spectralHistory.reduce((a, b) => a + b) / this.spectralHistory.length 
      : 0;

    return {
      averageEnergy: avgEnergy,
      averageSpectral: avgSpectral,
      speechTime: this.isSpeechActive ? Date.now() / 1000 - this.speechStartTime : 0,
      isActive: this.isSpeechActive
    };
  }
}
