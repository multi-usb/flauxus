// Banco de pruebas: Chrome sin ventana (con GPU real) controlado por puppeteer-core.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
export const SHOTS = path.join(DIR, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
export const BASE = process.env.BASE || 'http://localhost:5173';

export async function launch({ gpu = true } = {}) {
  return puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: [
      '--no-first-run', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      ...(gpu ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader']),
    ],
  });
}

export async function open(browser, url, { w = 1280, h = 720, touch = false, dpr = 1 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', (r) => errors.push('fallo: ' + r.url().slice(-80)));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url().slice(-90)); });
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  page.errors = errors;
  return page;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name), type: 'jpeg', quality: 80 });

// Espera a que el juego esté listo (sin preloader) en la sala pedida, o en el menú si room = 0.
export async function gameReady(page, room = 0, timeout = 90000) {
  await page.waitForFunction((room) => {
    const pre = document.getElementById('preloader');
    return window.S && pre && !pre.classList.contains('on') && (room ? (window.S.room === room && window.S.ready) : true);
  }, { timeout, polling: 250 }, room);
  await sleep(900);
}

// Detector de superposiciones y desbordes entre piezas de interfaz visibles.
export const SEL = ['#btnExit', '#hud .brandwrap', '#progress', '#objective', '#hud .rightTop', '#btnBack', '#roomInfo', '#joy', '#unlock',
  '#roomHint', '#vo', '#coach', '#prompt', '#btnVoSkip', '#btnSkip', '#btnLook', '#btnWalk', '#sourceChip', '#brief', '#done', '#miBtns',
  '#laFrame', '#tray', '#laStatus', '#laBtns', '#handWrap', '#intentionCard', '#intro .box', '#help .box', '#epInner'];
export function snap(page, sel = SEL) {
  return page.evaluate((SEL) => {
    const W = innerWidth, H = innerHeight, out = {};
    for (const q of SEL) {
      const e = document.querySelector(q); if (!e) continue;
      let v = true, p = e;
      while (p && p !== document.documentElement) { const s = getComputedStyle(p); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < .05) { v = false; break; } p = p.parentElement; }
      if (!v) continue;
      const r = e.getBoundingClientRect(); if (r.width < 3 || r.height < 3) continue;
      out[q] = [r.left, r.top, r.right, r.bottom].map(Math.round);
    }
    const k = Object.keys(out), ov = [], off = [];
    for (const a of k) { const r = out[a]; if (r[0] < -1 || r[1] < -1 || r[2] > W + 1 || r[3] > H + 1) off.push(a + ' [' + r.join(',') + ']'); }
    for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) {
      const a = out[k[i]], b = out[k[j]];
      if (a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1) ov.push(k[i] + ' × ' + k[j]);
    }
    return { ov, off, n: k.length, scrollX: document.documentElement.scrollWidth > W + 1 };
  }, sel);
}
