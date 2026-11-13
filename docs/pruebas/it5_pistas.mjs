// Iteración 5 · genera juego/audio/locucion/pistas.js (subtítulos por frases, sincronizados con la locución).
//
// Entradas (todas locales):
//   it5_voz/<SALA>.16k.wav     → los .wav originales a 16 kHz mono (ffmpeg; ver PASOS)
//   it5_voz/<SALA>.words.json  → marcas por palabra de Whisper local (node it5_whisper.mjs)
//   SEGMENTOS (abajo)          → el texto que SE OYE, ya corregido a mano y partido en frases
// Salida: pistas.js con { t0, t1, texto, w } por frase (w = inicio de cada palabra, en segundos).
//
// PASOS para regenerar todo desde los .wav:
//   1. ffmpeg -i "Locución DO.wav" -ac 1 -ar 16000 -c:a pcm_s16le it5_voz/DO.16k.wav   (ídem RE, MI, FA, SOL, LA)
//   2. node it5_whisper.mjs        (marcas por palabra)      · node it5_whisper2.mjs (segunda opinión, solo texto)
//   3. node it5_pistas.mjs         (este archivo)            · node it5_audio.mjs (ogg + m4a normalizados)
//
// Cómo salen los tiempos: el inicio de cada frase es el de su primera palabra según Whisper; si la frase viene
// tras una pausa detectada por ffmpeg (silencedetect), se ajusta al final exacto de esa pausa. El final es el
// de la última palabra o el comienzo de la pausa siguiente. Las palabras del texto corregido se emparejan una a
// una con las de Whisper (mismo número de palabras): las que difieren se listan como «diferencias».
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url)), V = path.join(DIR, 'it5_voz');
const OUT = 'C:/Users/jaime/Desktop/sesión-vibe-coding/flauxus/juego/audio/locucion/pistas.js';

const SEGMENTOS = {
  DO: [
    'Construir un cuerpo disciplinado para la interpretación',
    'de música académica occidental implica un conflicto silencioso:',
    'una tensión entre la estandarización de la práctica',
    'y la demanda de ser yo, una artista única y original.',
  ],
  RE: [
    'El metrónomo se patentó en 1815',
    'y fue percibido como un instrumento que permitiría tener',
    'una indicación matemática del tempo,',
    'independiente del conocimiento de las convenciones interpretativas',
    'propias de los géneros musicales o los estilos nacionales.',
    'Así habría la posibilidad de tener',
    'una aproximación mecánica al tempo y al ritmo.',
    'Hummel decía que con esta herramienta',
    'una obra podría tocarse al mismo tempo en cualquier parte del mundo,',
    'toda una ventaja para la composición.',
    'Sin embargo, los intérpretes se demoraron más',
    'en adoptarlo como compañero de estudio.',
    'Se consideraba una referencia más que una indicación de pulso constante,',
    'pues, aun hasta el siglo XX,',
    'las variaciones sutiles de tempo eran comunes y deseables.',
    'De hecho, se instaba a los tecladistas',
    'a mantener el pulso con una mano y modificarlo con la otra.',
    '¿Podremos volver a deshacernos del yugo del metrónomo?',
  ],
  MI: [
    '¿Hay realmente una intención?',
    '¿Trasciende la ganancia que suponía el componer?',
    'Y, si la hay ¿Puedo acceder a ella?',
    '¿Necesito acceder a ella?',
    'Con o sin conocimiento de la intención, el canon suena.',
    'Y ha sonado. Y seguirá sonando con o sin mí (con o sin ti).',
    'Tal vez la revelación es que no hay nada que entender',
    'y, si lo hay, está perdido.',
    'De lo único de lo que puedo estar segura, es de mi intención.',
  ],
  FA: [
    'Sobrevivimos buscando la propia voz sobre una técnica estandarizada,',
    'modificándonos para ella,',
    'muy rara vez modificando la obra para que se amolde a nosotras.',
    'Hablamos sobre nuestro cuerpo para reprocharle lo que no podemos hacer,',
    'pero dejamos de lado que la dimensión corporal no se agota en la técnica',
    'y que concientizar esto nos podría dotar de agencia.',
  ],
  SOL: [
    'Nadie me lo dijo explícitamente,',
    'tardé años en desenmarañar esa tensión incómoda',
    'y encontrar este conflicto iluminador.',
    'Ahora queda el vacío de entender que no importa qué haga,',
    'nunca estaré en gracia con todos.',
    'Entonces puedo hacer lo que quiera.',
  ],
  LA: [
    'En este proyecto, la idea de matar al padre es una metáfora',
    'que funciona como detonante creativo',
    'y se refiere a cómo, desde mi posición de intérprete,',
    'asumo un lugar de autoridad frente a la tradición,',
    'al compositor como figura ideal y a la obra como ente cerrado,',
    'y tomo agencia sobre mi instrumento,',
    'las técnicas instrumental y compositiva,',
    'los rituales de enunciación y, sobre todo, las obras.',
    'Planteo la exploración de esa agencia desde el concepto de intervención,',
    'que, dentro de las prácticas artísticas de los siglos XX y XXI,',
    'se refiere a acciones o performances en los que se interactúa',
    'con objetos o espacios preexistentes (entre ellos obras)',
    'para modificarlos o generar nuevos sentidos a partir de ellos.',
    'Así, busco intervenir obras del repertorio canónico para flauta',
    'con elementos propios de la práctica contemporánea,',
    'como las técnicas extendidas, la electrónica y la improvisación,',
    'para generar nuevas interpretaciones desde una perspectiva',
    'no sólo centrada en la partitura,',
    'sino también en su tradición interpretativa, sus referencias',
    'y la manera en la que yo, como intérprete, elijo relacionarme con ellas.',
  ],
};
const SALAS = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA'];
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9ñ]/g, '');
const r2 = x => Math.round(x * 100) / 100;

function silencios(id) { // pausas reales de la grabación (más finas que las del diagnóstico: −38 dB, ≥ 0,15 s)
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', path.join(V, id + '.16k.wav'), '-af', 'silencedetect=noise=-38dB:d=0.15', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const ini = [...r.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), fin = [...r.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  const dur = +spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(V, id + '.16k.wav')], { encoding: 'utf8' }).stdout;
  return { sil: ini.map((s, i) => [s, fin[i] ?? dur]), dur };
}

const pistas = {}, informe = [], crudas = [], SESGO = [];
SALAS.forEach((id, k) => {
  const W = JSON.parse(fs.readFileSync(path.join(V, id + '.words.json'), 'utf8')).words, { sil, dur } = silencios(id);
  const frases = SEGMENTOS[id], total = frases.join(' ').split(/\s+/).length;
  if (total !== W.length) throw new Error(`${id}: ${total} palabras en el texto y ${W.length} en Whisper: revisar el emparejado`);
  let i = 0; const segs = [], dif = [], ajuste = [];
  for (const texto of frases) {
    const pal = texto.split(/\s+/), ws = W.slice(i, i + pal.length);
    pal.forEach((p, j) => { if (norm(p) !== norm(ws[j].w)) dif.push(`«${ws[j].w}» → «${p}» (${ws[j].t0} s)`) });
    let t0 = ws[0].t0, pausa = false;
    const antes = sil.find(([, e]) => e >= t0 - .45 && e <= t0 + .5);            // la frase arranca al acabar una pausa
    if (antes) { ajuste.push(r2(t0 - antes[1])); console.log("   pausa→", id, texto.slice(0, 22), r2(t0), "→", r2(antes[1])); SESGO.push(t0 - antes[1]); t0 = antes[1]; pausa = true }
    segs.push({ t0, t1: ws[ws.length - 1].t1, texto, pausa, ult: ws[ws.length - 1].t0, w: ws.map(x => x.t0) }); i += pal.length;
  }
  crudas.push({ id, k, segs, sil, dur, dif, ajuste, total });
});
/* Whisper marca el inicio de cada palabra algo después del ataque real: se mide en las frases que siguen a una
   pausa (donde ffmpeg da el instante exacto) y esa mediana se descuenta en las que no tienen pausa delante. */
SESGO.sort((x, y) => x - y); const sesgo = SESGO[SESGO.length >> 1] || 0;
console.log('retraso mediano de Whisper respecto del ataque real:', r2(sesgo), 's · n =', SESGO.length, '· máx', r2(SESGO[SESGO.length - 1]));
for (const { id, k, segs, sil, dur, dif, ajuste, total } of crudas) {
  segs.forEach((s, j) => {
    if (!s.pausa) s.t0 = Math.max(0, s.t0 - sesgo);
    s.w = s.w.map(x => x - sesgo); s.w[0] = s.t0; for (let n = 1; n < s.w.length; n++) s.w[n] = Math.max(s.w[n], s.w[n - 1] + .02);
  });
  segs.forEach((s, j) => { // fin: donde empieza la pausa que sigue a la última palabra; si no hay, donde arranca la frase siguiente
    const tope = j < segs.length - 1 ? segs[j + 1].t0 : dur, p = sil.find(([a]) => a > s.ult - sesgo + .08 && a <= tope + .02);
    s.t1 = p ? p[0] : Math.min(s.t1, tope); s.t1 = Math.min(Math.max(s.t1, s.t0 + .3), tope);
    s.t0 = r2(s.t0); s.t1 = r2(s.t1); s.w = s.w.map(r2); s.w[0] = s.t0; delete s.pausa; delete s.ult;
  });
  pistas[k + 1] = { sala: id, audio: 'audio/locucion/' + id, dur: r2(dur), segs };
  const largo = segs.map(s => s.texto.length), d = segs.map(s => s.t1 - s.t0);
  informe.push({ sala: id, segmentos: segs.length, duracion: r2(dur), palabras: total, 'car. máx': Math.max(...largo), 'seg mín (s)': r2(Math.min(...d)), 'seg máx (s)': r2(Math.max(...d)), 'Whisper vs pausa (máx s)': ajuste.length ? Math.max(...ajuste.map(Math.abs)) : 0, 'frases tras pausa': ajuste.length });
  console.log(`\n== ${id} · diferencias Whisper → subtítulo (${dif.length})\n  ` + (dif.join('\n  ') || '—'));
  segs.forEach(s => console.log(`  ${String(s.t0).padStart(5)} – ${String(s.t1).padStart(5)}  ${s.texto}`));
}
console.table(informe);

const q = s => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
let js = `/* ======================================================================
   FLAUXUS — audio/locucion/pistas.js
   Subtítulos de la locución en off, por frases y con los tiempos de cada
   grabación (audio/locucion/<SALA>.ogg · .m4a). ARCHIVO GENERADO: no se
   edita a mano. Lo escribe el script it5_pistas.mjs del banco de pruebas a
   partir de las marcas por palabra de un Whisper local y de las pausas
   reales del audio; el texto es el que SE OYE en la grabación.

   Por sala (clave = id de la sala):
     audio  ruta sin extensión · dur  duración en segundos
     segs   frases en orden: t0 y t1 (s) = cuándo empieza y termina de
            decirse · texto · w = segundo en que empieza cada palabra
            (sirve para partir la frase con precisión si no cabe en dos
            líneas en una pantalla estrecha: ui/voice.js)
   ====================================================================== */
export const PISTAS = {\n`;
for (const [id, p] of Object.entries(pistas)) {
  js += `  ${id}: {\n    sala: ${q(p.sala)}, audio: ${q(p.audio)}, dur: ${p.dur},\n    segs: [\n`;
  js += p.segs.map(s => `      { t0: ${s.t0}, t1: ${s.t1}, texto: ${q(s.texto)},\n        w: [${s.w.join(', ')}] }`).join(',\n') + `\n    ]\n  },\n`;
}
js = js.replace(/,\n$/, '\n') + '};\n';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, js.replace(/\n/g, '\r\n'));
fs.writeFileSync(path.join(V, 'pistas.json'), JSON.stringify(pistas, null, 1));
console.log('\nescrito', OUT);
