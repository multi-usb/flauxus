# FLAUXUS — Informe de la iteración 4

Optimización de experiencia, rendimiento y responsive *mobile first* · 10 de noviembre de 2026

Punto de restauración: etiqueta `pre-iteracion4-2026-11-10` en los dos repos y copia en `respaldos/2026-11-10_pre-iteracion4/`. Nada se publicó ni se subió a ningún remoto.

Cómo leer este informe: **verificado** significa ejecutado aquí en Chrome sin ventana con GPU real y táctil emulado; **implementado** significa hecho pero sin prueba dirigida; **no verificable aquí** significa que exige un teléfono o tableta reales.

| Repo | Commits de la iteración |
|---|---|
| `landing` | `ccba667`, `8d08be3`, `3ed75fc` |
| `juego` | `d647afa`, `8005561`, `bd17d5e`, `b5ff541` |

## 0. Estado por criterio de éxito

| Criterio | Estado |
|---|---|
| Apertura con lluvia lenta de palabras | Verificado en 5 tamaños |
| Móvil limpio, una sola figura frontal | Verificado en celulares y tabletas emulados |
| Reinicio completo al volver o recargar | Verificado (27/27 comprobaciones, 5 ciclos landing ↔ juego) |
| Atrio simplificado | Verificado (recuento de objetos idéntico antes y después de completar salas) |
| Nivel Cyborg más fluido | Verificado con CPU limitada: de 3–7 fps a 56–111 fps al caminar |
| Burbujas de SOL visibles | Verificado en 9 tamaños; áreas táctiles sin montarse en 7 |
| Holograma en celulares | Verificado completo; en el preludio vertical queda pequeño (ver § 6) |
| Luz morada de «Matar al padre» en móvil | Verificado: de 0 % a 46–62 % de píxeles violetas sobre la avatar |
| Radiografía persistente | Verificado: reproducido antes, ausente después en todas las salidas |
| Cámaras y perspectivas en móvil | Verificado en 70 estados; quedan límites concretos (ver § 6) |
| Sin regresiones | Ver § 5, regresión final |

## 1. Problemas identificados y causas

### Landing

- **Radiografía sobre el juego.** Tres causas sumadas: `#lens` tenía `z-index` 89 y el marco del juego 60; `src/scenes/xray.js` dejaba oyentes de puntero permanentes en `window`, y en celular «JUEGA YA» queda sobre el cuerpo de María Clara, así que el toque encendía la radiografía y el marco del juego se tragaba el `pointerup`; con el juego abierto el bucle de la landing se congela y nada volvía a apagarla. Reproducido: `evidencias/iteracion4/it4_antes_lente_1b_juego.jpg`.
- **Reinicio.** Al salir solo se ponía `about:blank` en el marco; no se manejaban atrás, adelante, recarga ni restauración desde caché del navegador.
- **Dos figuras en el inicio móvil.** `#boot` mostraba la figura posterior y la frontal recortadas bajo logotipo, lema y botón.
- **Lluvia de palabras.** Las palabras caían rápido, con texturas recortadas y sin ceder ante el texto.
- **«JUEGA YA» descentrado** (anterior a esta iteración). La animación del botón reemplazaba el `transform` que lo centra; en 320–390 px se salía de la pantalla. Solo aparecía con animaciones activas, por eso las pruebas anteriores no lo vieron.
- **M4 en celular.** Con paralaje, dos fotos pisaban la primera y la última línea de la cita (4–27 %). El «M4 sin cruces» de la iteración 3 solo era cierto con movimiento reducido.
- **M5 en celular horizontal bajo** (640×360, 568×320). «ENTRAR» tapaba la fila de notas.
- **Giro del teléfono.** Los tramos se miden en pantallas; al girar el recorrido cambia de largo y el navegador conserva el scroll en píxeles, así que la landing quedaba en otro momento.

### Juego

- **Caída del nivel Cyborg (SOL).** `rooms/SOL.js` declaraba `floorRay: true`: al caminar se lanzaba un rayo contra el escenario, una sola malla de 318.604 triángulos, cada 25 cm de paseo, a 32–43 ms por rayo. Caminar es también «tocar la flauta», por eso coincidía con esa animación. El 86 % del tiempo de CPU estaba en ese rayo. El rig (6.097 triángulos, 28 huesos), las luces, el holograma y la galaxia no eran el cuello de botella.
- **Burbujas de SOL.** Aro gris de 2 px sin fondo sobre galaxia y holograma. Además, el puntero nace en el centro de la pantalla y el sensor que pasaba por ahí se conectaba solo.
- **Holograma.** Plano de tamaño y posición fijos, sin relación con el aspecto ni con el HUD: en vertical se salía por los lados y por arriba.
- **Luz morada en móvil.** En táctil solo hay una luz puntual. El preset de LA♯ declara primero la roja y después la morada, así que el celular se quedaba con la roja: 0 % de píxeles violetas sobre la avatar.
- **Cámaras.** Campo de visión vertical fijo de 62°: en vertical el campo horizontal caía a 30–37°. Ninguna cámara tenía en cuenta el HUD: la locución tapaba entre el 38 % y el 98 % de la avatar en el preludio vertical. En las salas la cámara no detectaba muros.
- **Progreso heredado.** `core/state.js` restauraba la partida desde `localStorage` (añadido en la iteración 3).
- **Objetos de memoria del atrio.** `atrium/memory.js` se construía y actualizaba por cuadro.

## 2. Correcciones implementadas

### Landing

- **Lluvia de palabras** (`src/scenes/hero.js`). ESCUCHA · RECORRE · INTERVIENE caen detrás de María Clara dentro del mismo lienzo 3D, sin capas nuevas. Periodo de 26–46 s por pantalla, retardo y deriva propios, fundido de entrada y salida. 4 palabras en celular y tableta, 8 en escritorio. Se atenúan detrás del texto, del botón y de la pista de scroll. Se pausan fuera de la primera sección, con la pestaña oculta y con el juego abierto; quedan fijas con movimiento reducido.
- **Una sola figura en móvil.** En celular y tableta vertical solo la frontal; la posterior ni se muestra ni se descarga. Escritorio intacto.
- **Radiografía.** La lente y sus oyentes se desactivan al abrir el juego y vuelven limpios al cerrar. El marco del juego queda por encima de todo, y con el juego abierto el resto de la landing queda oculto e inerte (no recibe toques ni foco).
- **Reinicio.** Al salir se pierde cada contexto WebGL, se vacía el documento y se elimina el marco. Atrás cierra el juego; adelante, recarga y restauración desde caché nunca lo reabren. Las entradas directas a sala desde M5 se conservan, sin progreso.
- **Responsive.** «JUEGA YA» centrado con su animación; M4 sin fotos sobre la cita en celular; composición propia de M5 para ventanas bajas en horizontal; inicio en tableta vertical sin figura sobre el botón; créditos y notas a todo el ancho en tableta vertical; al girar se conserva el momento y la fracción de lectura.

### Juego

- **Reinicio completo.** Sin guardado ni restauración; la clave antigua se borra al cargar. Al salir se detienen bucle, audio y locución y se libera el contexto gráfico. «Volver a empezar» del epílogo quita `?room=` y vuelve a la portada. Se eliminó el botón de reinicio de la ayuda, que ya no tenía función.
- **Atrio limpio.** Eliminado `atrium/memory.js` y sus llamadas. Escaleras, portales, desbloqueo, bloques flotantes y ficha de sala sin tocar.
- **Nivel Cyborg.** El piso se rasteriza una vez al cargar en un mapa de alturas (unos 77 ms bajo el preloader); los toques para caminar se resuelven sobre ese mapa. Texturas de la avatar a 1024 px en táctil. La IK de la flauta ya no crea objetos por cuadro.
- **Burbujas.** Fondo oscuro, aro verde #C2FE0B de 3 px con muescas, halo que respira, llamada cian; arco rosado al cargar; disco verde con ✓ al conectar. Área táctil de 128 px con dibujo de 60 px. No cuentan hasta que hay un toque real. Los tres sensores se separan entre sí y solo carga el más cercano al dedo.
- **Holograma.** Se escala según campo de visión, aspecto e inclinación reales de la cámara y las piezas del HUD que caen en su columna; se recalcula al girar. En el preludio vertical se aparta a un costado cuando quedaría tapado por el núcleo.
- **Luz morada.** En calidad baja entra primero la luz marcada como narrativa y acompaña a la avatar. Sigue siendo una sola puntual sin sombra. Intensidad corregida tras la revisión (salía quemada).
- **Cámaras.** Campo horizontal mínimo de 40° abriendo el vertical hasta 74° según el aspecto; la avatar se encuadra en la franja libre entre el HUD de arriba y las piezas de abajo; mapa de obstáculos por sala para que la cámara no atraviese muros. Todo sale del aspecto y de cajas medidas, sin valores por resolución. En escritorio con ratón el encuadre no cambia.
- **HUD táctil.** Botones de 44 px; locución en líneas enteras; menú con los cuatro satélites visibles sin scroll a 360×640; LA♯ en horizontal con la interfaz abajo en dos mitades.
- **Otros.** Sin errores 404 por locuciones inexistentes ni por el icono de la pestaña.

## 3. Archivos modificados

**landing** (16 archivos, +851 −191): `index.html`, `src/experience.js`, `src/main.js`, `src/moments/m3-universo.js`, `src/moments/m4-maria-clara.js`, `src/scenes/flat.js`, `src/scenes/gl.js`, `src/scenes/hero.js`, `src/scenes/xray.js`, `src/styles/main.css`, `src/ui/game.js`, `src/ui/hud.js`, `src/ui/lens.js` y afines.

**juego** (27 archivos, +804 −329): `Main.js`, `player.js`, `flow.js`, `index.html`, `style.css`, `README.md`, `core/state.js`, `core/util.js`, `core/config.js`, `atrium/atrium.js`, `atrium/memory.js` (eliminado, recuperable desde la etiqueta), `engine/hologram.js`, `engine/sky.js`, `engine/avatar.js`, `engine/skinning.js`, `engine/lighting.js`, `engine/ground.js`, `rooms/SOL.js`, `rooms/LA.js`, `rooms/FA.js`, `rooms/MI.js`, `ui/epilogue.js`, `ui/voice.js`, `ui/prelude.js`, `ui/hud.js`, `ui/hudMetrics.js` (nuevo), `brand/flauxus-iso.svg` (nuevo, copia del isotipo de la landing).

La lista exacta: `git diff --stat pre-iteracion4-2026-11-10..HEAD` en cada repo.

## 4. Optimizaciones y mediciones

Preludio de SOL caminando, `?room=5`, 8 s por estado, pantalla de 120 Hz. La CPU se limitó por software; la GPU no se puede limitar.

| Tamaño · límite de CPU | Antes | Después |
|---|---|---|
| 390×844 táctil ×4 | 3,5 fps · p95 358 ms | 106,4 fps · p95 16,7 ms |
| 390×844 táctil ×6 | 2,7 fps · p95 542 ms | 62,5 fps · p95 25 ms |
| 360×640 táctil ×6 | 4,0 fps · p95 350 ms | 56,2 fps · p95 25,1 ms |
| 844×390 táctil ×4 | 6,8 fps · p95 167 ms | 111,2 fps · p95 16,7 ms |
| 1366×768 ×4 | 4,1 fps · p95 267 ms | 84,7 fps · p95 24,5 ms |

- Un toque para caminar: de 39–43 ms a 1,6–1,8 ms.
- Quieta en el preludio y durante el minijuego no hay diferencia fuera del ruido (55–120 fps antes y después). La mejora es específica de caminar.
- Llamadas de dibujo (31–62), triángulos (335–350 mil) y texturas (24 en táctil, 42 en escritorio): iguales antes y después.
- Fugas: 5 ciclos atrio → SOL → atrio con recuentos idénticos de geometrías, texturas, programas y objetos.
- Las correcciones posteriores a la revisión no muestran regresión medible; la variación entre dos pasadas iguales (hasta ±20 %) supera cualquier diferencia.
- Precisión del mapa de alturas frente al rayo real: el 2 % de 2.232 muestras difiere más de 15 cm, en cantos de escalón.

Datos: `evidencias/iteracion4/datos/`.

## 5. Pruebas ejecutadas

Todas en Chrome sin ventana, GPU real (Radeon 780M), táctil emulado. Los scripts están en `docs/pruebas/` (`it4_*.mjs` son los de esta iteración).

| Prueba | Resultado |
|---|---|
| Reinicio (`it4_reinicio.mjs`) | 27/27: partida vieja sembrada ignorada y borrada; tras recargar, sin progreso; salida detiene bucle, audio y contexto gráfico |
| Transiciones landing ↔ juego (`it4_transiciones.mjs`) | 183/183 en 390×844 y 360×640: un solo marco, juego siempre desde cero, nada de la landing visible ni activo sobre el juego, giro con el juego abierto, recarga y atrás |
| Radiografía (`it4_lente.mjs`) | Lente oculta e inactiva en todas las salidas (Salir, atrás, Escape, giro, recarga); vuelve a funcionar en la landing |
| Lluvia (`it4_lluvia.mjs`, `it4_fix_lluvia.mjs`) | 22–40 px/s; ninguna palabra encendida sobre el texto; opacidad máxima sobre la pista de scroll 0,077; quieta fuera de la sección y con pestaña oculta |
| Auditoría de la landing (`it4_audit.mjs`, 14 tamaños) | Sin desborde horizontal. 10 tamaños limpios; 4 avisos residuales en M3 que ya existían |
| Superposiciones del juego (`audit.mjs`) | 105 combinaciones · 615 estados · 0 problemas |
| Cámaras (`it4_camaras.mjs`) | 70 estados (atrio + 6 salas × preludio/juego × 5 tamaños): avatar fuera de cuadro 0; botones menores de 44 px 0; locución sobre la avatar 0–2 % (antes 38–98 %) |
| Escritorio (`it4_rev_adv.mjs`) | Encuadre sin cambios en los 14 estados de 1366×768 |
| Luz morada (`it4_luz.mjs`) | Píxeles violetas sobre la avatar en táctil: 0 % → 46–62 % |
| Sensores de SOL (`it4_fix_sol_sep.mjs`) | Separación mínima 135 px en 6 celulares y 145 px en tableta; 0 pares montados |
| Giro en caliente (`it4_cam_giro.mjs`, `it4_fix_giro.mjs`) | Juego: mismos valores al volver. Landing: 58/58, se conserva momento y fracción |

**Revisión independiente.** Cuatro revisores que no escribieron el código (dos de código, uno de regresión, uno visual) reportaron 39 hallazgos. Los dos más serios eran reales y se corrigieron: en escritorio la cámara de LA♯ se alejaba 1,4 veces, y en SOL las áreas táctiles se montaban, contra lo que afirmaba el primer informe.

**Regresión final** (sobre el estado confirmado, tras todas las correcciones): superposiciones del juego 105 combinaciones · 615 estados · 0 problemas; integración 6 pasos correctos, sin errores de página; transiciones 258/258 en 390×844, sin errores de consola; reinicio 27/27; fugas con diferencia 0 en geometrías, texturas, programas, objetos y DOM tras 4 vueltas.

Capturas: `evidencias/iteracion4/` (hojas `it4_fix_hojaA…D.jpg`, `it4_cam_fin_hoja_r*.jpg`, lluvia, inicio, antes y después).

## 6. Problemas pendientes

**No verificable aquí**
- Teléfonos y tabletas reales: barras del navegador, zonas seguras, restauración desde caché en Safari iOS y Chrome Android, y rendimiento con GPU móvil. Las cifras de § 4 son de un computador con la CPU frenada.
- Riesgo que queda para gamas bajas: el escenario de SOL tiene 318.604 triángulos con material PBR y 5 luces por píxel. Reducirlo exige decimar el modelo original.

**Límites conocidos**
- Holograma en el preludio vertical: completo pero pequeño (51 px de alto en 360×640, 87 px en 390×844), porque el HUD ocupa el tercio superior y la cámara del preludio mira hacia abajo.
- El holograma queda algo más pequeño que el diseño original también en escritorio, porque antes la cabeza salía del cuadro.
- SOL en horizontal: el sensor de la cabeza roza la coronilla y parte del holograma.
- LA♯ a 360×640: la cabeza queda justo bajo el aviso, sin holgura. LA♯ en tableta horizontal táctil: el pentagrama tapa un 26 % de las piernas.
- FA♯: la avatar mide el 13 % del alto; se dejó así porque la vista cenital es la que muestra el recorrido.
- MI: los puntos de respiración siguen pasando por delante de las piernas.
- En SOL la avatar puede subir a los bancos pasando por la terraza, igual que antes.
- Landing: los datos de M4 pasan bajo la X en escritorio; «nota a nota» queda sobre la rejilla en 844×390; cuatro avisos residuales de M3.
- La luz morada en móvil es más constante que en escritorio, porque acompaña a la avatar.

**Implementado sin prueba dirigida**
- Rótulo «Ahora» dentro de las salas; entrada con baraja (`?entry=cards`) en MI tras mover la mano de cartas; dos arreglos de la lluvia que dependen del orden de carga de la tipografía.

**Decisiones abiertas**
- Las «entradas descubiertas» del epílogo (`flauxus.entries.v1`) se siguen guardando entre visitas. No son progreso de niveles y a cada puerta se llega con una carga distinta, así que el contador «n de 4» no puede vivir solo en memoria. **Decidido el 10 de noviembre de 2026: se dejan guardadas.**
- La X del HUD se retiró en los créditos, porque «Tomar aire de nuevo» ya devuelve al inicio. Se restaura quitando una condición en `src/ui/hud.js`.
- En escritorio y tableta, las fichas de vidrio del inicio siguen sobre el logotipo: sus posiciones están puestas así a propósito en el diseño de referencia.

## 7. Recomendaciones

1. Probar en dos o tres teléfonos reales (un Android de gama media y un iPhone) el recorrido completo: landing → portal → SOL caminando → LA♯ → salir → volver a entrar.
2. Decimar el escenario de SOL en Blender si en teléfonos reales sigue pesado.
3. Rediseñar el preludio vertical para liberar cielo (retirar la ficha de sala a los pocos segundos) y dar tamaño al holograma.
4. Mover el sensor de la cabeza de SOL a un costado en horizontal.
5. Decidir las tres cuestiones abiertas de § 6.
6. Pendientes heredados de la iteración 3: conversión de los rigs FBX a GLB, Three.js alojado localmente, destino del enlace de Instagram.
