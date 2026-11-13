// Iteración 5 · transcripción LOCAL de las locuciones (Whisper en onnxruntime-node; el audio no sale de la máquina).
// Uso: node it5_whisper.mjs [modelo]   → it5_voz/<SALA>.words.json  ([{w,t0,t1}])
import { pipeline } from '@huggingface/transformers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url)), V = path.join(DIR, 'it5_voz');
const MODEL = process.argv[2] || 'onnx-community/whisper-small_timestamped';
function wav16(file) { // PCM 16 bit mono 16 kHz → Float32Array
  const b = fs.readFileSync(file); let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4);
  const n = b.readUInt32LE(o + 4) / 2, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return f;
}
const asr = await pipeline('automatic-speech-recognition', MODEL, { dtype: 'fp32' });
for (const id of ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA']) {
  const out = await asr(wav16(path.join(V, id + '.16k.wav')), { language: 'spanish', task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 });
  const words = out.chunks.map(c => ({ w: c.text.trim(), t0: +c.timestamp[0].toFixed(2), t1: +(c.timestamp[1] ?? c.timestamp[0]).toFixed(2) }));
  fs.writeFileSync(path.join(V, id + '.words.json'), JSON.stringify({ modelo: MODEL, texto: out.text.trim(), words }, null, 1));
  console.log('==', id, '\n' + out.text.trim());
}
