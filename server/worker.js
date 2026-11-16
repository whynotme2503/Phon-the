/* Máy chủ tài khoản và đồng bộ tiến độ cho "Huyen Dieu học Phồn".
   Chạy trên Cloudflare Worker, dữ liệu nằm trong Cloudflare D1.
   Cách dựng: xem server/HUONG-DAN.md.

   Cần khai báo trong Worker:
     - Biến bí mật ADMIN_KEY     : mật khẩu trang quản trị của giáo viên
     - Biến bí mật TOKEN_SECRET  : chuỗi ngẫu nhiên dài, dùng để ký phiên đăng nhập
     - Liên kết D1 tên DB        : cơ sở dữ liệu đã chạy schema.sql
*/

const DAY = 86400000;
const TOKEN_DAYS = 180;
/* Bỏ các chữ dễ đọc lẫn: 0 O, 1 I L, 2 Z, 5 S, 8 B */
const AB = '34679ACDEFGHJKMNPQRTUVWXY';
const JSON_LIMIT = 400000; /* chặn tiến độ phình to bất thường */

/* ===== tiện ích ===== */
const te = new TextEncoder();
const j = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json;charset=utf-8', ...CORS } });
const bad = (m, s = 400) => j({ error: m }, s);
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-admin-key',
  'access-control-max-age': '86400',
};
const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return a };
const pick = n => [...rand(n)].map(x => AB[x % AB.length]).join('');
const newCode = () => 'HP-' + pick(4) + '-' + pick(4);
const newPw = () => pick(4) + '-' + pick(4);
const dayStr = t => new Date(t).toISOString().slice(0, 10);
/* so sánh không rò thời gian */
function eqSafe(a, b) {
  const x = te.encode(String(a)), y = te.encode(String(b));
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

/* ===== mật khẩu: PBKDF2-SHA256 ===== */
async function hashPw(pw, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) : rand(16);
  const key = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { hash: b64u(bits), salt: b64u(salt) };
}

/* ===== phiên đăng nhập: token tự chứa, không cần lưu ===== */
async function sign(secret, data) {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64u(await crypto.subtle.sign('HMAC', key, te.encode(data)));
}
async function mkToken(env, code) {
  const exp = Date.now() + TOKEN_DAYS * DAY, body = code + '.' + exp;
  return body + '.' + await sign(env.TOKEN_SECRET, body);
}
async function readToken(env, req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const i = t.lastIndexOf('.');
  if (i < 0) return null;
  const body = t.slice(0, i), sig = t.slice(i + 1);
  if (!eqSafe(sig, await sign(env.TOKEN_SECRET, body))) return null;
  const k = body.lastIndexOf('.');
  const code = body.slice(0, k), exp = +body.slice(k + 1);
  if (!code || !(exp > Date.now())) return null;
  return code;
}

/* ===== các tuyến ===== */
async function login(env, req) {
  const b = await req.json().catch(() => null);
  if (!b) return bad('Dữ liệu không đọc được');
  const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
  const pw = String(b.pw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code || !pw) return bad('Thiếu mã hoặc mật khẩu');
  const r = await env.DB.prepare('SELECT code,name,pw_hash,pw_salt,active,fails,fail_at FROM accounts WHERE code=?').bind(code).first();
  /* vẫn băm một lần khi không có mã, để thời gian trả lời không tiết lộ mã nào tồn tại */
  if (!r) { await hashPw(pw, null); return bad('Mã hoặc mật khẩu không đúng', 401) }
  if (!r.active) return bad('Tài khoản này đã bị tạm dừng. Nhắn giáo viên để mở lại.', 403);
  const now = Date.now();
  if (r.fails >= 20 && now - r.fail_at < 3600000) return bad('Sai quá nhiều lần, thử lại sau một giờ.', 429);
  const { hash } = await hashPw(pw, r.pw_salt);
  if (!eqSafe(hash, r.pw_hash)) {
    const n = now - r.fail_at > 3600000 ? 1 : r.fails + 1;
    await env.DB.prepare('UPDATE accounts SET fails=?,fail_at=? WHERE code=?').bind(n, now, code).run();
    return bad('Mã hoặc mật khẩu không đúng', 401);
  }
  const day = dayStr(now);
  await env.DB.batch([
    env.DB.prepare('UPDATE accounts SET last_seen=?,visits=visits+1,fails=0 WHERE code=?').bind(now, code),
    env.DB.prepare('INSERT INTO visit_log(code,day,n) VALUES(?,?,1) ON CONFLICT(code,day) DO UPDATE SET n=n+1').bind(code, day),
  ]);
  return j({ token: await mkToken(env, code), code, name: r.name });
}

async function getProgress(env, code) {
  const r = await env.DB.prepare('SELECT json,t FROM progress WHERE code=?').bind(code).first();
  return j(r ? { json: r.json, t: r.t } : { json: null, t: 0 });
}

async function putProgress(env, req, code) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b.json !== 'string') return bad('Dữ liệu không đọc được');
  if (b.json.length > JSON_LIMIT) return bad('Tiến độ quá lớn', 413);
  const t = +b.t || Date.now(), now = Date.now();
  /* chỉ ghi khi bản gửi lên mới hơn bản đang có, tránh máy cũ ghi đè máy mới */
  const cur = await env.DB.prepare('SELECT t FROM progress WHERE code=?').bind(code).first();
  if (cur && cur.t > t) return j({ ok: false, stale: true, t: cur.t });
  await env.DB.prepare(
    'INSERT INTO progress(code,json,t,words,days,updated) VALUES(?,?,?,?,?,?) ' +
    'ON CONFLICT(code) DO UPDATE SET json=excluded.json,t=excluded.t,words=excluded.words,days=excluded.days,updated=excluded.updated'
  ).bind(code, b.json, t, +b.words || 0, +b.days || 0, now).run();
  return j({ ok: true, t });
}

/* đếm lượt truy cập, mỗi tài khoản nhiều nhất một lượt trong 6 giờ */
async function ping(env, code) {
  const now = Date.now();
  const r = await env.DB.prepare('SELECT last_seen FROM accounts WHERE code=?').bind(code).first();
  if (!r) return bad('Tài khoản không còn', 401);
  if (now - r.last_seen < 6 * 3600000) {
    await env.DB.prepare('UPDATE accounts SET last_seen=? WHERE code=?').bind(now, code).run();
    return j({ ok: true, counted: false });
  }
  await env.DB.batch([
    env.DB.prepare('UPDATE accounts SET last_seen=?,visits=visits+1 WHERE code=?').bind(now, code),
    env.DB.prepare('INSERT INTO visit_log(code,day,n) VALUES(?,?,1) ON CONFLICT(code,day) DO UPDATE SET n=n+1').bind(code, dayStr(now)),
  ]);
  return j({ ok: true, counted: true });
}

/* ===== quản trị ===== */
async function admin(env, req, path) {
  if (!env.ADMIN_KEY) return bad('Máy chủ chưa đặt ADMIN_KEY', 500);
  if (!eqSafe(req.headers.get('x-admin-key') || '', env.ADMIN_KEY)) return bad('Sai mật khẩu quản trị', 401);
  const body = req.method === 'GET' ? {} : (await req.json().catch(() => ({})));
  const now = Date.now();

  if (path === 'stats') {
    const a = await env.DB.prepare('SELECT COUNT(*) n, SUM(visits) v, SUM(active) act FROM accounts').first();
    const d7 = await env.DB.prepare('SELECT COUNT(DISTINCT code) n FROM visit_log WHERE day>=?').bind(dayStr(now - 7 * DAY)).first();
    const today = await env.DB.prepare('SELECT SUM(n) n FROM visit_log WHERE day=?').bind(dayStr(now)).first();
    const byDay = await env.DB.prepare('SELECT day, SUM(n) n, COUNT(DISTINCT code) u FROM visit_log WHERE day>=? GROUP BY day ORDER BY day').bind(dayStr(now - 29 * DAY)).all();
    return j({
      accounts: a.n || 0, active: a.act || 0, visits: a.v || 0,
      visitsToday: today.n || 0, usersWeek: d7.n || 0, byDay: byDay.results || [],
    });
  }

  if (path === 'list') {
    const r = await env.DB.prepare(
      'SELECT a.code,a.name,a.note,a.created,a.last_seen,a.visits,a.active,' +
      'p.t progress_t,p.words,p.days,LENGTH(p.json) size ' +
      'FROM accounts a LEFT JOIN progress p ON p.code=a.code ORDER BY a.created DESC'
    ).all();
    return j({ accounts: r.results || [] });
  }

  if (path === 'create') {
    const n = Math.min(Math.max(+body.n || 1, 1), 50);
    const names = Array.isArray(body.names) ? body.names : [];
    const out = [], stmts = [];
    for (let i = 0; i < n; i++) {
      const code = newCode(), pw = newPw(), { hash, salt } = await hashPw(pw, null);
      const name = String(names[i] || body.name || '').slice(0, 60);
      out.push({ code, pw, name });
      stmts.push(env.DB.prepare(
        'INSERT INTO accounts(code,name,pw_hash,pw_salt,created,last_seen,visits,active,note,fails,fail_at) VALUES(?,?,?,?,?,0,0,1,?,0,0)'
      ).bind(code, name, hash, salt, now, String(body.note || '').slice(0, 200)));
    }
    await env.DB.batch(stmts);
    return j({ created: out });
  }

  if (path === 'reset') {
    const code = String(body.code || '').toUpperCase();
    const pw = newPw(), { hash, salt } = await hashPw(pw, null);
    const r = await env.DB.prepare('UPDATE accounts SET pw_hash=?,pw_salt=?,fails=0 WHERE code=?').bind(hash, salt, code).run();
    if (!r.meta.changes) return bad('Không có mã này', 404);
    return j({ code, pw });
  }

  if (path === 'edit') {
    const code = String(body.code || '').toUpperCase();
    const sets = [], vals = [];
    if (body.name != null) { sets.push('name=?'); vals.push(String(body.name).slice(0, 60)) }
    if (body.note != null) { sets.push('note=?'); vals.push(String(body.note).slice(0, 200)) }
    if (body.active != null) { sets.push('active=?'); vals.push(body.active ? 1 : 0) }
    if (!sets.length) return bad('Không có gì để sửa');
    vals.push(code);
    const r = await env.DB.prepare(`UPDATE accounts SET ${sets.join(',')} WHERE code=?`).bind(...vals).run();
    if (!r.meta.changes) return bad('Không có mã này', 404);
    return j({ ok: true });
  }

  if (path === 'delete') {
    const code = String(body.code || '').toUpperCase();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM progress WHERE code=?').bind(code),
      env.DB.prepare('DELETE FROM visit_log WHERE code=?').bind(code),
      env.DB.prepare('DELETE FROM accounts WHERE code=?').bind(code),
    ]);
    return j({ ok: true });
  }

  if (path === 'progress') {
    const code = String(body.code || req.url.split('code=')[1] || '').toUpperCase();
    const r = await env.DB.prepare('SELECT json,t FROM progress WHERE code=?').bind(code).first();
    return j(r ? { json: r.json, t: r.t } : { json: null, t: 0 });
  }

  return bad('Không có tuyến này', 404);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '');
    try {
      if (p === '/api/health') return j({ ok: true, db: !!env.DB, admin: !!env.ADMIN_KEY, secret: !!env.TOKEN_SECRET });
      if (p === '/api/login' && req.method === 'POST') return login(env, req);
      if (p.startsWith('/api/admin/')) return admin(env, req, p.slice(11));

      if (p === '/api/progress' || p === '/api/ping') {
        const code = await readToken(env, req);
        if (!code) return bad('Phiên đăng nhập đã hết, đăng nhập lại', 401);
        if (p === '/api/ping') return ping(env, code);
        if (req.method === 'GET') return getProgress(env, code);
        if (req.method === 'PUT') return putProgress(env, req, code);
        return bad('Cách gọi không đúng', 405);
      }
      return bad('Không có tuyến này', 404);
    } catch (e) {
      return bad('Lỗi máy chủ: ' + (e && e.message || e), 500);
    }
  },
};
