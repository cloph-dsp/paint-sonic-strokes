class RecorderWorkletProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelCopies = input.map(channel => channel.slice());
    this.port.postMessage(channelCopies);
    return true;
  }
}

registerProcessor('recorder-worklet', RecorderWorkletProcessor);
