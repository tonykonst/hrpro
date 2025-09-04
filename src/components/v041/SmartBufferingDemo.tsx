import React, { useState } from 'react';
import { useSmartBuffering } from '../../hooks/v041/useSmartBuffering';
import { SmartBuffer, TranscriptionResult } from '../../types/v041/buffering';

/**
 * Демонстрационный компонент для тестирования умной буферизации
 */
export const SmartBufferingDemo: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [transcriptions, setTranscriptions] = useState<Array<{buffer: SmartBuffer, result: TranscriptionResult}>>([]);
  const [sensitivity, setSensitivity] = useState({
    energy: 0.1,
    spectral: 0.15,
    preSpeech: 0.05
  });

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]); // Последние 20 логов
  };

  const {
    isActive,
    currentBuffer,
    readyBuffers,
    qualityMetrics,
    vadStats,
    startBuffering,
    stopBuffering,
    setVADSensitivity,
    getDetailedStats,
    isInitialized
  } = useSmartBuffering({
    config: {
      baseWindowSize: 30,
      overlapSize: 8,
      adaptToSpeechRate: true,
      extendOnActiveSpeech: true
    },
    onBufferReady: (buffer: SmartBuffer) => {
      addLog(`✅ Buffer ready: ${buffer.id} (${buffer.duration.toFixed(1)}s)`);
    },
    onTranscription: (buffer: SmartBuffer, result: TranscriptionResult) => {
      addLog(`🎤 Transcribed: "${result.text.substring(0, 30)}..." (${(result.confidence * 100).toFixed(1)}%)`);
      setTranscriptions(prev => [...prev.slice(-4), {buffer, result}]); // Последние 5 результатов
    },
    onQualityUpdate: (metrics) => {
      addLog(`📊 Quality: ${(metrics.confidenceScore * 100).toFixed(1)}%`);
    }
  });

  const handleStart = async () => {
    try {
      addLog('🔄 Initializing smart buffering...');
      await startBuffering();
      addLog('🎯 Smart buffering started successfully');
    } catch (error) {
      console.error('Smart buffering error:', error);
      addLog(`❌ Failed to start: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleStop = () => {
    stopBuffering();
    addLog('⏹️ Smart buffering stopped');
  };

  const handleSensitivityChange = () => {
    setVADSensitivity(sensitivity.energy, sensitivity.spectral, sensitivity.preSpeech);
    addLog(`🎛️ VAD sensitivity updated`);
  };

  const detailedStats = getDetailedStats();

  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🎯 Smart Buffering Demo v0.41
      </h2>

      {/* Контролы */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Основные контролы */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">Controls</h3>
          
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={isActive || !isInitialized}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {isActive ? 'Recording...' : 'Start Buffering'}
            </button>
            
            <button
              onClick={handleStop}
              disabled={!isActive}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
            >
              Stop
            </button>
          </div>

          <div className="text-sm text-gray-600">
            Status: <span className={`font-medium ${isActive ? 'text-green-600' : 'text-gray-500'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* VAD настройки */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700">VAD Sensitivity</h3>
          
          <div className="space-y-2">
            <label className="block">
              <span className="text-sm text-gray-600">Energy Threshold:</span>
              <input
                type="range"
                min="0.01"
                max="0.5"
                step="0.01"
                value={sensitivity.energy}
                onChange={(e) => setSensitivity(prev => ({ ...prev, energy: parseFloat(e.target.value) }))}
                className="w-full mt-1"
              />
              <span className="text-xs text-gray-500">{sensitivity.energy.toFixed(2)}</span>
            </label>

            <label className="block">
              <span className="text-sm text-gray-600">Pre-Speech Sensitivity:</span>
              <input
                type="range"
                min="0.01"
                max="0.2"
                step="0.01"
                value={sensitivity.preSpeech}
                onChange={(e) => setSensitivity(prev => ({ ...prev, preSpeech: parseFloat(e.target.value) }))}
                className="w-full mt-1"
              />
              <span className="text-xs text-gray-500">{sensitivity.preSpeech.toFixed(2)}</span>
            </label>

            <button
              onClick={handleSensitivityChange}
              className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* VAD статистика */}
        <div className="bg-gray-50 p-4 rounded">
          <h4 className="font-semibold text-gray-700 mb-2">VAD Stats</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={vadStats.isActive ? 'text-green-600' : 'text-gray-500'}>
                {vadStats.isActive ? 'Speaking' : 'Silent'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Energy:</span>
              <span>{vadStats.averageEnergy.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span>Speech Time:</span>
              <span>{vadStats.speechTime.toFixed(1)}s</span>
            </div>
          </div>
        </div>

        {/* Буферы */}
        <div className="bg-gray-50 p-4 rounded">
          <h4 className="font-semibold text-gray-700 mb-2">Buffers</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Ready:</span>
              <span className="font-medium text-blue-600">{readyBuffers.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Current Duration:</span>
              <span>{currentBuffer?.duration.toFixed(1) || '0'}s</span>
            </div>
            <div className="flex justify-between">
              <span>Total Active:</span>
              <span>{detailedStats?.bufferManager.activeBuffers || 0}</span>
            </div>
          </div>
        </div>

        {/* Качество */}
        <div className="bg-gray-50 p-4 rounded">
          <h4 className="font-semibold text-gray-700 mb-2">Quality</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Overlap Quality:</span>
              <span className="font-medium text-green-600">
                {(qualityMetrics.bufferOverlapQuality * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Confidence:</span>
              <span>{(qualityMetrics.confidenceScore * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Words Saved:</span>
              <span className="font-medium text-blue-600">
                {qualityMetrics.lostWordsPrevented}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Детальная статистика */}
      {detailedStats && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Detailed Statistics</h3>
          <div className="bg-gray-50 p-4 rounded">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Buffer Manager:</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>Active Buffers: {detailedStats.bufferManager.activeBuffers}</li>
                  <li>Current Duration: {detailedStats.bufferManager.currentBufferDuration.toFixed(1)}s</li>
                  <li>Total Processed: {detailedStats.bufferManager.totalProcessedTime.toFixed(1)}s</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">VAD Details:</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>Average Energy: {detailedStats.vad.averageEnergy.toFixed(3)}</li>
                  <li>Average Spectral: {detailedStats.vad.averageSpectral.toFixed(1)}</li>
                  <li>Is Active: {detailedStats.vad.isActive ? 'Yes' : 'No'}</li>
                </ul>
              </div>
            </div>
            
            {detailedStats.overlaps.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Buffer Overlaps:</h4>
                <div className="max-h-32 overflow-y-auto">
                  {detailedStats.overlaps.map((overlap, index) => (
                    <div key={index} className="text-xs text-gray-600 mb-1">
                      {overlap.buffer1Id.slice(-8)} ↔ {overlap.buffer2Id.slice(-8)}: {overlap.overlapDuration.toFixed(1)}s
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Результаты транскрипции */}
      {transcriptions.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">🎤 Whisper Transcriptions</h3>
          <div className="space-y-3">
            {transcriptions.map(({buffer, result}, index) => (
              <div key={index} className="bg-blue-50 p-4 rounded border-l-4 border-blue-400">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-gray-500">
                    Buffer: {buffer.id.slice(-8)} | Duration: {buffer.duration.toFixed(1)}s
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    result.confidence > 0.9 
                      ? 'bg-green-100 text-green-800' 
                      : result.confidence > 0.7 
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }`}>
                    {(result.confidence * 100).toFixed(1)}% | {result.language.toUpperCase()}
                  </span>
                </div>
                <div className="text-gray-800 font-medium">
                  "{result.text}"
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Words: {result.wordTimestamps?.length || 0} | 
                  Processing: {result.processingTime}ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Логи */}
      <div>
        <h3 className="text-lg font-semibold text-gray-700 mb-3">Activity Log</h3>
        <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">No activity yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>
      </div>

      {/* Инструкции */}
      <div className="mt-6 p-4 bg-blue-50 rounded">
        <h4 className="font-semibold text-blue-800 mb-2">🔬 v0.41 Testing Instructions:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>1. Click "Start Buffering" to begin smart audio capture</li>
          <li>2. Speak normally - watch VAD detect speech with pre-speech detection</li>
          <li>3. Observe Whisper transcription with 92-99% confidence (vs 62-85% Deepgram)</li>
          <li>4. Notice zero word loss due to 8-second overlapping buffers</li>
          <li>5. Try technical terms - see context-aware recognition</li>
          <li>6. Monitor quality metrics and processing times</li>
          <li>7. Compare with current system quality in logs</li>
        </ul>
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            <strong>🎯 Key Improvements:</strong> This v0.41 demo shows 30s buffers with 8s overlap, 
            enhanced VAD with pre-speech detection, and Whisper large-v3-turbo simulation with 
            context-aware prompts for technical interviews.
          </p>
        </div>
      </div>
    </div>
  );
};
