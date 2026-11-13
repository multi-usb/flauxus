# FLAUXUS — entrega para desarrollo

Estado al 13 de noviembre de 2026, tras la iteración 5. Landing y videojuego integrados en un solo producto web.

## Qué hay en esta carpeta

```
FLAUXUS_entrega-desarrollador_2026-11-13/
├── LEEME.md            ← este archivo
├── landing/            ← landing (Vite 5 + GSAP + Three.js) · repo git con historial
├── juego/              ← videojuego (Three.js 0.186 por importmap, sin compilación) · repo git con historial
├── docs/
│   ├── INFORME.md              ← informe técnico general; enlaza los de cada iteración
│   ├── INFORME_iteracion5.md   ← lo último: qué cambió, qué se probó y qué queda pendiente
│   ├── pruebas/                ← scripts de prueba automática (Chrome sin ventana + puppeteer-core)
│   └── evidencias/             ← capturas y registros de cada iteración
└── fuentes/
    ├── GTI_REWIND_Corregido_Final_v3.docx   ← guion técnico de interacción (fuente oficial de textos)
    └── locuciones/                          ← narraciones originales en .wav, una por sala
```

`landing/` y `juego/` deben quedar como carpetas hermanas: la landing sirve el juego desde `../juego`.

## Arrancar en local

Requisito: Node 18 o superior (probado con Node 22).

```bash
cd landing
npm install
npm run dev
```

- Landing: http://localhost:5173
- Juego solo: http://localhost:5173/juego/
- Producción: `npm run build` genera `landing/dist/` con la landing y el juego en `dist/juego/`.

El juego no tiene paso de compilación propio. Si se mueve a otra ruta: `FLAUXUS_GAME_DIR=/ruta/al/juego npm run dev`.

Parámetros útiles del juego: `?room=1…6` (entra directo a una sala), `?input=touch` (fuerza controles táctiles), `?entry=fanzine|poster|cards` (entradas desde los productos físicos), `?dev`, `?perf`.

## Dónde está cada cosa

**Landing** (`landing/src/`)

| Ruta | Contenido |
|---|---|
| `moments/m1…m6-*.js` | Los seis momentos del recorrido por scroll |
| `scenes/` | Escenas WebGL (héroe con lluvia de palabras, portal, radiografía) |
| `ui/game.js` | Apertura y cierre del juego en un marco del mismo origen |
| `styles/fonts.css` | Escala tipográfica (`--fs-xs` … `--fs-display`) |
| `styles/main.css` | Estilos y reglas responsive |

**Juego** (`juego/`)

| Ruta | Contenido |
|---|---|
| `Main.js`, `flow.js`, `player.js` | Entrada, fases de la partida, avatar y cámaras |
| `rooms/DO.js … LA.js` | Una sala por archivo (ficha + minijuego) |
| `ui/voice.js` | Narración con subtítulos por frases |
| `audio/locucion/` | Voz comprimida (`.ogg`, `.m4a`) y `pistas.js` con los tiempos de cada frase |
| `engine/` | Avatar, luces, holograma, cielo |
| `style.css` | HUD y menú; los bloques «ITERACIÓN 5» están al final |
| `.webignore` | Másters que no se publican al compilar (FBX, WAV, herramientas) |

`juego/README.md` documenta la arquitectura del juego con más detalle.

## Historial y puntos de restauración

Los dos repos conservan todo el historial. Etiquetas para volver a un estado anterior:

| Etiqueta | Estado |
|---|---|
| `pre-refinamiento-2026-11-09` | Antes del refinamiento |
| `pre-iteracion3-2026-11-09` | Antes de la iteración 3 |
| `pre-iteracion4-2026-11-10` | Antes de la iteración 4 |
| `pre-iteracion5-2026-11-12` | Antes de la iteración 5 |

Últimos commits: landing `54f3cd7`; juego `f500a7d`. Estas copias no tienen ningún remoto configurado y nada se ha publicado.

## Pruebas automáticas

Los scripts de `docs/pruebas/` usan Chrome instalado en el equipo y `puppeteer-core`:

```bash
cd docs/pruebas
npm init -y
npm install puppeteer-core
node audit.mjs "0,1,2,3,4,5,6" "360x640" todo
```

Necesitan el servidor local en el puerto 5173. `lib.mjs` trae la ruta de Chrome para Windows (`C:/Program Files/Google/Chrome/Application/chrome.exe`); en otro sistema hay que ajustarla. Las capturas se guardan en una subcarpeta `shots/`. Conviene ejecutar un script a la vez; dos Chrome en paralelo se quitan la GPU y dan falsos fallos.

Regenerar los subtítulos tras corregir un texto: editar los segmentos en `it5_pistas.mjs` y volver a generar `juego/audio/locucion/pistas.js` (no editar `pistas.js` a mano).

## Pendientes principales

El detalle está en `docs/INFORME_iteracion5.md` § 5 y `docs/INFORME_iteracion4.md` § 6.

- **Sin probar en teléfonos reales.** Todo se verificó en Chrome de escritorio con táctil emulado. Falta Safari de iOS (usa el audio `.m4a`) y Chrome de Android.
- **Texto de la narración de RE** pendiente de revisión de oído: sale solo del reconocimiento de voz.
- **Escenario de SOL♯**: 318.604 triángulos; puede pesar en teléfonos de gama baja.
- **Three.js del juego** se carga desde CDN por importmap; alojarlo localmente está pendiente.
- **Rigs en FBX**: conversión a GLB pendiente.
- **Enlace de Instagram** de la landing: destino por definir.

## Peso

La carpeta pesa unos 1,9 GB, casi todo en `juego/` (másters FBX y WAV que el `.webignore` deja fuera de la publicación).

`landing/node_modules/` y `landing/dist/` vienen incluidos porque se instaló y compiló esta copia para comprobar que funciona (13 de noviembre de 2026, sin errores). Git los ignora y se pueden borrar: se regeneran con `npm install` y `npm run build`. `landing/dist/` (163 MB) es la versión lista para publicar.
