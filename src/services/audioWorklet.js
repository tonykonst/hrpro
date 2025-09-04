// Audio Worklet для получения PCM данных
class PCMProcessorWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const inputChannel = input[0];
      if (inputChannel.length > 0) {
        // Конвертируем Float32 в Int16
        const int16Array = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, inputChannel[i] * 32768));
        }
        
        // Отправляем PCM данные в основной поток
        this.port.postMessage({
          type: 'pcm-data',
          data: int16Array.buffer
        });
      }
    }
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessorWorklet);
