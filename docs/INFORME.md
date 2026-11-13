# FLAUXUS · Informe técnico (v2 · 8 nov 2026)

v1 (recuperación desde OneDrive y diagnóstico del scroll): `respaldos/2026-11-08_recuperacion-desde-onedrive/INFORME_v1_recuperacion.md`.

## 1. Nuevos archivos vs. anteriores

| | OneDrive (zip, v1) | Google Drive (actual) |
|---|---|---|
| Landing | Faltaban `src/`, `public/`, `index.html`, `package.json` (recuperados desde git) | Completa · commit `568ec75`, sin cambios pendientes |
| Juego | **Vacío** (todo con `_Error.txt`) | **Completo** · 77 archivos, repo git con 5 commits (`16488ef`), sin cambios pendientes |
| `node_modules` | Incompleto | Completo |

- El código de la landing es **idéntico** en ambas versiones. Las únicas diferencias eran mis cambios
  del scroll (v1) y saltos de línea Windows/Unix.
- El juego es **Three.js 0.186 sin paso de compilación** (módulos ES + importmap desde jsDelivr), no React.
  Salas en `rooms/`, motor en `engine/`, interfaz en `ui/`; ver `juego/README.md`.

**Base elegida:** la exportación de Google Drive (completa y verificada) + el commit del scroll de v1, que se
trasladó con `git cherry-pick`. No se rehízo nada.

## 2. Organización

Ver el mapa en `README.md` de la raíz. Criterios:
- **originales/** = solo lectura, con fecha y origen en el nombre.
- **flauxus/** = lo activo; landing y juego como repos git separados (cada uno con su historial), docs aparte.
- **respaldos/** = trabajo previo que ya no es la base, para contrastar.
- No hay carpeta de "recursos compartidos": los únicos recursos de marca comunes viven en
  `landing/public/brand/` (logotipos) y `landing/src/styles/tokens.css` + `fonts.css` (colores y tipos).
  Duplicarlos ahora solo crearía dos fuentes de verdad; cuando la interfaz del juego los use (fase 3), se
  publican desde ahí.
- Los commits de esta sesión van a nombre de Jaime (los históricos son de `santi`).

### Propuesta de depuración (no se eliminó nada)

| Elemento | Tamaño | Propuesta |
|---|---|---|
| `originales/…onedrive…incompleto.zip` | 113 MB | Eliminar: está superado por la exportación de Google Drive |
| `respaldos/2026-11-08_recuperacion-desde-onedrive/` | 142 MB | Conservar solo `INFORME_v1_recuperacion.md`; el resto está en los repos activos |
| `originales/…gdrive…/flauxus-landing-clean/node_modules` y `dist/` | 108 MB | Regenerables con `npm install` / `npm run build` |
| `flauxus/landing/dist/` | 698 MB | Salida de compilación (ignorada por git); borrar cuando no se use |

Para borrar carpetas hace falta hacerlo a mano: el vigilante de comandos de este equipo bloquea `rm -r`.

## 3. Integración landing ↔ juego

**Arquitectura:** [ JUEGA YA ] abre el juego **dentro de la landing**, en una capa a pantalla completa con un
`<iframe>` del mismo origen (`landing/src/ui/game.js`).

Por qué iframe y no montarlo en el mismo documento ni navegar a otra página:
- **Aislamiento:** el juego escucha teclado/puntero en `window`, define su CSS global y usa Three.js 0.186.
  La landing usa 0.170. En el mismo documento habría conflictos; en el iframe no.
- **Continuidad:** la landing queda congelada debajo, en el mismo punto del scroll. Al salir (◀◀) el
  usuario sigue hacia «Un dispositivo de identidad» sin volver a la pantalla de inicio. Navegar a otra URL
  reiniciaba la landing (preloader + PRESS START).
- **Carga diferida y memoria:** el iframe se crea al abrir y se destruye al cerrar. Si nadie juega no se
  descarga nada del juego; al salir se libera su GPU y su audio.
- Mientras se juega, la landing no renderiza y su música se suspende (`experience.js`).

**Servidor:** plugin `flauxus-game` en `landing/vite.config.js`:
- `npm run dev`: sirve `../juego` en `/juego/`.
- `npm run build`: copia el juego a `dist/juego/` (sin `.git`). Otra ubicación: `FLAUXUS_GAME_DIR`.

El juego **no se modificó**.

Archivos tocados (landing): `index.html` (contenedor `#game`), `src/ui/game.js` (nuevo), `src/config.js`
(`GAME_URL = '/juego/'`), `src/moments/m2-portal.js`, `src/experience.js`, `src/styles/main.css`,
`vite.config.js`. Commits: `da52238` (scroll) y `f1c1ec8` (integración).

## 4. Scroll tras el videojuego (de v1, conservado)
Causa: densidad. Desde M3 se encadenaban 3–4 cuadros por pantalla de scroll. Solución: `SCROLL_SCREENS` en
`config.js` (M3 1,6→3,2 · M4 2,4→3,2 · M5 2,4→4,4). La coreografía se mantiene porque está en proporciones.

## 5. Pruebas (Chrome, servidor local)

| Prueba | Resultado |
|---|---|
| Juego solo en `/juego/` | Carga; todos los recursos 200; carga inicial 49 MB; sin errores de consola |
| Landing → portal → JUEGA YA | El juego abre dentro de la landing (escritorio 1371×725 y móvil 375×812) |
| Salir del juego (◀◀) | La landing vuelve al mismo punto (y = 2066), sin iframes residuales |
| 4 aperturas/cierres seguidos | 0 iframes residuales |
| Memoria | Landing 205 MB → 383 MB con el juego → **205 MB al cerrar** (sin retención) |
| Continuar tras jugar (escenario A) | M3 completa (6/6 notas) |
| Coreografía M3–M6 con nuevos tramos | Completa en escritorio y móvil (v1) |
| `npm run build` + `vite preview` | Landing y juego responden 200 (FBX 34 MB, WAV 100 MB incluidos) |
| Consola | Sin errores (solo falta `favicon.ico` del juego) |

**No verificado:** la jugabilidad completa de las 6 salas dentro del iframe, ni la sensación con gestos
reales (rueda, trackpad, táctil). Los fps tampoco: las pestañas automatizadas corren en segundo plano y
el navegador las frena. Las pruebas "móviles" usaron un iframe de 375×812 con ratón, no un teléfono.

## 6. Pendientes para completar FLAUXUS

1. ~~Optimizar los recursos del juego~~ **Hecho (sección 7).** Quedan dos mejoras posibles:
   - los personajes siguen en FBX (11 MB el rig inicial), porque su animación depende de nombres y poses de huesos;
   - texturas de 1024 px para móvil, para no descargar 2048 px y reducirlas en el teléfono.
2. **Fase 2 · móvil:** probar en teléfonos reales el joystick, el botón de caminar, la cámara y el modo
   de baja calidad, que el juego ya trae (`TOUCH` → `LOWQ`), y ajustar lo que falle.
3. **Fase 3 · cohesión visual:** el juego usa Fraunces + Instrument Sans y tarjetas color papel; la landing
   usa Tektur/Unbounded/Martian Mono/Pixelify Sans sobre negro con verde `#C2FE0B` (`tokens.css`). Hay que
   alinear la capa de interfaz del juego (`juego/style.css`, `ui/`). Incluye el logotipo: el ◀◀ de salida
   tapa hoy el wordmark del juego, que debería pasar al logotipo de la landing.
4. **Antes de publicar el juego:** `DEV_ENTRY_PICKER = true` en `juego/core/config.js` muestra
   "Simular entrada" (herramienta de prueba) a todos los usuarios.
5. El juego carga Three.js desde jsDelivr en tiempo de ejecución; conviene servirlo localmente para no
   depender de un CDN externo.
6. Publicar: nada se ha subido a GitHub ni a hosting. Un hosting estático debe aceptar archivos de
   ~100 MB (o hacer primero el punto 1).
7. **Locuciones:** el juego busca `Voz_*.mp3/.wav` y no existen en el proyecto; hoy muestra subtítulos con
   ritmo de lectura (comportamiento previsto por el propio juego).

## 7. Optimización de recursos del juego (v3)

| Recurso | Antes | Después | Cómo |
|---|---|---|---|
| 7 escenarios (atrio + salas) | 243 MB FBX | **44 MB** GLB | Blender → GLB sin simplificar; meshopt; texturas WebP; fuera la textura metal/rugosidad (el juego no la usa) |
| 5 grabaciones | 270 MB WAV | **~33 MB** (OGG) / ~40 MB (M4A) | Vorbis q6 / AAC 192 kbps (mono: q4 / 96 kbps); cada navegador baja un solo formato |
| Personajes sin rig + texturas duplicadas | 126 MB publicados | **0** | No se usaban; excluidos con `juego/.webignore` |
| **Publicación (`dist/`)** | **698 MB** | **160 MB** | Másters fuera de la build (siguen en el repo) |
| Atrio al entrar | 34 MB FBX, 3,5 s de procesado | 6,1 MB, 0,13 s | — |
| Cada sala | 30–41 MB + 34–97 MB de audio | 3–7,6 MB + 4,5–11 MB | — |

**Fidelidad comprobada:**
- Las 7 escenas tienen los mismos triángulos, proporciones y centro que sus FBX.
- Capturas del atrio y de la sala DO, con FBX y con GLB, idénticas salvo las partículas animadas.
- El audio decodificado dura lo mismo que el WAV.

Un detalle corregido: glTF guarda el canal verde del mapa de normales invertido, y `prepareMaterials`
lo pisaba. Ahora conserva el signo, y los FBX no cambian.

**Probado en producción** (`vite preview`): sala LA completa (escenario, avatar "body", audio de 571 s),
sin archivos faltantes.

Archivos: `juego/AssetManager.js`, `juego/AudioSystem.js`, `juego/.webignore`, `juego/tools/optimizar-escenarios.mjs`,
`juego/modelos/`, `juego/audio/`, `landing/vite.config.js`. Commits `9c7d777` (juego) y `81187d2` (landing).
`?fbx` carga los másters para comparar.

## 8. Cohesión visual: interfaz del juego (v4)

Solo cambió la capa de interfaz. Mecánicas, escenarios, luces, haces y colores 3D (`LIME` en
`core/util.js`) siguen igual.

| Elemento | Antes ("cuaderno de ensayo") | Ahora (sistema de la landing) |
|---|---|---|
| Verde | `#c9d000` | `#C2FE0B`. `tokens.css` lo registra como reemplazo del `#C9D200` |
| Fondos de interfaz | tinta cálida `#0d0e09` | negro `#000` |
| Tarjetas | papel crema con grano, cinta e inclinación | ficha carbón `#121212`, recta, borde `#383838` y barra verde |
| Titulares | Fraunces itálica | Unbounded 900, mayúsculas |
| Notas, cifras, sellos y rótulos 3D | Fraunces / Georgia itálica | Tektur 900 |
| Textos y locución | Instrument Sans / Fraunces | Space Grotesk |
| Etiquetas, chips, teclas, avisos | Instrument Sans | Martian Mono, mayúsculas |
| Botones secundarios | cápsulas | `.prompt-btn`: recto, borde verde de 1 px, relleno a pasos |
| Botón principal | cápsula verde con sombra 3D | `.cta` de [ JUEGA YA ]: cápsula de vidrio verde |
| Marca | texto "Flauxus•" | logotipo oficial SVG (oculto dentro de la landing) |
| Fuentes | Google Fonts (externo) | `juego/fonts/` (las mismas woff2 de la landing) |

Se conservan claros los objetos de minijuego con contenido oscuro dentro, en blanco en vez de crema:
los fragmentos de partitura de LA, que llevan su forma de onda, y las manijas de respiración de MI.

**Verificado en Chrome:**
- portada, atrio, sala LA (locución y botones), ficha de instrucciones y ficha de "completado";
- juego dentro de la landing: la marca se oculta y la salida ◀◀ queda libre;
- móvil a 375 px: corregí un solapamiento que yo mismo introduje (la mono es más ancha);
- compilación con fuentes y logotipo incluidos.

**Pendiente / decisiones para ti:**
- **Verde del mundo 3D:** cambiado a `#C2FE0B` en 10 archivos: constante, fichas de sala, luces de contorno,
  haces y trazos de canvas. Commit `d3307fd`. Las intensidades de luz no cambiaron. Como el verde nuevo es más
  luminoso, las escenas con luz de contorno verde (la sala DO sobre todo) se ven más verdes que antes. Si resulta
  excesivo, se ajusta la intensidad `rim` de cada sala en `rooms/*.js`.
- **Itálicas en canvas:** los textos de los minijuegos piden `italic`; Tektur no tiene itálica y el navegador la
  inclina. Para quitarlo hay que editar las cadenas de fuente en `rooms/*.js`.
- **"MataЯ":** la "Я" no está en el subset latino de las fuentes y sale con la de reemplazo. La landing usa una
  R espejada (`ui/sharp.js` / `setTitle`); se puede replicar en el juego.
- **Revisión pendiente:** pantallas de MI, RE, FA y SOL, la mano de la baraja (`?entry=cards`) y el epílogo
  final. Usan los mismos componentes, pero no las abrí una por una.

Commits: `0d8fb0b` (juego) y `b23b49b` (landing).

---

## 9. Refinamiento integral (v5 · 9 nov 2026)

Ver el informe completo en [INFORME_refinamiento.md](INFORME_refinamiento.md): portal con el atrio real, notas que abren su sala, créditos académicos, preloader honesto, menú de vidrio, acentos por skin y refinamiento de atrio, FA♯, SOL♯ y LA♯.

---

## 10. Iteración 3 (9 nov 2026)

Ver [INFORME_iteracion3.md](INFORME_iteracion3.md): HUD por regiones sin superposiciones, salida integrada con la landing, scroll y composición de la landing, logotipo Javeriana Cali, holograma monumental y galaxia en SOL♯, partituras y luciérnagas en LA♯, cinta en FA♯, memoria del atrio y progreso guardado.

## 11. Iteración 4 (10 de noviembre de 2026)

Ver [INFORME_iteracion4.md](INFORME_iteracion4.md): lluvia lenta de palabras, landing móvil con una sola figura, radiografía fuera del juego, reinicio completo del juego (se retira el progreso guardado), atrio sin objetos de memoria, nivel Cyborg sin la caída al caminar, burbujas de SOL♯ visibles, holograma encuadrado, luz morada de LA♯ en móvil y cámaras adaptadas al celular.

## 12. Iteración 5 (12 y 13 de noviembre de 2026)

Ver [INFORME_iteracion5.md](INFORME_iteracion5.md): legibilidad en móvil con escala tipográfica, menú del juego centrado, narraciones grabadas con subtítulos por frases sincronizados, María Clara vuelve a caminar con la flauta en FA♯, arrastre de fragmentos de LA♯ corregido y microcontenidos en las fotos de M4.
