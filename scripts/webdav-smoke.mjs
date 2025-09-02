// Simple WebDAV smoke test using Node 20+ fetch
// Usage (PowerShell):
//   $env:WEBDAV_BASE_URL="https://example.com/remote.php/dav"
//   $env:WEBDAV_USERNAME="user"
//   $env:WEBDAV_PASSWORD="pass"
//   $env:WEBDAV_PATH="Files/Desktop/admin rechte.bat"
//   node ./scripts/webdav-smoke.mjs

const BASE = process.env.WEBDAV_BASE_URL?.trim();
const USER = process.env.WEBDAV_USERNAME ?? '';
const PASS = process.env.WEBDAV_PASSWORD ?? '';
const RAW_PATH = process.env.WEBDAV_PATH ?? '/';

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

if (!BASE || !/^https?:\/\//i.test(BASE)) {
  fail('WEBDAV_BASE_URL fehlt oder ist ungültig. Beispiel: https://your-server/remote.php/dav');
}
if (!USER || !PASS) {
  fail('WEBDAV_USERNAME oder WEBDAV_PASSWORD fehlt.');
}

const auth = 'Basic ' + Buffer.from(`${USER}:${PASS}`, 'utf8').toString('base64');

const normalizePath = (p) => {
  if (!p || p === '/') return '/';
  if (/^https?:\/\//i.test(p)) return p;
  const raw = p.startsWith('/') ? p.slice(1) : p;
  const encoded = raw
    .split('/')
    .map((seg) => {
      if (!seg) return '';
      try {
        return encodeURIComponent(decodeURIComponent(seg));
      } catch {
        return encodeURIComponent(seg);
      }
    })
    .join('/');
  return `/${encoded}`;
};

const joinUrl = (base, path) => base.replace(/\/+$/, '') + path;

async function request(url, options = {}) {
  const res = await fetch(url, options);
  return res;
}

async function main() {
  const path = normalizePath(RAW_PATH);
  const baseUrl = BASE.replace(/\/+$/, '');

  // 1) Credential/endpoint check
  const urlPropfind = joinUrl(baseUrl, '/');
  console.log('PROPFIND', urlPropfind);
  const resPropfind = await request(urlPropfind, {
    method: 'PROPFIND',
    headers: {
      Authorization: auth,
      Depth: '0',
    },
  });
  console.log('PROPFIND status:', resPropfind.status);
  if (resPropfind.status === 401 || resPropfind.status === 403) {
    fail('Auth fehlgeschlagen (401/403). Prüfe Username/Passwort/ACL.');
  }
  if (resPropfind.status >= 400) {
    const txt = await resPropfind.text().catch(() => '');
    fail(`PROPFIND fehlgeschlagen: ${resPropfind.status} ${txt.slice(0, 300)}`);
  }

  // 2) GET file
  const urlGet = joinUrl(baseUrl, path);
  console.log('GET', urlGet);
  const resGet = await request(urlGet, {
    method: 'GET',
    headers: {
      Authorization: auth,
    },
  });
  console.log('GET status:', resGet.status);
  if (resGet.status >= 400) {
    const txt = await resGet.text().catch(() => '');
    fail(`GET fehlgeschlagen: ${resGet.status} ${txt.slice(0, 300)}`);
  }

  const buf = Buffer.from(await resGet.arrayBuffer());
  console.log('Content-Length:', buf.length);
  console.log('Content-Type:', resGet.headers.get('content-type'));
  console.log('OK');
}

main().catch((err) => {
  console.error('Fehler:', err?.message || err);
  process.exit(1);
});
