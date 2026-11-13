# FLAUXUS · Informe de la iteración 3 (9 nov 2026)

Auditoría, responsive integral, optimización y evolución cinematográfica. Responde a [PROMPT_MAESTRO_iteracion3.md](PROMPT_MAESTRO_iteracion3.md).

- **Modelo usado:** Fable 5.2 (`claude-fable-5-2`), verificado en la sesión.
- **Punto de restauración:** tags `pre-iteracion3-2026-11-09` en `flauxus/landing` y `flauxus/juego`, y zips en `respaldos/2026-11-09_pre-iteracion3/`.
- **Evidencias:** capturas en [evidencias/iteracion3/](evidencias/iteracion3/) y resultados de las pruebas en [evidencias/iteracion3/datos/](evidencias/iteracion3/datos/).

---

## 1. Resumen ejecutivo

- **Superposiciones.** El HUD del juego se reescribió como una rejilla por regiones. La matriz automática final recorre 105 combinaciones de sala, resolución y modo (directo y embebido), con 615 estados de interfaz, y da **0 superposiciones y 0 piezas fuera de pantalla**. Tras los últimos parches se repitió un subconjunto de 75 combinaciones (435 estados), también con 0.
- **«Volver al atrio» contra «Regresar a la landing».** Chocaban porque los dibujaban dos sistemas distintos: el juego y la landing, encima del iframe. Ahora el juego dibuja su propio «◀◀ Salir» y le reserva un hueco en la misma barra. Se probó con cambio de tamaño en vivo en cinco resoluciones: nunca se pisan.
- **Landing.**
  - El scroll pasó de 18 a 25 pantallas de recorrido: cerca de una pantalla por cuadro de contenido.
  - Las fotos de María Clara ya no invaden las citas. Antes llegaban a taparlas un 77 % en ultrapanorámico.
  - El inicio y el preloader en celular ya no encimaban el logotipo con el lema y el botón.
  - Está el logotipo oficial de la Javeriana Cali.
  - Las once resoluciones auditadas salen limpias.
- **Juego.**
  - Volvieron los botones de los satélites, dentro de la tarjeta del menú.
  - El escenario se desenfoca y oscurece detrás de las tarjetas.
  - SOL♯ tiene un holograma monumental (unos 130 m) y una galaxia procedural.
  - LA♯ tiene partituras que flotan desde el preludio y se ordenan al empezar, además de luciérnagas moradas.
  - FA♯ tiene una cinta de recorrido sobre el piso.
  - El atrio tiene losas más dramáticas y una memoria que crece con cada sala completada.
  - El progreso ahora se guarda.
- **Rendimiento.**
  - Se encontró y corrigió una fuga que ya existía: 2 texturas por cada visita a FA♯, SOL♯ o LA♯.
  - El preludio de SOL♯ rinde un 25 % más con la CPU frenada 4×.
  - El coste de GPU de SOL♯ sube 0,5 ms por cuadro por la galaxia y el holograma. Queda en 5,2 ms a 2560×1440.
  - No pude reproducir las ralentizaciones de SOL♯ en este equipo: va al tope de pantalla antes y después.

---

## 2. Registro de modificaciones

### Juego (`flauxus/juego`)

| Sistema | Archivos | Qué cambió |
|---|---|---|
| HUD por regiones | `index.html`, `style.css` | El HUD pasó de piezas con coordenadas sueltas a una rejilla con regiones (izquierda, centro, derecha; en pantallas estrechas, franjas). Las tarjetas de sala viven en la misma rejilla. Lo oculto no ocupa espacio. |
| Salida a la landing | `index.html`, `core/util.js`, `style.css` | Botón «◀◀ Salir» propio del juego cuando va embebido, con hueco reservado en la barra superior. Avisa a la landing por `postMessage`. |
| Escena en segundo plano | `style.css`, `Main.js`, `ui/debug.js`, `engine/renderer.js` | Con la ficha, el cierre o la ayuda abiertas, el lienzo 3D se desenfoca y oscurece, y el motor baja la resolución mientras dura. |
| Satélites | `core/config.js`, `index.html`, `style.css` | Los cuatro botones de entrada (Directa, Fanzine, Afiche, Baraja) vuelven, dentro de la tarjeta del menú, con su habilidad. |
| Minijuegos LA♯ y MI | `style.css`, `Main.js` | La interfaz de LA♯ es una columna (dos columnas en horizontal bajo). Empieza debajo de la franja superior del HUD, que se mide en vivo (`--ui-top`). |
| SOL♯ | `rooms/SOL.js`, `engine/hologram.js`, `engine/sky.js` | Holograma monumental por impostor, galaxia horneada con dos capas de estrellas y polvo orbital, y cámara con la mirada más alta. |
| LA♯ | `rooms/LA.js`, `engine/sky.js` | Las partituras flotan libres desde el preludio y se ordenan en sus anillos al empezar. Luciérnagas moradas. |
| FA♯ | `rooms/FA.js`, `engine/trail.js` | Cinta de recorrido sobre el piso, con búfer fijo. |
| Atrio | `atrium/atrium.js`, `atrium/memory.js`, `player.js` | Losas con órbitas que respiran, giros propios y seis «viajeras» que cruzan por lo alto. Memoria del atrio según las salas completadas. |
| Progreso | `core/state.js`, `flow.js`, `ui/epilogue.js`, `Main.js`, `index.html` | Las salas completadas y sus métricas se guardan en el navegador. «Reiniciar recorrido» (ayuda) y «Rebobinar» (epílogo) lo borran. |
| Robustez de carga | `engine/avatar.js`, `index.html`, `core/util.js` | La carga del avatar ya no espera sin límite la decodificación de texturas. Parámetros de prueba `?raf=timer` e `?input=touch`. |

### Landing (`flauxus/landing`)

| Sistema | Archivos | Qué cambió |
|---|---|---|
| Scroll | `src/config.js` | Más recorrido por momento: cerca de una pantalla de scroll por cuadro de contenido. |
| Sección de María Clara (M4) | `src/styles/main.css` | Cada foto queda acotada por ancho y alto y vive en su carril; los textos ocupan los carriles libres. |
| Inicio y preloader en celular | `src/styles/main.css` | La pantalla pasó a ser una columna que se apila sola; el logotipo se acota por ancho y alto. |
| Créditos | `index.html`, `src/styles/main.css`, `public/brand/javeriana-cali-vertical-blanco.svg` | Logotipo oficial de la Pontificia Universidad Javeriana Cali junto al programa, con enlace al sitio. |
| Imágenes | `index.html`, `public/images/personaje/*.webp`, `originales-imagen/` | Ilustraciones del inicio en WebP. Los PNG originales se conservan fuera de la carpeta publicada. |
| Integración con el juego | `src/ui/game.js`, `src/styles/main.css` | La landing oculta su botón ◀◀ cuando el juego avisa que está listo y cierra el juego cuando este se lo pide. |
| Pruebas | `index.html` | Parámetro `?raf=timer` para pruebas con la página oculta. |

---

## 3. Auditoría responsive

### Causas encontradas

| Problema | Causa de origen | Solución |
|---|---|---|
| Piezas del HUD que se enciman al cambiar el tamaño | Cada pieza tenía `position:absolute` con coordenadas propias; ninguna conocía a las demás | Rejilla por regiones. En pantallas estrechas las columnas se disuelven (`display:contents`) y cada grupo pasa a su franja |
| «Volver al atrio» contra «Regresar a la landing» | Dos documentos distintos dibujando en la misma esquina | Un solo botón «Salir», del juego, con hueco reservado. La landing solo muestra el suyo mientras el juego carga, en el mismo lugar y tamaño |
| HUD visible debajo del menú, la ayuda y el epílogo | Esas pantallas son capas encima; el HUD seguía dibujado | El HUD se oculta en esas fases |
| Botón ⟳ encendido durante los minijuegos | Solo se apagaba desde el bucle del atrio, que no corre en juego | Regla por fase: solo existe en atrio y preludio |
| LA♯: la sexta tarjeta tapaba el contador y el botón | Bloques con `top` en porcentaje (21 %, 55 %, 78 %, 84 %) | Columna que fluye; dos columnas en horizontal bajo; versión compacta en celulares de menos de 620 px de alto |
| RE, DO y MI: el círculo o la luz quedaban bajo la pista de texto | Posiciones del lienzo en porcentaje del alto | La franja superior del HUD se mide en vivo (`GX.uiTop`, `--ui-top`) y el lienzo se dibuja por debajo |
| Landing M4: fotos sobre citas | Anchos en `vw` y posiciones en `vh` | Fotos acotadas por `min(vw, vh)`, cada una en su carril. Desplazamiento calculado en celulares bajos y unidad con suelo en horizontal bajo |
| Landing, inicio en celular: logotipo sobre el lema y el botón | Todo anclado a porcentajes del alto; el logo cuadrado es más alto | Columna que se apila sola; logotipo acotado por ancho y alto |

### Resoluciones probadas (Chrome sin ventana, GPU real)

**Juego**: 7 pantallas (menú y atrio + 6 salas), cada una en 4–6 estados (menú, atrio, ayuda, epílogo; preludio con voz, preludio con «entrar», ficha, juego, juego con «saltar», cierre).

| Modo | Resoluciones | Resultado |
|---|---|---|
| Directo | 320×568, 375×667, 390×844, 430×932, 844×390, 768×1024, 1024×768, 1366×768, 1440×900, 1920×1080, 2560×1080 | 0 superposiciones |
| Embebido en un iframe, como en la landing | 390×844, 844×390, 1024×768, 1366×768 | 0 superposiciones |
| Cambio de tamaño en vivo dentro de una sala | 1366×768 → 390×844 → 844×390 → 1024×768 → 2560×1080 → 1366×768 | «Salir» y «Volver» nunca se pisan |

**Landing**: las mismas once resoluciones, en 15 puntos del recorrido, más preloader e inicio en diez de ellas.

| Qué | Resultado |
|---|---|
| Desbordamiento horizontal | Ninguno |
| Preloader e inicio | 0 superposiciones en las diez resoluciones (antes: hasta 46 px entre 320 y 430 px de ancho) |
| Fotos sobre textos en M4 | 0 cruces en las once (antes: 15–19 % a 1366, 77 % a 2560×1080, 52 % a 844×390, 20 % a 320×568) |

El detector marca un aviso en la sección verde al 15 % de su recorrido: es un falso positivo, porque en ese punto la sección todavía está entrando en pantalla.

**No probado:** dispositivos físicos, zoom del navegador distinto de 100 % y barras dinámicas de navegadores móviles reales. El Chrome automatizado emula el tamaño y el modo táctil, pero no esas barras. Se usaron unidades `svh`/`dvh` y áreas seguras, pero falta confirmarlo en teléfonos.

---

## 4. Rendimiento

Mismo equipo (AMD Radeon 780M), mismo Chrome, mismas condiciones. «Antes» es el tag `pre-iteracion3-2026-11-09`.

### Coste de GPU por cuadro (2560×1440 de búfer, sin el tope de pantalla)

| Escena | Antes | Después | Llamadas de dibujo |
|---|---|---|---|
| Atrio | 4,9–5,2 ms | 4,8–5,1 ms | 45 → 45 |
| SOL♯ en juego | 4,6 ms | 5,1–5,2 ms | 61 → 45 |
| SOL♯ en preludio | 4,6 ms | 5,4 ms | 67 → 51 |
| FA♯ en juego | 5,6 ms | 5,6 ms | 89 → 82 |
| DO y LA♯ en juego | 6–11 ms | 6–11 ms | 29 → 29 |

- SOL♯ cuesta 0,5–0,9 ms más de GPU. Por partes: la galaxia unos 0,6 ms y el plano del holograma unos 0,3 ms. Sigue siendo la escena más barata y queda lejos del presupuesto de 16,6 ms.
- DO y LA♯ dieron valores muy dispersos entre repeticiones (6 a 11 ms en las dos versiones), así que **no se puede afirmar ninguna diferencia** en ellas.

### Fluidez con la CPU frenada 4× (simula un equipo modesto), 1280×720

| Escena | Antes | Después |
|---|---|---|
| SOL♯ en preludio | 78–82 fps (p95 20 ms) | 100 fps (p95 10 ms) |
| SOL♯ en juego | 72–76 fps | 75–76 fps |
| Atrio, FA♯, LA♯ | 102–120 fps | 102–120 fps |

La mejora del preludio de SOL♯ viene de que el holograma ya no anima un segundo personaje completo en cada cuadro: ahora se dibuja pequeño, a una textura, a 30 Hz.

### Perfil de CPU de SOL♯ en juego

Medido por una sesión paralela con el perfilador de Chrome: el 65 % del tiempo el hilo principal está ocioso. Lo más caro en JavaScript es `updateMatrixWorld` (3,3 %), el dibujo del lienzo 2D (3,2 %) y `hint()` (0,7 %). De ahí salieron tres ajustes menores, ya incluidos y probados:

- `hint()` solo escribe en el DOM cuando el texto cambia (antes, en cada cuadro).
- Los sensores de SOL♯ se proyectan sin crear vectores nuevos ni recalcular toda la jerarquía del avatar.
- El holograma se refresca a 20 Hz durante el minijuego y a 30 Hz en el preludio.

Tras estos ajustes se repitió la matriz en SOL♯, RE y LA♯ (45 combinaciones, 270 estados): 0 superposiciones, y los sensores siguen anclados a la cabeza y las muñecas.

### Sin freno (2560×1440)

Las dos versiones van al tope de la pantalla del entorno de prueba: 103–105 fps, con el percentil 99 en 10,2–10,8 ms, en atrio, FA♯, SOL♯ y LA♯. **No se reprodujeron las ralentizaciones de SOL♯ en este equipo**, ni antes ni después.

### Memoria y recursos

| Prueba | Antes | Después |
|---|---|---|
| Texturas tras 3 visitas a FA♯, SOL♯ o LA♯ | +2 por visita (+3 en SOL♯) | 0 |
| 12 entradas y salidas (SOL♯, LA♯, FA♯ × 4) | — | geometrías, texturas, programas, objetos de escena y nodos del DOM idénticos entre la vuelta 1 y la 4 |

La fuga era la textura de huesos del esqueleto, que no se liberaba al cambiar de traje.

### Peso

| Recurso | Antes | Después |
|---|---|---|
| Ilustraciones de la pantalla de inicio de la landing | 2,14 MB (PNG) | 0,20 MB (WebP) |

### Técnicas usadas y descartadas

- **Usadas:**
  - mallas instanciadas (losas, hojas);
  - partículas en un solo `Points` animadas en el shader (luciérnagas, estrellas, polvo);
  - textura horneada una vez (nebulosa);
  - impostor con render a textura (holograma);
  - búferes fijos (cinta, estela);
  - resolución reducida mientras hay una tarjeta abierta;
  - liberación de esqueletos.
- **Descartadas por ahora:**
  - LOD de escenarios: cada uno es una sola malla ya optimizada;
  - convertir los personajes a GLB: bajaría mucho la descarga, pero toca el sistema de huesos y de flauta, que está afinado a mano; queda como recomendación;
  - posproceso de desenfoque dentro del motor: el filtro del compositor es más barato.

---

## 5. Evidencias visuales

Todas en [evidencias/iteracion3/](evidencias/iteracion3/). Las más representativas:

| Tema | Antes | Después |
|---|---|---|
| SOL♯ en juego | `antes_sol_juego_1366.jpg` | `r5_1366x768_juego.jpg`, `r5_390x844_juego.jpg` |
| Ficha con escena desenfocada | `antes_sol_ficha_1366.jpg` | `r5_1366x768_ficha.jpg` |
| LA♯ en juego | `antes_la_juego_1366.jpg`, `antes_la_juego_390.jpg` | `r6_1366x768_juego.jpg`, `r6_390x844_juego.jpg`, `r6_844x390_juego.jpg`, `r6_320x568_juego.jpg` |
| Menú con satélites | `antes_menu_1366.jpg` | `r0_1366x768_menu.jpg`, `r0_390x844_menu.jpg`, `r0_844x390_menu.jpg` |
| Embebido con «Salir» | — | `emb_r0_1366x768_atrio.jpg`, `integ_3_sala_embebida.jpg`, `integ_4_sala_390x844.jpg`, `integ_4_sala_844x390.jpg` |
| LA♯: partituras | — | `la_preludio.jpg`, `la_formando.jpg`, `la_formada.jpg` |
| FA♯: cinta y estela | — | `fa_cinta.jpg` |
| Atrio: memoria y losas | — | `atrio_memoria_a.jpg`, `atrio_memoria_b.jpg` |
| Landing: inicio en celular | — | `boot_375x667_carga.jpg`, `boot_375x667_inicio.jpg` |
| Landing: M4 | — | `landing_1366x768_m4_03.jpg`, `landing_2560x1080_m4_075.jpg`, `landing_844x390_m4_045.jpg`, `landing_320x568_m4_06.jpg` |
| Landing: créditos con el logotipo | — | `m6_1366x768.jpg`, `m6_390x844.jpg`, `m6_2560x1080.jpg` |

Los guiones que generan estas pruebas están en [pruebas/](pruebas/) y los datos en [evidencias/iteracion3/datos/](evidencias/iteracion3/datos/).

---

## 6. Validación funcional

| # | Caso | Resultado |
|---|---|---|
| 1 | Cargar la landing desde cero | Hecho en once resoluciones; sin errores de página |
| 2 | Recorrerla completa con scroll | Hecho: 15 puntos por resolución |
| 3 | Fotografías, textos y transiciones | 0 cruces en M4; créditos y logotipo visibles |
| 4 | Entrar al juego desde la landing | Portal + E abre el juego en un solo marco |
| 5 | Pantalla de inicio del juego | Menú con satélites, en las once resoluciones |
| 6 | Atrio | Hecho, con y sin progreso |
| 7 | Entrar a cada nivel | Las seis salas, por `?room=` y desde el atrio |
| 8 | Preloaders | Se muestran en cada entrada. El de error no se forzó en esta tanda |
| 9 | Nombres y narraciones | Ficha de sala y locución, sin choques |
| 10 | Abrir y cerrar tarjetas | Ficha, cierre y ayuda. La escena se desenfoca y vuelve |
| 11 | Botones de los satélites | Visibles y con su entrada marcada. Cada uno recarga con `?entry=`. Fanzine → skin cyborg se comprobó en la iteración anterior; en esta no se recorrieron los cuatro uno por uno |
| 12 | Volver al atrio desde los niveles | Hecho: 12 veces en la prueba de fugas y en la de integración |
| 13 | Volver a la landing desde el juego | «Salir» cierra el juego, deja 0 marcos y conserva el scroll |
| 14 | Cambiar la proporción en cada estado | Matriz de 105 combinaciones + cambio de tamaño en vivo |
| 15 | Completar niveles y ver evolucionar el atrio | Progreso guardado, restaurado al recargar y borrado al reiniciar. Memoria visible con las seis salas. El cierre se simuló llamando al final del minijuego, no jugando cada uno |
| 16 | Efectos y animaciones nuevas | Capturas de SOL♯, LA♯, FA♯ y atrio; sin errores de consola |
| 17 | Sin acumulación de recursos ni listeners | Recursos de GPU y nodos del DOM estables en 12 entradas y salidas. Los listeners no se contaron de forma directa |

Errores de consola en todas las pruebas: solo los 404 esperados de las locuciones que aún no existen (`Voz_*.mp3`) y del favicon del juego.

---

## 7. Limitaciones y pendientes

1. **Ralentizaciones de SOL♯.** No las pude reproducir aquí. Si persisten en otro equipo, hace falta saber cuál es (o una grabación), porque en este la sala va al tope de pantalla.
2. **Dispositivos reales.** Todo lo táctil se probó emulado. Faltan teléfonos y tabletas físicos, las barras del navegador móvil y el zoom.
3. **Estela verde.** La pediste para «Matar al padre», pero la estela y la trayectoria sobre el piso existen en FA♯ («El cuerpo»), donde la avatar lleva el traje de «Matar al padre». La mejoré ahí. Si la quieres también en LA♯, hay que añadirla: en ese minijuego la avatar no camina.
4. **Baldosa y paneles modelados, «Music Frames».** Siguen sin existir como archivos en el proyecto; las losas y las hojas son procedurales.
5. **Menú del juego.** El desenfoque de escena se aplica a ficha, cierre y ayuda. En el menú inicial se conserva el atrio visible detrás del vidrio, como se pidió en la iteración anterior. Si prefieres desenfocarlo también, es una línea de CSS.
6. **Personajes en FBX (9–12 MB cada uno).** Es la mayor descarga que queda. Convertirlos a GLB toca el sistema de huesos; queda recomendado, no hecho.
7. **Locuciones.** Los archivos `Voz_*` no están; el juego subtitula con ritmo de lectura.
8. **Instagram y LinkedIn.** Igual que antes: falta el destino del botón y confirmar a mano los perfiles.
9. **Publicación.** Three.js sigue viniendo del CDN. Nada se ha publicado ni subido a un remoto.

---

## 8. Estado de entrega

- **Landing:** `flauxus/landing` · commits de esta iteración sobre `main`.
- **Juego:** `flauxus/juego` · commits de esta iteración sobre `main`.
- **Volver al estado anterior:** en cada repositorio, `git checkout pre-iteracion3-2026-11-09`.

Ejecutar en desarrollo (sirve la landing y el juego en `/juego/`):

```bash
npm --prefix flauxus/landing run dev -- --port 5173 --strictPort
```

Compilar para producción (deja todo en `flauxus/landing/dist`, comprobado en esta iteración):

```bash
npm --prefix flauxus/landing run build
```

Parámetros de prueba del juego: `?room=1…6`, `?entry=fanzine|poster|cards`, `?perf`, `?input=touch`, `?raf=timer`.

Repetir las pruebas automáticas: los guiones de [pruebas/](pruebas/) usan `puppeteer-core` y el Chrome instalado. Con el servidor de desarrollo encendido, por ejemplo: `node audit.mjs` (matriz del juego), `node landing.mjs`, `node integ.mjs`, `node fugas.mjs`.
