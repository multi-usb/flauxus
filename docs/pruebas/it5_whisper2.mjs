// Iteración 5 · segunda opinión (solo texto) con otro modelo Whisper local, para marcar palabras dudosas.
import { pipeline } from '@huggingface/transformers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url)), V = path.join(DIR, 'it5_voz');
const MODEL = process.argv[2] || 'onnx-community/whisper-large-v3-turbo', DT = process.argv[3] || 'q8';
function wav16(file) { const b = fs.readFileSync(file); let o = 12; while (b.toString('ascii', o, o + 4) !== 'data') o += 8 + b.readUInt32LE(o + 4); const n = b.readUInt32LE(o + 4) / 2, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return f; }
const asr = await pipeline('automatic-speech-recognition', MODEL, { dtype: DT });
const out = {};
for (const id of ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA']) { const r = await asr(wav16(path.join(V, id + '.16k.wav')), { language: 'spanish', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 }); out[id] = r.text.trim(); console.log('==', id, '\n' + out[id]); }
fs.writeFileSync(path.join(V, 'segunda_opinion.json'), JSON.stringify({ modelo: MODEL, dtype: DT, out }, null, 1));
