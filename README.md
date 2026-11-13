# FLAUXUS

Landing interactiva y videojuego web integrados en un solo producto. Entrega para desarrollo correspondiente a la iteración 5 (13 de noviembre de 2026).

## Estructura

| Carpeta | Contenido |
|---|---|
| `landing/` | Landing con scroll narrativo (Vite 5 + GSAP + Three.js) |
| `juego/` | Videojuego (Three.js 0.186 por importmap, sin compilación propia) |
| `docs/` | Informes técnicos, scripts de prueba y evidencias |
| `fuentes/` | Guion técnico y locuciones originales en `.wav` |

`landing/` y `juego/` deben quedar como carpetas hermanas: la landing sirve el juego desde `../juego`.

## Arrancar en local

Requiere Node 18 o superior (probado con Node 22).

```bash
cd landing
npm install
npm run dev
```

- Landing: http://localhost:5173
- Juego solo: http://localhost:5173/juego/
- Producción: `npm run build` genera `landing/dist/` con la landing y el juego en `dist/juego/`.

Parámetros útiles del juego: `?room=1…6` (entra directo a una sala), `?input=touch` (fuerza controles táctiles), `?entry=fanzine|poster|cards` (entradas desde los productos físicos), `?dev`, `?perf`.

## Documentación

- [LEEME.md](LEEME.md): estado de la entrega, estructura y pendientes.
- [docs/INFORME.md](docs/INFORME.md): informe técnico general.
- [docs/INFORME_iteracion5.md](docs/INFORME_iteracion5.md): últimos cambios, pruebas y trabajo pendiente.
- [juego/README.md](juego/README.md): arquitectura del videojuego.

## Historial

Este repositorio reúne los historiales de `landing/` y `juego/`. Las etiquetas de restauración están prefijadas para evitar colisiones:

- `landing/pre-refinamiento-2026-11-09`, `landing/pre-iteracion3-2026-11-09`, `landing/pre-iteracion4-2026-11-10`, `landing/pre-iteracion5-2026-11-12`
- `juego/pre-refinamiento-2026-11-09`, `juego/pre-iteracion3-2026-11-09`, `juego/pre-iteracion4-2026-11-10`, `juego/pre-iteracion5-2026-11-12`

## Tecnologías

Vite 5, GSAP, Three.js, WebGL, Web Audio API y CSS con tokens tipográficos. El juego carga Three.js desde un CDN mediante importmap.

## Notas

- `juego/` incluye los másters FBX y WAV (unos 642 MB). El archivo `.webignore` deja fuera de la publicación los que no necesita el juego.
- `juego/Stockhausen.wav` (máster estéreo 48 kHz, 122 MB) se guarda con **Git LFS**: instala Git LFS antes de clonar para descargar el archivo real; sin él, llega como puntero.
- `landing/node_modules/` y `landing/dist/` no se versionan: se regeneran con `npm install` y `npm run build`.
