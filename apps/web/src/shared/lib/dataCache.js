/**
 * dataCache.js — caché compartida en memoria para toda la aplicación admin.
 * Evita re-fetches redundantes al cambiar entre secciones del dashboard.
 * El caché se invalida automáticamente cuando hay eventos de suscripción.
 */

const CACHE_TTL = 60_000; // 60 segundos

const store = {};

function get(key) {
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    delete store[key];
    return null;
  }
  return entry.data;
}

function set(key, data) {
  store[key] = { data, ts: Date.now() };
}

function invalidate(key) {
  delete store[key];
}

function invalidateAll() {
  Object.keys(store).forEach(k => delete store[k]);
}

export const dataCache = { get, set, invalidate, invalidateAll };