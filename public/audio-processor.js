class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    if (input.length > 0) {
      const inputChannel = input[0];
      let sum = 0;
      
      for (let i = 0; i < inputChannel.length; i++) {
        sum += inputChannel[i] * inputChannel[i];
      }
      
      const rms = Math.sqrt(sum / inputChannel.length);
      const level = Math.min(1, rms * 5);
      
      this.port.postMessage(level);
    }
    
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
