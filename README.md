# Flauxus — La flautista aumentada y su ecosistema interactivo

Prototipo interactivo 3D para web desarrollado con Three.js, audio espacial y sistema de navegación por salas y NavMesh.

## Tecnologías
- **Three.js** (v0.186.1)
- **Web Audio API**
- **JavaScript (ES Modules)** / **HTML5 Canvas** / **CSS3**
- Modelos 3D en formato FBX con texturas FBM

## Estructura de las salas

Cada nivel vive en su propio módulo dentro de `rooms/` y exporta dos cosas:

- `meta`: la ficha de la sala (id, nota, título, descripción, fuente de audio, avatar, objetivo, controles, preset de luz y locución).
- La implementación jugable (`build`, `start`, `update`, `update3d`, `draw`, `stop`, y opcionalmente `onKey`, `onDown`, `cam`).

| Archivo | Sala |
| --- | --- |
| `rooms/DO.js` | 1 · DO — El sonido bello |
| `rooms/RE.js` | 2 · RE — El pulso |
| `rooms/MI.js` | 3 · MI — El fraseo |
| `rooms/FA.js` | 4 · FA♯ — El cuerpo |
| `rooms/SOL.js` | 5 · SOL♯ — El unicornio cyborg |
| `rooms/LA.js` | 6 · LA♯ — MataЯ al padre |

`rooms/context.js` expone bindings vivos hacia `GameContext.js` (`GX`), de modo que cada sala conserva nombres cortos (`W`, `H`, `S`, `ctx`, `T`, `LIME`…) sin depender de variables globales. `Rooms.js` es solo el registro: agrupa las fichas, las implementaciones, los textos de locución y las etiquetas de los disparadores que consume `flow.js`.

Cada ficha puede incluir además:

- `meta.motif(x, m, cx, cy, s)`: dibuja la huella de esa sala en el atrio y en el epílogo.
- `meta.nav`: calibración del atrio para esa sala. `cue` es la posición del círculo guía en el suelo; `portal` ajusta el aro de luz; `blockedStair` (opcional) marca un tramo de escalera que el NavMesh debe bloquear. `NavMesh.js` ya no contiene tablas por sala: `Main.js` construye `navCal` desde `ROOMS` y lo inyecta con `navInit()`.

Los alias de URL (`?room=do`, `?room=do4`, `?room=re`…) se derivan automáticamente del campo `key` de cada ficha.

## Organización del código

`Main.js` es solo el punto de entrada: inicializa módulos, cablea la entrada y ejecuta el bucle. El resto está separado por responsabilidad:

| Ruta | Contenido |
| --- | --- |
| `player.js` | Movimiento en tercera persona, física de rampas, cámara, picking del atrio, guía de luz y piloto automático. |
| `flow.js` | Arranque, entrada/salida de salas, ficha, final y vuelta al atrio. |
| `NavMesh.js` | Rasterizado de colisiones, alturas, A* y rutas. La calibración por sala llega por `navInit()`. |
| `core/` | `util.js` (primitivas), `config.js` (entrada, baraja, calidad, preludio), `state.js` (`S`, salas, generaciones), `time.js` (`T`), `voiceState.js` (`VO`) e `inputState.js` (puntero y teclas). |
| `engine/` | `renderer.js`, `materials.js`, `fx.js` (canvas 2D), `avatar.js`, `lighting.js` y `ground.js`. |
| `atrium/` | `atrium.js`: escaleras, portales, bloques orbitales, huella y `HUELLA_CONFIG`. |
| `ui/` | `hud.js`, `voice.js`, `prelude.js`, `epilogue.js`, `debug.js` y `toast.js`. |
| `rooms/` | Las seis salas, `context.js` y `motif.js`. |

### Añadir o mover una sala
1. Crear `rooms/<ID>.js` con `export const meta = {…}` y `export const <ID> = (() => { … })()`.
2. Importar ambos en `Rooms.js` y añadirlos a `ROOM_IMPLS` y `ROOMS`.
3. Si la sala necesita calibración propia en el atrio, añadir `meta.nav`; si tiene huella, añadir `meta.motif`. No hace falta tocar `Main.js`.

## Ejecución
El proyecto no tiene paso de compilación. Sirve la carpeta por HTTP (por ejemplo, `python -m http.server`) y abre `index.html`; abrirlo con `file://` limita la carga de audio y módulos.

## Recursos para la web (optimizados)
Los `.fbx` y `.wav` de la raíz son los **másters**: se conservan en el repo, pero no se publican (ver `.webignore`).
El juego carga versiones optimizadas:

| Carpeta | Contenido | Cómo se genera |
| --- | --- | --- |
| `modelos/` | Atrio y seis salas en GLB: mismos triángulos, geometría meshopt, texturas WebP (243 MB → 44 MB) | `node tools/optimizar-escenarios.mjs` (requiere Blender 4.5+ y `npm install` en `../landing`) |
| `audio/` | Grabaciones en Ogg Vorbis (Chrome/Firefox) y AAC `.m4a` (Safari/iOS), ~192 kbps (270 MB → ~33 MB por navegador) | `ffmpeg -i X.wav -c:a libvorbis -q:a 6 audio/X.ogg` y `ffmpeg -i X.wav -c:a aac -b:a 192k -movflags +faststart audio/X.m4a` (mono: `-q:a 4` / `96k`) |

Si se edita un escenario o una grabación, se vuelve a generar su versión optimizada. `?fbx` carga los FBX
originales para comparar. Los personajes (`personaje/*_rig_Run.fbx`) siguen en FBX: su animación depende de
los nombres y poses de los huesos.
