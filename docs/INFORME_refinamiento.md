# FLAUXUS · Informe del refinamiento integral (9 nov 2026)

Responde al prompt maestro guardado en [PROMPT_MAESTRO_refinamiento.md](PROMPT_MAESTRO_refinamiento.md).
Respaldo previo a todo cambio:

- tags `pre-refinamiento-2026-11-09` en `flauxus/landing` y `flauxus/juego`;
- zips en `respaldos/2026-11-09_pre-refinamiento/`.

---

## A. Resumen ejecutivo

La landing y el juego siguen integrados igual que antes: el iframe en `/juego/`, las mismas rutas y los mismos controles. Lo nuevo:

- **Portal auténtico.** El portal de [ JUEGA YA ] muestra el juego real: una toma del Atrio con María Clara vestida de «Matar al padre», renderizada desde el propio motor. Es un video de 7 s en bucle sin corte y pesa 0,3–0,45 MB.
- **Las seis notas abren su sala.** Al pulsar E, o al tocar el aviso en pantallas táctiles, el juego abre directo el nivel correspondiente. Antes la tecla E no estaba programada.
- **Créditos académicos.** Cada integrante y la directora tienen su enlace profesional. El botón «Tomar aire de nuevo» lleva el ícono de Instagram.
- **Juego con el lenguaje de la landing:**
  - preloader honesto, sin porcentajes inventados y con aviso cuando algo falla;
  - menú de vidrio con el atrio visible detrás;
  - colores del menú según la skin, con cian y rosado para la cyborg;
  - menos información encimada en pantalla;
  - la palabra «prototipo» ya no aparece en la interfaz.
- **Escenarios:**
  - **Atrio:** las losas flotantes ahora son una sola malla instanciada, con bisel.
  - **FA♯:** estela mágica de partículas.
  - **SOL♯:** cámara más amplia y un holograma coreográfico de la cyborg al fondo.
  - **LA♯:** hojas de partitura suspendidas en dos anillos orbitales.
  - **Cámaras:** se adaptan al tamaño de la avatar y al formato de la pantalla.

---

## B. Landing page

| Cambio | Estado | Archivos |
|---|---|---|
| Portal: el primer canal es el Atrio con María Clara («Matar al padre»). Versión 16:9 para escritorio y 9:16 para celular, con póster fijo de respaldo para movimiento reducido o si el video no se reproduce. Los concept art se conservan como canales 2 y 3. | Hecho y verificado (capturas de escritorio y tableta vertical) | `src/ui/channels.js`, `src/experience.js`, `public/video/atrio-preview_*` |
| Seis notas: la E, o tocar el aviso, abre `/juego/?room=1…6`. Tiene un candado contra pulsaciones repetidas y no actúa en campos de texto ni con modificadores. | Hecho; **las seis notas probadas una por una** | `src/moments/m5-salas.js`, `index.html` |
| La E también entra desde el portal, porque el portal ya anunciaba «[E]». | Hecho | `src/moments/m2-portal.js` |
| Créditos académicos: integrantes (Ana María Ocampo Coutin, Santiago David Labrador Navarro, Jaime Andrés Messa Enríquez) y dirección académica (Juliana Pino Mesa, «Directora de proyecto», con su perfil de la Javeriana Cali). Enlaces con `target="_blank"`, `rel="noopener noreferrer"`, foco visible y texto para lectores de pantalla. | Hecho; los cuatro enlaces verificados en el DOM | `index.html`, `src/styles/main.css` |
| «Tomar aire de nuevo» con ícono de Instagram en SVG. El ícono hereda el color del botón y el efecto de letras revueltas ya no lo borra. El destino queda en `data-instagram=""` y el botón sigue rebobinando. | Hecho | `index.html`, `src/ui/textfx.js`, `main.css` |
| Responsive: el cierre ya no recorta el título ni el botón en celulares. Las ventanas verticales (tableta en retrato) usan la composición vertical con el portal 9:16. | Hecho y verificado en 360×800 y 768×1024 | `main.css`, `src/profile.js` |

**Cargos en los créditos.** Se conservaron los de los créditos originales de la landing. El cargo de Juliana, «Directora de proyecto», también viene de ahí. No se agregó ningún título ni trayectoria.

**Nombres.** «Ana María Ocampo Coutin» coincide en los créditos y en el prompt. «Santiago Labrador Navarro» pasó al nombre completo que diste.

---

## C. Videojuego

### Sistema general

| Cambio | Detalle |
|---|---|
| **Preloader** (`ui/loader.js`, `index.html`, `style.css`) | Logotipo, ecualizador de 7 barras como indicador de actividad, título del Momento en Unbounded y etiquetas en Martian Mono. **Sin porcentajes inventados**: muestra la etapa actual, las dos anteriores con ✓ y, al bajar un escenario, los MB y el % reales de la descarga cuando el servidor informa el tamaño. Si una carga falla, la cortina avisa en lenguaje simple y ofrece «Reintentar» y «Volver al atrio». Con movimiento reducido, todo queda quieto. |
| **«Prototipo» retirado** | Se quitó del subtítulo de la marca, de la portada y de un aviso de audio. El selector «Simular entrada» ya no se ve: solo aparece con `?dev`. No se cambiaron identificadores ni rutas. |
| **Menú en vidrio** (`style.css`) | Panel con `backdrop-filter: blur(16px)` limitado a su propia caja, que no procesa todo el lienzo. Fondo oscurecido solo en los bordes, halo detrás del panel e instrucciones en un segundo plano de vidrio más oscuro. En pantallas táctiles el desenfoque baja a 10 px; sin soporte, el panel es opaco. Hay variantes para celular y para pantallas horizontales bajas. |
| **Jerarquía de la información** (`Main.js`, `ui/hud.js`, `style.css`) | `body[data-phase]`:<br>• en la portada se ocultan la ficha del atrio y las pestañas;<br>• la descripción de cada sala se pliega a los 9 s;<br>• durante la locución se apartan la descripción y la fuente;<br>• en juego manda la ficha del minijuego;<br>• el aviso de ayuda ya no pisa la ficha (antes se superponían en 1280 px). |
| **Colores según la skin** (`core/state.js`, `style.css`) | Reutiliza el estado existente (`skinKind(0)`, que decide la avatar del atrio) → `body[data-skin]`. Con la cyborg (`?entry=fanzine`): eyebrow cian (#19C6D9, el token `--rw-cian` de la landing), barra cian→rosado, botón en degradado, halos ambientales y ecualizador bicolor. Las demás entradas no cambian. |

### Por nivel

| Nivel | Cambio | Detalle técnico |
|---|---|---|
| **Atrio** | Losas flotantes de calidad | 38 mallas con 38 geometrías → **1 `InstancedMesh`** con caja biselada (`RoundedBoxGeometry`) y el material de piedra del propio atrio. Conservan órbita, flotación y balanceo. |
| **FA♯** | Estela mágica | `engine/trail.js`: un `THREE.Points` con pool fijo (420 partículas; 180 en táctil). Nacen detrás de la avatar según su rumbo, giran en remolino y se apagan en 1,8–3,2 s. Verde FLAUXUS con núcleo claro y centelleo. 1 llamada de dibujo. |
| **SOL♯** | Cámara | La cámara del juego pasó de (0, 2.63, 9) a (0, 3.0, 10.6) y se aleja más en formatos verticales. La cámara de paseo escala distancia y altura con el tamaño de la avatar (1,5× en SOL). |
| **SOL♯** | Holograma coreográfico | `engine/hologram.js`: reutiliza el rig cyborg que la sala ya carga, con la misma geometría y los mismos clips, en material aditivo cian→rosado con líneas de barrido. Toca la flauta con la pose del juego y alterna frases de pasos en el sitio con giros y balanceo. Flota a la izquierda, en el vacío, fuera del triángulo de sensores. No colisiona, no proyecta sombra y no juega. **Vigila el tiempo por cuadro**: pasa a media frecuencia y, si hace falta, se apaga. |
| **LA♯** | Hojas de partitura en órbita | Seis biombos de cajas y tubos (42 mallas) → **dos anillos concéntricos de hojas curvadas** (8 + 12) con textura de partitura y el tajo verde de la intervención. Giran lento y en sentidos opuestos. Son 2 `InstancedMesh`, con 1 material y 1 textura. Quedan por encima de los biombos fijos del modelo y de la espiral de la cámara, para que nunca la atraviesen. |
| **Todas** | Auditoría de cámaras | `player.js · camFrameScale()`: la cámara en tercera persona escala con la avatar y con el formato (×1,08 entre 0,8 y 1,1 de proporción; ×1,18 en vertical). En el atrio horizontal no cambia nada. |

---

## D. Archivos intervenidos

**Landing** (commits `e5bd3b1`, `bd551d1`):

- **Nuevos:**
  - `public/video/atrio-preview_16x9.mp4`
  - `public/video/atrio-preview_9x16.mp4`
  - los dos pósters
- **Modificados:**
  - `index.html`
  - `src/experience.js`
  - `src/profile.js`
  - `src/moments/m2-portal.js`
  - `src/moments/m5-salas.js`
  - `src/ui/channels.js`
  - `src/ui/textfx.js`
  - `src/styles/main.css`

**Juego** (commits `88002de` y `e87d1b0`, este último con los ajustes para celular):

- **Nuevos:**
  - `engine/trail.js`
  - `engine/hologram.js`
- **Modificados:**
  - `index.html`
  - `style.css`
  - `Main.js`
  - `flow.js`
  - `player.js`
  - `AssetManager.js` (progreso real y registro de fallos)
  - `atrium/atrium.js`
  - `core/config.js`
  - `core/state.js`
  - `rooms/FA.js`
  - `rooms/SOL.js`
  - `rooms/LA.js`
  - `ui/hud.js`
  - `ui/loader.js`
- **Recursos reutilizados, sin modelos nuevos:**
  - el rig cyborg (`personaje/MC_cyborg`) para el holograma;
  - la skin «Matar al padre» (`personaje/MC_mtp`) para el video del portal;
  - el material de piedra del atrio para las losas.

---

## E. Rendimiento

**Cambios con efecto conocido**, calculados por construcción:

| Escena | Antes | Después |
|---|---|---|
| Atrio · losas | 38 mallas, 38 geometrías → 38 llamadas de dibujo (+38 en la pasada de sombras) | 1 `InstancedMesh`, 1 geometría → 1 (+1) |
| LA♯ · paneles | 42 mallas, 18 geometrías, 12 materiales | 2 `InstancedMesh`, 2 geometrías, 1 material, 1 textura de 512 px |
| FA♯ | Línea + 40 discos | + 1 llamada de dibujo (estela con pool fijo; no crea objetos mientras se juega) |
| SOL♯ | — | + holograma (malla con skinning y mixer), con control adaptativo de calidad |
| Portal de la landing | Primer canal: concept art de 0,9 MB | Primer canal: atrio de 0,44 MB (escritorio) o 0,28 MB (celular). Los concept art bajan solo si se cambia de canal. |

**Medido antes y después**, misma máquina y mismo método. La versión anterior (tag `pre-refinamiento-2026-11-09`) se sirvió en `localhost:5174` y la nueva en `localhost:5173`; las dos a 1280×720, en calidad alta y con la ventana visible:

| Escena | Llamadas de dibujo* | Geometrías en memoria | Triángulos | FPS (p95 por cuadro) | Lista en** |
|---|---|---|---|---|---|
| Atrio (portada) | 53 → **45** | 49 → **25** | 691 k → 715 k | 120 → 120 (8,7 → 8,4 ms) | 4,4 s → 2,1 s |
| FA♯ (preludio) | 94 → 95 | 101 → **88** | 960 k → 960 k | 120 → 120 (8,4 → 8,5 ms) | 5,7 s → 3,5 s |
| SOL♯ (preludio) | 45 → 67 | 61 → **52** | 341 k → 354 k | 120 → 120 (8,5 → 8,4 ms) | 5,3 s → 2,9 s |
| LA♯ (preludio) | 72 → **34** | 66 → **37** | 933 k → 934 k | 120 → 120 (8,4 → 8,6 ms) | 6,6 s → 4,0 s |

* Incluye las pasadas de bloom. ** Desde que se abre la página hasta que la sala queda jugable.

Lectura:

- **Sin pérdida de fluidez.** Las dos versiones van al tope de la pantalla (120 Hz), con el percentil 95 en ~8,5 ms.
- **Menos llamadas de dibujo y geometrías** en el atrio y en LA♯, gracias a las mallas instanciadas.
- **SOL♯ sube 22 llamadas** por el holograma (cuerpo, flauta y acentos). Es el costo previsto y tiene control adaptativo: pasa a media frecuencia y, si hace falta, se apaga.
- **Los +24 k triángulos del atrio** vienen del bisel de las losas.
- **Los tiempos de carga mejoran**, pero una parte puede deberse a que la versión nueva se midió segunda, con los archivos ya en la caché del disco. No conviene atribuir toda la diferencia al cambio.
- **No hay medición en celulares físicos.** La emulación del navegador no mide su GPU real.
- **La memoria JS** de Chrome se comparte entre páginas del mismo proceso, así que no da una cifra comparable; por eso no se reporta.

---

## F. Validación

**Pruebas ejecutadas:**

- **Landing → nota → E → nivel específico.** DO, RE, MI, FA♯, SOL♯ y LA♯ abren `/juego/?room=N` y el juego queda en `S.room = N`, en fase de preludio y listo, en 1–7 s. Dos E seguidas dejan **un solo** juego abierto. El botón táctil abre la sala elegida (probado con MI).
- **Landing → portal → juego.** [ JUEGA YA ] y la E del portal abren el juego. El portal muestra el atrio real en escritorio (16:9) y en tableta vertical (9:16).
- **Créditos.** Los cuatro enlaces apuntan a la persona correcta, con `target="_blank"` y `rel="noopener noreferrer"`. No hay enlaces vacíos. LinkedIn no se visitó de forma automática: se verificaron la estructura y la correspondencia de cada URL.
- **Producto satélite → skin → menú.**
  - `?entry=fanzine`: `data-skin="cyborg"` y menú con acentos cian y rosado (captura).
  - Entrada directa: `data-skin="original"` y menú verde.
- **Escenarios** (capturas del lienzo WebGL):
  - atrio con losas instanciadas;
  - SOL♯ con su nuevo encuadre, en preludio y en juego, con el holograma visible;
  - LA♯ con los dos anillos de hojas;
  - FA♯ con la estela de partículas.
- **Preloader.** Muestra las etapas reales («Preparando el museo → ✓ Cargando el atrio y tu avatar → Acomodando la luz…») sin porcentaje inventado.
- **Compilación de producción.** `npm run build` funciona y `dist/juego` incluye `engine/trail.js` y `engine/hologram.js`.

**Matriz responsive de la landing.** Se detectan automáticamente los elementos fuera de la pantalla y el desborde horizontal en cada momento, con la página activa:

| Resolución | Resultado |
|---|---|
| 360 × 800 | Se encontró el cierre recortado. **Corregido**, con captura. |
| 390 × 844 · 430 × 932 | Sin problemas. El cierre ahora es más alto que la pantalla y se recorre con el scroll. |
| 768 × 1024 (tableta vertical) | El aviso del portal se salía. **Corregido** con la composición vertical y el portal 9:16. |
| 844 × 390 (celular horizontal) | Sin problemas. |
| 1024 × 768 · 1366 × 768 · 1920 × 1080 · 2560 × 1080 | Sin problemas. |

**Juego en celular** (390×844, modo táctil emulado):

- **Menú:** panel de vidrio abajo, con el atrio visible arriba.
- **Atrio:** se comprobó que ningún elemento se superpone a otro.
- **SOL♯:** revisado en preludio, ficha y juego. Se corrigieron cuatro superposiciones:
  - el aviso de ayuda se estiraba sobre la ficha (fallo introducido en esta tanda);
  - «Volver al atrio» tapaba el título de la sala;
  - la fuente sonora tapaba la pista de juego;
  - la locución tapaba el botón ⟳.

---

## G. Pendientes y causa

1. **Baldosa modelada del atrio y paneles poligonales de LA♯.** No existen en el proyecto. Se revisó todo:
   - `juego/`, `originales/` (Drive), el zip de OneDrive y los respaldos;
   - cada escenario GLB y FBX resultó ser una sola malla fusionada, sin piezas separables.

   Mientras tanto se mejoraron las versiones de código con instancing y materiales compartidos. Con el archivo de la baldosa o de los paneles, el cambio es pequeño: el código ya usa `InstancedMesh`, así que basta con cambiar la geometría.
2. **«Music Frames».** No hay ningún componente con ese nombre ni nada parecido en la landing ni en el juego; se buscó en el código y en los documentos. Lo más cercano es el marco «Pentagrama · tu secuencia» de LA♯. Hace falta que me digas a qué se refiere, o el archivo o la referencia visual.
3. **Pruebas en dispositivos reales.** Faltan un celular de gama media y una tableta: controles táctiles, FPS con su GPU y el holograma de SOL♯. La emulación del navegador no reemplaza esa prueba.
4. **Repaso de MI, RE y DO en celular.** No se modificaron en esta tanda, pero conviene un recorrido completo en un teléfono.
5. **Destino de Instagram.** Pendiente de definir: falta la URL y si el botón debe seguir rebobinando.
6. **Verificación manual de LinkedIn.** Abrir los tres perfiles y confirmar los nombres antes de publicar.

---

## H. Recomendaciones futuras (no implementadas)

- Usar una baldosa y un panel de papel modelados en Blender, que encajan directo en las `InstancedMesh` actuales.
- Agregar al holograma un clip de danza propio (Mixamo o captura); hoy alterna la pose de flauta con pasos en el sitio.
- Alojar Three.js junto al juego en lugar del CDN y quitar `?dev` antes de publicar.
- Medir en un celular de gama media y ajustar el número de partículas y el desenfoque del vidrio según el resultado.
- Agregar al preloader el progreso real de la grabación de audio de cada sala, que hoy cuenta como etapa pero no como bytes.
