/* ======================================================================
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
export const PISTAS = {
  1: {
    sala: 'DO', audio: 'audio/locucion/DO', dur: 12.75,
    segs: [
      { t0: 0.52, t1: 2.96, texto: 'Construir un cuerpo disciplinado para la interpretación',
        w: [0.52, 0.9, 1.1, 1.5, 2.06, 2.2, 2.46] },
      { t0: 2.96, t1: 6.43, texto: 'de música académica occidental implica un conflicto silencioso:',
        w: [2.96, 3.2, 3.58, 4.02, 4.76, 5.02, 5.42, 5.74] },
      { t0: 6.81, t1: 9.28, texto: 'una tensión entre la estandarización de la práctica',
        w: [6.81, 7.12, 7.54, 7.68, 7.84, 8.56, 8.66, 8.9] },
      { t0: 9.3, t1: 12.47, texto: 'y la demanda de ser yo, una artista única y original.',
        w: [9.3, 9.4, 9.66, 9.94, 10.08, 10.34, 10.8, 10.96, 11.58, 11.8, 12.24] }
    ]
  },
  2: {
    sala: 'RE', audio: 'audio/locucion/RE', dur: 50.21,
    segs: [
      { t0: 0.5, t1: 2.9, texto: 'El metrónomo se patentó en 1815',
        w: [0.5, 0.62, 1.06, 1.32, 1.6, 1.78] },
      { t0: 2.9, t1: 5.84, texto: 'y fue percibido como un instrumento que permitiría tener',
        w: [2.9, 3.04, 3.26, 3.8, 3.98, 4.3, 4.74, 5.08, 5.62] },
      { t0: 5.84, t1: 7.69, texto: 'una indicación matemática del tempo,',
        w: [5.84, 6.04, 6.58, 7.2, 7.52] },
      { t0: 7.87, t1: 11.4, texto: 'independiente del conocimiento de las convenciones interpretativas',
        w: [7.87, 8.7, 8.94, 9.58, 9.68, 9.92, 10.66] },
      { t0: 11.4, t1: 14.08, texto: 'propias de los géneros musicales o los estilos nacionales.',
        w: [11.4, 11.66, 11.8, 11.96, 12.52, 12.86, 13.02, 13.22, 13.58] },
      { t0: 14.76, t1: 16.88, texto: 'Así habría la posibilidad de tener',
        w: [14.76, 15.48, 15.72, 15.9, 16.48, 16.72] },
      { t0: 16.88, t1: 19.21, texto: 'una aproximación mecánica al tempo y al ritmo.',
        w: [16.88, 17.16, 17.82, 18.26, 18.46, 18.66, 18.74, 18.96] },
      { t0: 19.92, t1: 21.54, texto: 'Hummel decía que con esta herramienta',
        w: [19.92, 20.3, 20.52, 20.7, 20.88, 21.16] },
      { t0: 21.54, t1: 24.76, texto: 'una obra podría tocarse al mismo tempo en cualquier parte del mundo,',
        w: [21.54, 21.86, 22.2, 22.42, 22.76, 22.92, 23.3, 23.4, 23.68, 23.96, 24.24, 24.5] },
      { t0: 24.97, t1: 26.82, texto: 'toda una ventaja para la composición.',
        w: [24.97, 25.18, 25.4, 25.78, 25.92, 26.18] },
      { t0: 27.35, t1: 29.66, texto: 'Sin embargo, los intérpretes se demoraron más',
        w: [27.35, 27.72, 28.08, 28.3, 28.82, 28.94, 29.48] },
      { t0: 29.66, t1: 31.7, texto: 'en adoptarlo como compañero de estudio.',
        w: [29.66, 29.94, 30.4, 30.8, 31.1, 31.42] },
      { t0: 32.25, t1: 36.04, texto: 'Se consideraba una referencia más que una indicación de pulso constante,',
        w: [32.25, 32.6, 32.9, 33.18, 33.72, 33.86, 33.98, 34.2, 34.6, 34.8, 35.46] },
      { t0: 36.38, t1: 37.64, texto: 'pues, aun hasta el siglo XX,',
        w: [36.38, 36.48, 36.7, 36.82, 37.04, 37.3] },
      { t0: 37.64, t1: 40.55, texto: 'las variaciones sutiles de tempo eran comunes y deseables.',
        w: [37.64, 37.84, 38.38, 38.76, 39.02, 39.2, 39.48, 39.78, 40.04] },
      { t0: 41.16, t1: 42.86, texto: 'De hecho, se instaba a los tecladistas',
        w: [41.16, 41.4, 41.56, 41.8, 42.04, 42.12, 42.3] },
      { t0: 42.86, t1: 45.97, texto: 'a mantener el pulso con una mano y modificarlo con la otra.',
        w: [42.86, 43.08, 43.38, 43.64, 43.94, 44.12, 44.4, 44.5, 44.66, 45.32, 45.5, 45.76] },
      { t0: 46.85, t1: 49.28, texto: '¿Podremos volver a deshacernos del yugo del metrónomo?',
        w: [46.85, 47.34, 47.5, 47.62, 48.14, 48.32, 48.56, 48.78] }
    ]
  },
  3: {
    sala: 'MI', audio: 'audio/locucion/MI', dur: 26.75,
    segs: [
      { t0: 1.65, t1: 3.2, texto: '¿Hay realmente una intención?',
        w: [1.65, 2.14, 2.4, 2.62] },
      { t0: 3.71, t1: 6.12, texto: '¿Trasciende la ganancia que suponía el componer?',
        w: [3.71, 4.2, 4.4, 4.8, 5, 5.36, 5.66] },
      { t0: 6.35, t1: 8.44, texto: 'Y, si la hay ¿Puedo acceder a ella?',
        w: [6.35, 6.4, 6.6, 6.82, 7.42, 7.62, 8, 8.22] },
      { t0: 8.62, t1: 9.95, texto: '¿Necesito acceder a ella?',
        w: [8.62, 9.12, 9.5, 9.78] },
      { t0: 10.52, t1: 13.37, texto: 'Con o sin conocimiento de la intención, el canon suena.',
        w: [10.52, 10.68, 10.82, 11.06, 11.62, 11.7, 11.88, 12.46, 12.68, 13] },
      { t0: 13.74, t1: 17.93, texto: 'Y ha sonado. Y seguirá sonando con o sin mí (con o sin ti).',
        w: [13.74, 13.78, 13.92, 14.78, 15.02, 15.34, 15.88, 16.04, 16.18, 16.42, 17.22, 17.36, 17.52, 17.76] },
      { t0: 18.97, t1: 21.32, texto: 'Tal vez la revelación es que no hay nada que entender',
        w: [18.97, 19.1, 19.26, 19.48, 19.9, 20.02, 20.16, 20.24, 20.46, 20.6, 21.04] },
      { t0: 21.52, t1: 22.88, texto: 'y, si lo hay, está perdido.',
        w: [21.52, 21.58, 21.78, 21.94, 22.16, 22.46] },
      { t0: 23.43, t1: 26.3, texto: 'De lo único de lo que puedo estar segura, es de mi intención.',
        w: [23.43, 23.5, 23.8, 23.96, 24.02, 24.14, 24.36, 24.56, 24.86, 25.36, 25.48, 25.56, 25.78] }
    ]
  },
  4: {
    sala: 'FA', audio: 'audio/locucion/FA', dur: 20.53,
    segs: [
      { t0: 1.19, t1: 4.79, texto: 'Sobrevivimos buscando la propia voz sobre una técnica estandarizada,',
        w: [1.19, 2.06, 2.38, 2.64, 2.92, 3.22, 3.4, 3.72, 3.98] },
      { t0: 4.97, t1: 6.43, texto: 'modificándonos para ella,',
        w: [4.97, 5.88, 6.18] },
      { t0: 6.6, t1: 9.62, texto: 'muy rara vez modificando la obra para que se amolde a nosotras.',
        w: [6.6, 6.76, 7, 7.2, 7.82, 8.06, 8.34, 8.48, 8.62, 8.74, 9, 9.08] },
      { t0: 10.33, t1: 13.67, texto: 'Hablamos sobre nuestro cuerpo para reprocharle lo que no podemos hacer,',
        w: [10.33, 10.78, 10.98, 11.4, 11.64, 11.92, 12.44, 12.56, 12.7, 13.08, 13.48] },
      { t0: 13.85, t1: 17.4, texto: 'pero dejamos de lado que la dimensión corporal no se agota en la técnica',
        w: [13.85, 14.04, 14.4, 14.64, 14.82, 14.94, 15.1, 15.62, 16.06, 16.2, 16.34, 16.58, 16.7, 17.08] },
      { t0: 17.4, t1: 20.09, texto: 'y que concientizar esto nos podría dotar de agencia.',
        w: [17.4, 17.5, 17.68, 18.46, 18.62, 19, 19.2, 19.5, 19.62] }
    ]
  },
  5: {
    sala: 'SOL', audio: 'audio/locucion/SOL', dur: 13.96,
    segs: [
      { t0: 0.17, t1: 1.91, texto: 'Nadie me lo dijo explícitamente,',
        w: [0.17, 0.46, 0.56, 0.76, 1.04] },
      { t0: 2.14, t1: 4.9, texto: 'tardé años en desenmarañar esa tensión incómoda',
        w: [2.14, 2.58, 2.8, 2.98, 3.72, 4.1, 4.48] },
      { t0: 4.9, t1: 6.93, texto: 'y encontrar este conflicto iluminador.',
        w: [4.9, 5.26, 5.56, 5.94, 6.28] },
      { t0: 7.53, t1: 10.17, texto: 'Ahora queda el vacío de entender que no importa qué haga,',
        w: [7.53, 7.8, 7.98, 8.18, 8.46, 8.76, 9, 9.12, 9.46, 9.74, 9.98] },
      { t0: 10.48, t1: 11.88, texto: 'nunca estaré en gracia con todos.',
        w: [10.48, 10.8, 10.94, 11.1, 11.42, 11.7] },
      { t0: 12.43, t1: 13.96, texto: 'Entonces puedo hacer lo que quiera.',
        w: [12.43, 12.88, 13.12, 13.26, 13.38, 13.56] }
    ]
  },
  6: {
    sala: 'LA', audio: 'audio/locucion/LA', dur: 61.21,
    segs: [
      { t0: 0.31, t1: 3.38, texto: 'En este proyecto, la idea de matar al padre es una metáfora',
        w: [0.31, 0.46, 0.98, 1.24, 1.42, 1.62, 1.86, 2.06, 2.32, 2.5, 2.66, 2.9] },
      { t0: 3.38, t1: 5.44, texto: 'que funciona como detonante creativo',
        w: [3.38, 3.72, 4.12, 4.4, 4.96] },
      { t0: 5.54, t1: 8.6, texto: 'y se refiere a cómo, desde mi posición de intérprete,',
        w: [5.54, 5.66, 5.86, 6.16, 6.4, 6.74, 6.98, 7.42, 7.64, 7.84] },
      { t0: 8.62, t1: 11.05, texto: 'asumo un lugar de autoridad frente a la tradición,',
        w: [8.62, 8.94, 9.2, 9.4, 9.58, 10.06, 10.24, 10.32, 10.5] },
      { t0: 11.2, t1: 14.88, texto: 'al compositor como figura ideal y a la obra como ente cerrado,',
        w: [11.2, 11.4, 11.96, 12.24, 12.64, 13.12, 13.2, 13.3, 13.6, 13.86, 14.12, 14.42] },
      { t0: 15.37, t1: 17.28, texto: 'y tomo agencia sobre mi instrumento,',
        w: [15.37, 15.46, 15.72, 16.16, 16.32, 16.6] },
      { t0: 17.28, t1: 19.32, texto: 'las técnicas instrumental y compositiva,',
        w: [17.28, 17.52, 18.26, 18.48, 18.68] },
      { t0: 19.64, t1: 22.33, texto: 'los rituales de enunciación y, sobre todo, las obras.',
        w: [19.64, 19.88, 20.16, 20.24, 20.94, 21.14, 21.46, 21.8, 22.12] },
      { t0: 23.16, t1: 26.48, texto: 'Planteo la exploración de esa agencia desde el concepto de intervención,',
        w: [23.16, 23.44, 23.68, 24.16, 24.3, 24.6, 24.88, 25.04, 25.32, 25.58, 25.86] },
      { t0: 26.48, t1: 29.67, texto: 'que, dentro de las prácticas artísticas de los siglos XX y XXI,',
        w: [26.48, 26.78, 27, 27.08, 27.3, 27.8, 28.24, 28.38, 28.56, 28.88, 29.06, 29.44] },
      { t0: 30.1, t1: 33.06, texto: 'se refiere a acciones o performances en los que se interactúa',
        w: [30.1, 30.26, 30.5, 30.62, 31.04, 31.52, 31.88, 32, 32.16, 32.28, 32.68] },
      { t0: 33.06, t1: 36.1, texto: 'con objetos o espacios preexistentes (entre ellos obras)',
        w: [33.06, 33.44, 33.62, 33.76, 34.2, 35.36, 35.58, 35.92] },
      { t0: 36.6, t1: 39.75, texto: 'para modificarlos o generar nuevos sentidos a partir de ellos.',
        w: [36.6, 36.78, 37.52, 37.76, 38.1, 38.42, 38.8, 39.04, 39.3, 39.54] },
      { t0: 40.53, t1: 43.74, texto: 'Así, busco intervenir obras del repertorio canónico para flauta',
        w: [40.53, 40.92, 41.32, 41.7, 41.9, 42.06, 42.64, 43.14, 43.38] },
      { t0: 43.74, t1: 46.1, texto: 'con elementos propios de la práctica contemporánea,',
        w: [43.74, 43.94, 44.44, 44.68, 44.8, 44.96, 45.48] },
      { t0: 46.16, t1: 48.96, texto: 'como las técnicas extendidas, la electrónica y la improvisación,',
        w: [46.16, 46.32, 46.46, 46.96, 47.4, 47.6, 48, 48.08, 48.38] },
      { t0: 49.44, t1: 52.48, texto: 'para generar nuevas interpretaciones desde una perspectiva',
        w: [49.44, 49.68, 50.08, 50.54, 51.24, 51.48, 51.82] },
      { t0: 52.48, t1: 54.26, texto: 'no sólo centrada en la partitura,',
        w: [52.48, 52.76, 53, 53.28, 53.38, 53.62] },
      { t0: 54.28, t1: 57.34, texto: 'sino también en su tradición interpretativa, sus referencias',
        w: [54.28, 54.68, 54.88, 54.98, 55.18, 55.74, 56.46, 56.74] },
      { t0: 57.34, t1: 60.84, texto: 'y la manera en la que yo, como intérprete, elijo relacionarme con ellas.',
        w: [57.34, 57.42, 57.64, 57.82, 57.88, 58, 58.26, 58.48, 58.8, 59.46, 59.9, 60.48, 60.66] }
    ]
  }
};
