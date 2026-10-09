// El signo ♯ no existe en Tektur (ni en los subsets latin de las otras fuentes): se dibuja como vector, pesado y
// recto como la display, en currentColor. El texto real (♯) queda para lectores de pantalla.
export const SHARP_SVG = '<svg viewBox="0 0 10 14" aria-hidden="true"><path d="M3.2 0.5v13M6.8 0.5v13" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M0.6 5.6 9.4 3.9M0.6 10.1 9.4 8.4" stroke="currentColor" stroke-width="2.3" fill="none"/></svg>';
export const sharpHTML = (text) => text.replace(/♯/g, `<span class="sharp">${SHARP_SVG}<span class="sr-only">♯</span></span>`);
