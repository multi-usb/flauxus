# FLAUXUS — Informe de la iteración 5

Optimización de experiencia interactiva · 12 y 13 de noviembre de 2026

Punto de restauración: etiqueta `pre-iteracion5-2026-11-12` en los dos repos y copia en `respaldos/2026-11-12_pre-iteracion5/`. Nada se publicó ni se subió a ningún remoto.

Cómo leer este informe: **verificado** significa ejecutado aquí en Chrome sin ventana con GPU real y táctil emulado; **implementado** significa hecho pero sin prueba dirigida; **no verificable aquí** significa que exige un teléfono real o el oído de una persona.

| Repo | Commits de la iteración |
|---|---|
| `landing` | `54f3cd7` |
| `juego` | `2658c6a`, `298d5f7`, `6fa1f21`, `f500a7d` |

## 0. Estado por ajuste

| Ajuste | Estado |
|---|---|
| 1. Legibilidad en móvil (landing y juego) | Verificado por medición: ningún texto por debajo de 12 px en la landing; menú y rótulos del HUD del juego a 12 px o más |
| 2. Menú principal del juego centrado | Verificado en 112 de 112 combinaciones (14 tamaños, directo y embebido, con las distintas entradas) |
| 3. Subtítulos sincronizados con la narración | Verificado en 6 salas × 5 tamaños; falta revisión de oído del texto de RE |
| 4. María Clara caminando con la flauta | Verificado: restaurada en FA♯; en el inicio nunca se había perdido (ver § 1) |
| 5. Arrastre de fragmentos de partitura | Verificado con ratón y con dedo emulado, directo y dentro de la landing |
| 6. Microcontenidos en las fotos de María Clara | Verificado en 10 tamaños; los cinco textos salen del guion oficial |

## 1. Diagnóstico: problemas y causas

### Landing

- **Textos pequeños.** De 53 textos medidos, 21 estaban por debajo de 12 px (el menor, 9 px: el nombre de María Clara en el héroe y las frecuencias de M5). Los tamaños estaban puestos como valores sueltos en píxeles, sin escala común.
- **Contraste.** El lema del inicio caía sobre la chaqueta gris del personaje (1,7:1 en los puntos claros) y «[ JUEGA YA ]» sobre el piso claro del atrio.
- **Fotos de María Clara (M4).** Las fotos no tenían ningún contenido asociado.

### Juego

- **Menú descentrado.** En celular vertical el panel iba pegado abajo (hasta 253 px de diferencia entre margen superior e inferior en 412×915). Embebido en la landing bajaba 50–60 px en todos los tamaños por el hueco del botón «Salir», aunque en pantallas anchas ese botón queda a un costado. En 320×568 el panel no cabía: 113 px de scroll y los cuatro satélites fuera de la vista. De 112 combinaciones medidas, 80 estaban fuera de tolerancia.
- **Letra del menú y del HUD.** Antetítulo, nota y satélites a 10–10,5 px; rótulos del HUD a 10,5–11 px.
- **Narración en bloque y sin voz.** `VO_AUDIO` estaba en `false` y las fichas apuntaban a archivos inexistentes. El texto de cada ficha se volcaba entero y se iluminaba palabra a palabra con un ritmo estimado, sin relación con ningún audio. La sala RE no tenía texto.
- **Flauta en FA♯.** En el commit `7444a42` (iteración 3), al añadir la cinta, la llamada `animAvatar(...)` de `rooms/FA.js` quedó en la misma línea que un comentario `//` y dejó de ejecutarse: la avatar se deslizaba rígida, sin flauta y con la animación congelada. **En el inicio no hay regresión:** en el atrio, al echar a andar, María Clara camina con la flauta igual que en todas las versiones anteriores (se compararon `pre-iteracion3`, `pre-iteracion5` y la actual). En ninguno de los 19 commits del juego existe una secuencia de entrada caminando que se haya eliminado.
- **Arrastre en LA♯** (`rooms/LA.js`). Cinco fallos sumados: un segundo dedo o la palma abría un segundo arrastre y dejaba una tarjeta fantasma pegada (error de seguimiento de hasta 583 px y un error de JavaScript al soltar); una cancelación del gesto soltaba el fragmento donde estuviera; sin captura de puntero, al perder el foco quedaban restos colgados; el punto de agarre se medía sobre la tarjeta inclinada por el hover (3,5–6,8 px de desfase); y la tarjeta fantasma heredaba una transición de 150 ms, así que iba detrás del dedo. Se descartó con pruebas que algo tape las tarjetas o que el marco de la landing desplace las coordenadas.

## 2. Cambios implementados

### Landing (`54f3cd7`)

- **Escala tipográfica** (`src/styles/fonts.css`): siete escalones (`--fs-xs` … `--fs-display`) que crecen con el ancho de la ventana. Pisos pensados para un celular de 360 px: 12 px en etiquetas y 14 px en texto de lectura. Los textos pequeños de `main.css` usan esos escalones.
- **Logotipo** del héroe: `clamp(84px, 24vw, 132px)` en celular vertical.
- **Contraste:** veladuras suaves del negro del fondo detrás del lema del inicio, del bloque del héroe y de la frase central; «[ JUEGA YA ]» con fondo más opaco.
- **Microcontenidos en M4** (`index.html`, `src/moments/m4-maria-clara.js`): un marcador por fotografía, anclado lejos del rostro. Se despliega con hover o foco en escritorio y con un toque en táctil; se cierra con un segundo toque, al tocar fuera, con Escape o al hacer scroll. Uno abierto a la vez. Accesible por teclado (`aria-expanded`, `aria-describedby`).

| Foto | Marcador | Texto | Fuente en el guion (GTI v3) |
|---|---|---|---|
| A | Intervención | Interviene obras del repertorio canónico para flauta con técnicas extendidas, electrónica e improvisación. | Locución de LA♯ |
| B | MataЯ al padre | Una metáfora y un detonante creativo: la intérprete asume un lugar de autoridad frente a la tradición. | Locución de LA♯ |
| C | Unicornio cyborg | En «Unscheduled Disassembly» (2024) usó teléfonos como sensores de movimiento durante el performance. | Ficha de SOL♯ |
| D | Seis salas | Seis salas sobre la escala de tonos enteros: DO, RE, MI, FA♯, SOL♯ y LA♯. | Estructura de salas |
| E | El cuerpo | Tocar ocupando espacio: «la dimensión corporal no se agota en la técnica». | Carrusel 1, lámina 6 |

Las cinco frases se contrastaron una a una contra `GTI_REWIND_Corregido_Final_v3.docx`.

### Juego

- **Subtítulos sincronizados** (`2658c6a`, `298d5f7`). Las seis locuciones de la carpeta de la sesión se transcribieron en este computador (Whisper local, sin enviar audio a ningún servicio) y se alinearon con las pausas reales del audio: 63 frases con inicio, fin y tiempo de cada palabra (`audio/locucion/pistas.js`). El juego ahora reproduce la voz (copias comprimidas `.ogg` y `.m4a`, 4,1 MB en total; los `.wav` originales no se tocaron) y muestra **una frase a la vez**, en una caja que siempre mide dos líneas y no se mueve. El reloj es el del audio; si la voz no puede sonar todavía (bloqueo de reproducción automática) el subtítulo avanza con reloj propio y la voz se engancha en el segundo exacto al primer toque. Letra de 16 px o más. Texto para lectores de pantalla. Respeta silencio, «Saltar locución» y movimiento reducido.
- **Flauta** (`6fa1f21`): `animAvatar(...)` vuelve a su propia línea en `rooms/FA.js`. Es el código original, sin reconstruir nada.
- **Arrastre** (`6fa1f21`): un solo arrastre a la vez; punto de agarre calculado sobre la tarjeta sin transformar; la tarjeta se mueve solo con `transform`, sin transición; captura de puntero; soltar coloca, y cancelar, perder el foco o salir de la sala devuelven el fragmento sin cambiar nada. La mecánica no cambia: toque = oír, arrastrar = colocar, reordenar, soltar fuera = retirar.
- **Menú centrado** (`f500a7d`; `style.css`, `index.html`): panel centrado en horizontal y vertical con márgenes de zona segura en los cuatro lados. Embebido en celular vertical, el hueco de «Salir» se compensa con un contrapeso abajo que cede antes que el panel cuando falta alto; en pantallas anchas y en horizontal «Salir» queda a un costado y el panel no baja. En celulares de hasta 700 px de alto los controles se leen en la ayuda (botón ?), como ya ocurría en horizontal, y así caben los cuatro satélites sin scroll.
- **Legibilidad del juego:** antetítulo, nota y satélites del menú a 12 px; rótulos y datos del HUD a 12 px. Se dejaron como estaban las piezas ajustadas a su hueco (pips de progreso y etiquetas de los fragmentos de LA♯, 9–10,5 px).

### Diferencias entre el audio y el texto que mostraba el juego

El subtítulo dice lo que se oye.

- **RE:** la ficha no tenía texto. Las 18 frases salen solo del reconocimiento de voz y no figuran en el guion, así que no se pudieron contrastar con ningún escrito.
- **LA♯:** se oye «como las técnicas extendidas, la electrónica y la improvisación»; la ficha tenía esa lista entre paréntesis.
- **LA♯:** se oye «performances»; la ficha decía «performaces».
- **DO, MI, FA♯, SOL♯:** el audio coincide con la ficha; se conservó su puntuación.

## 3. Archivos modificados

**landing:** `index.html`, `src/moments/m2-portal.js`, `src/moments/m4-maria-clara.js`, `src/styles/fonts.css`, `src/styles/main.css` (+497 −31).

**juego:** `ui/voice.js`, `core/voiceState.js`, `core/config.js`, `ui/prelude.js`, `index.html`, `style.css`, `README.md`, `rooms/FA.js`, `rooms/LA.js`; nuevos `audio/locucion/pistas.js` y `audio/locucion/{DO,RE,MI,FA,SOL,LA}.{ogg,m4a}`.

La lista exacta: `git diff --stat pre-iteracion5-2026-11-12..HEAD` en cada repo.

## 4. Pruebas ejecutadas

Todas en Chrome sin ventana, GPU real, táctil emulado, con `prefers-reduced-motion` en falso. Scripts en `docs/pruebas/` (`it5_*.mjs`); registros y capturas en `docs/evidencias/iteracion5/`.

| Prueba | Resultado |
|---|---|
| Subtítulos (`it5_subs.mjs`) | 6 salas × 5 tamaños = 30 narraciones completas sin fallas: cada frase aparece a menos de 0,25 s de su momento (desfase máximo medido 0,16 s), nunca más de dos líneas ni dos frases a la vez, caja fija, 0 % de solape con la avatar y los botones, texto visto = narración completa |
| Subtítulos sin audio, silencio, saltar, giro | Correctos (SOL sin audio: reloj propio; RE: silencio y saltar; FA♯: giro repagina) |
| Flauta (`it5_flauta.mjs`) | FA♯ en 3 tamaños: antes modo reposo, flauta invisible, manos a 0,69 del tubo; después camina con flauta, manos sobre el tubo, vuelve a la pose de tocar en 0,25 s. Atrio: igual que en versiones anteriores |
| Arrastre (`it5_arrastre.mjs`) | 5 tamaños × ratón y dedo, directo y embebido (20 combinaciones): error de seguimiento 0 px (antes hasta 583 px), 0 saltos, cancelación, pérdida de foco, dos dedos y giro correctos; la sala se completa |
| Microcontenidos (`it5_tips.mjs`) | 10 tamaños sin problemas: no pisan rostros, citas, datos ni botones; el texto abierto cabe en la ventana; toque abre, segundo toque y scroll cierran; teclado y Escape |
| Legibilidad de la landing (`it5_legib.mjs`) | Textos por debajo de 12 px: 21 → 0 |
| Menú del juego (`it5_jmenu.mjs`) | 112 de 112 combinaciones dentro de tolerancia (antes 32 de 112): diferencia entre márgenes ≤ 4 px en ambos ejes, botón principal a la vista, sin scroll, sin pisar «Salir», satélites visibles |
| Regresión | Sobre el estado confirmado final: superposiciones del juego 105 combinaciones · 615 estados · 0 problemas; integración 6 pasos correctos sin errores de página; transiciones 258/258 en 390×844; reinicio 27/27; fugas con diferencia 0 en geometrías, texturas, programas, objetos y DOM; auditoría de la landing en 14 tamaños sin desborde, 10 limpios y 4 avisos residuales de M3 que ya existían. Subtítulos, arrastre (directo y embebido), flauta y microcontenidos repetidos al final: todos correctos |

## 5. Pendiente y límites

**No verificable aquí**
- Teléfonos reales: Safari de iOS usa el `.m4a`, que aquí solo se comprobó en duración; desbloqueo de audio con el primer toque; latencia real del altavoz; dedo y palma reales en el arrastre.
- El desfase de los subtítulos se midió contra el reloj del audio, no contra el sonido que sale por el altavoz.

**Para revisar de oído (texto de las narraciones)**
- RE completo, y en particular: «Hummel», «1815», «al mismo tempo» y «variaciones sutiles de tempo» (un modelo oyó «tiempo»), «aun hasta el siglo XX», «se instaba a los tecladistas», «yugo del metrónomo».
- Cualquier corrección se hace en `docs/pruebas/it5_pistas.mjs` y se regenera `pistas.js`.

**Límites conocidos**
- La auditoría de contraste de la landing sigue marcando cinco textos por debajo de 4,5:1. Los cinco se midieron en fotogramas de transición entre momentos (texto del mismo color que el barrido verde); no se comprobó uno a uno que en reposo queden bien.
- En la landing, la cita de M4 sigue cruzándose con una foto en 4 tamaños de escritorio y tableta (4–16 %); ya ocurría antes de esta iteración.
- En el menú del juego, celulares de hasta 700 px de alto ya no muestran la lista de controles en la portada (siguen en la ayuda).
- Los pips de progreso y las etiquetas de los fragmentos de LA♯ siguen por debajo de 12 px.
- Las fichas conservan su texto antiguo como fuente interna; ya no se muestra cuando hay pista grabada.

**Decisiones abiertas**
- «Inicio del videojuego»: si se esperaba que María Clara aparezca ya con la flauta en la portada, o una entrada caminando sola, eso no consta en ninguna versión y habría que crearlo nuevo.
- En la carpeta de la sesión hay cinco archivos de música con nombre de nivel (`…-nivelDO.wav`, etc.). No se usaron: el encargo solo pedía las narraciones.
- No se conservó el resaltado palabra a palabra; los datos permiten añadirlo.

**Proceso**
- La revisión independiente por cuatro revisores, prevista como en la iteración 4, no llegó a ejecutarse: el trabajo por partes se cortó tres veces (conexión y límite de uso). La landing, el menú y la regresión final se terminaron y verificaron directamente.
