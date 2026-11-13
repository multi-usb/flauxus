// Iteración 5 · locuciones para la web. Lee los .wav originales (NO los toca) y escribe en juego/audio/locucion/
// <SALA>.ogg (Vorbis) y <SALA>.m4a (AAC ~96 kbps), mono 44,1 kHz, con loudnorm en dos pasadas (medir → aplicar).
// Uso: node it5_audio.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const SRC = 'C:/Users/jaime/Desktop/sesión-vibe-coding', OUT = path.join(SRC, 'flauxus/juego/audio/locucion');
const SALAS = { DO: 'Locución DO.wav', RE: 'Locución RE.wav', MI: 'Locución MI.wav', FA: 'Locución FA#.wav', SOL: 'Locución SOL#.wav', LA: 'Locución LA#.wav' };
const OBJ = 'I=-20:TP=-1.5:LRA=11';
fs.mkdirSync(OUT, { recursive: true });
const ff = a => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...a], { encoding: 'utf8' });
for (const [id, file] of Object.entries(SALAS)) {
  const src = path.join(SRC, file);
  const m = JSON.parse(ff(['-i', src, '-af', `loudnorm=${OBJ}:print_format=json`, '-f', 'null', '-']).stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
  const af = `loudnorm=${OBJ}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=summary`;
  const a = ff(['-y', '-i', src, '-af', af, '-ar', '44100', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '4', path.join(OUT, id + '.ogg')]);
  const b = ff(['-y', '-i', src, '-af', af, '-ar', '44100', '-ac', '1', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', path.join(OUT, id + '.m4a')]);
  const modo = (a.stderr.match(/Normalization Type:\s*(\w+)/) || [])[1], sal = (a.stderr.match(/Output Integrated:\s*([-\d.]+)/) || [])[1];
  console.log(id, 'entrada', m.input_i, 'LUFS · pico', m.input_tp, 'dBTP → salida', sal, 'LUFS ·', modo, a.status, b.status);
}
