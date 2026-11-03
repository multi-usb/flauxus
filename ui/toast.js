/* ======================================================================
   FLAUXUS — ui/toast.js
   Aviso efímero. Módulo hoja: no importa AudioSystem ni estado de juego.
   ====================================================================== */
import { $ } from '../core/util.js';

export function toast(t) {
  const e = $('toast'); e.textContent = t; e.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove('show'), 2300)
}
