// Service Worker do Controle de Estudos — cache básico do "app shell" (arquivos estáticos),
// permitindo abrir o app mesmo com internet instável e habilitando o prompt de instalação no Android.
// Os dados de estudo continuam vindo sempre do Firebase (online) — isso aqui só cacheia os
// arquivos do site em si (HTML/CSS/JS/ícones), nunca os seus dados.

const CACHE_NAME = 'controle-estudos-v1';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/firebase-config.js',
    './js/state.js',
    './js/custom-dialogs.js',
    './js/auth.js',
    './js/ui-shell.js',
    './js/timer.js',
    './js/cycle-engine.js',
    './js/subjects.js',
    './js/sessions.js',
    './js/errors-notebook.js',
    './js/mock-exams.js',
    './js/ui-render.js',
    './js/backup-data.js',
    './js/main.js',
    './assets/logo-horizontal.png',
    './assets/icon-192.png',
    './assets/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

// Estratégia "network-first": sempre tenta buscar a versão mais nova da internet primeiro (importante
// pra você sempre receber as atualizações do site assim que sobe no GitHub); só usa o cache como
// reserva se a rede falhar (offline). Requisições ao Firebase não passam por aqui, seguem direto.
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
