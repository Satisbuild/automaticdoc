// Talegenkendelse (Whisper). Kører i baggrunden, så siden ikke fryser.
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/transformers.min.js';

let asr = null;

async function load(model) {
  const files = new Map();
  const progress_callback = (p) => {
    if (p.status !== 'progress' || !p.total) return;
    files.set(p.file, [p.loaded, p.total]);
    let loaded = 0, total = 0;
    for (const [l, t] of files.values()) { loaded += l; total += t; }
    postMessage({ type: 'download', loaded, total });
  };
  const id = `onnx-community/whisper-${model}`;
  const hasGpu = !!(self.navigator.gpu && await self.navigator.gpu.requestAdapter().catch(() => null));
  if (hasGpu) {
    try {
      return await pipeline('automatic-speech-recognition', id, {
        device: 'webgpu',
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
        progress_callback,
      });
    } catch (e) {
      console.warn('Grafikkortet kunne ikke bruges, skifter til processoren.', e);
    }
  }
  return pipeline('automatic-speech-recognition', id, { dtype: 'q8', progress_callback });
}

onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') {
      asr = await load(data.model);
      postMessage({ type: 'ready' });
    } else if (data.type === 'transcribe') {
      const out = await asr(data.audio, {
        language: data.language || null,
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
      });
      postMessage({ type: 'result', chunks: out.chunks || [{ text: out.text, timestamp: [0, null] }] });
    }
  } catch (e) {
    postMessage({ type: 'error', message: String((e && e.message) || e) });
  }
};
