// Çevrimdışı destek: uygulama dosyaları ve kütüphaneler önbellekten açılır, harita parçaları görüldükçe saklanır.
const APP = "tm-app-v2", TILES = "tm-tiles-v1", MAX_TILES = 1500;
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== APP && k !== TILES).map(k => caches.delete(k)))));
  self.clients.claim();
});

async function trim(){ const c = await caches.open(TILES), keys = await c.keys(); for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]); }

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;                         // Supabase / Overpass yazmaları: her zaman ağ
  if (url.hostname.endsWith("supabase.co") || url.hostname.includes("overpass")) return;
  if (url.hostname === "tiles.openfreemap.org") {             // harita: önce önbellek
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) { c.put(req, res.clone()); trim(); } return res;
    }));
    return;
  }
  // uygulamanın kendisi: önce internetten en yeni sürüm, internet yoksa kayıtlı sürüm
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => { caches.open(APP).then(c => c.put("./", res.clone())); return res; })
      .catch(() => caches.match("./")));
    return;
  }
  // kütüphaneler: önbellekten hemen aç, arkada güncelle
  e.respondWith(caches.open(APP).then(async c => {
    const hit = await c.match(req);
    const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
