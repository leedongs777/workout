/* MATE 서비스워커 — 오프라인 지원 + 홈 화면 앱 설치
 *
 * ⚠️ 설계 원칙 (바꾸기 전에 반드시 읽을 것)
 * 1) HTML은 반드시 "네트워크 우선". index.html이 앱 전체(단일 파일)라 캐시 우선으로 하면
 *    배포해도 사용자가 옛 버전에 갇힌다. 온라인이면 항상 최신, 오프라인이면 캐시로 폴백.
 * 2) 정적 자원(아이콘/manifest)만 캐시 우선(stale-while-revalidate).
 * 3) Firebase/구글 인증·동기화 요청은 절대 캐시하지 않는다(오래된 인증·데이터 응답 위험).
 * 4) CACHE_VERSION을 올리면 이전 캐시는 activate에서 전부 삭제된다.
 */
const CACHE_VERSION = 'v1';
const CACHE = 'mate-' + CACHE_VERSION;

/* 앱 셸 — 오프라인 첫 실행에 필요한 최소 집합 */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

/* 캐시하면 안 되는 호스트(인증·실시간 동기화) */
const NEVER_CACHE = /(?:firebaseio|firebaseapp|googleapis|gstatic|google\.com|firebase)/i;
/* 오프라인에서도 글꼴이 나오도록 허용하는 외부 호스트 */
const FONT_HOST = /cdn\.jsdelivr\.net/i;

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      // 하나라도 실패하면 설치가 통째로 실패하므로 개별 처리(폰트 CDN 등 불안정 대비)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 앱에서 즉시 업데이트를 요청할 때 */
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                    // POST 등은 건드리지 않음
  const url = new URL(req.url);
  if (NEVER_CACHE.test(url.host)) return;              // 인증·동기화는 항상 네트워크 그대로

  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  /* 1) HTML — 네트워크 우선, 실패 시 캐시 */
  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  /* 2) 같은 출처 정적 자원 + 글꼴 CDN — 캐시 우선 + 뒤에서 갱신 */
  if (url.origin === self.location.origin || FONT_HOST.test(url.host)) {
    e.respondWith(
      caches.match(req).then(hit => {
        const net = fetch(req).then(res => {
          // opaque(no-cors 교차출처) 응답도 폰트용으로는 캐시 가치가 있다
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
  /* 그 외는 브라우저 기본 동작 */
});
