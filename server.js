const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

const {
  LINE_CHANNEL_ID,
  LINE_CHANNEL_SECRET,
  LINE_CALLBACK_URL,
  ADMIN_LINE_USER_IDS = '',
  SESSION_SECRET,
  NODE_ENV = 'development',
  PORT = 3000,
} = process.env;

const ADMIN_IDS = ADMIN_LINE_USER_IDS.split(',').map(s => s.trim()).filter(Boolean);
const IS_PROD = NODE_ENV === 'production';

if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET || !LINE_CALLBACK_URL || !SESSION_SECRET) {
  console.warn('[warn] 缺少必要環境變數，LINE 登入功能無法使用');
  console.warn('需要：LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, LINE_CALLBACK_URL, SESSION_SECRET');
}

const app = express();
app.use(cookieParser());

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: IS_PROD,
  path: '/',
};

app.get('/auth/line/login', (req, res) => {
  if (!LINE_CHANNEL_ID) return res.status(500).send('伺服器未設定 LINE Channel');
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { ...COOKIE_OPTS, maxAge: 10 * 60 * 1000 });
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_CHANNEL_ID,
    redirect_uri: LINE_CALLBACK_URL,
    state,
    scope: 'profile openid',
  });
  res.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`);
});

app.get('/auth/line/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`LINE 授權失敗：${error}`);

  const expected = req.cookies.oauth_state;
  if (!state || !expected || state !== expected) {
    return res.status(400).send('State 驗證失敗，請重新登入');
  }
  res.clearCookie('oauth_state', COOKIE_OPTS);

  try {
    const tokenResp = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINE_CALLBACK_URL,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      throw new Error(`token exchange failed: ${t}`);
    }
    const tokens = await tokenResp.json();

    const profResp = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profResp.ok) throw new Error('profile fetch failed');
    const profile = await profResp.json();

    const isAdmin = ADMIN_IDS.includes(profile.userId);
    if (!isAdmin) {
      return res.status(403).send(`
        <!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>登入失敗</title>
        <style>body{font-family:-apple-system,sans-serif;background:#f5f6f8;text-align:center;padding:60px 20px;}
        .box{background:#fff;max-width:400px;margin:0 auto;padding:30px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);}
        h2{color:#dc2626;margin:0 0 16px;}a{color:#2563eb;}</style>
        </head><body><div class="box">
        <h2>⚠️ 非管理員帳號</h2>
        <p>您的 LINE 帳號「${escapeHtml(profile.displayName)}」未被授權使用管理員功能。</p>
        <p><a href="/">回首頁</a></p>
        </div></body></html>
      `);
    }

    const token = jwt.sign(
      { sub: profile.userId, name: profile.displayName, admin: true },
      SESSION_SECRET,
      { expiresIn: '30d' }
    );
    res.cookie('session', token, {
      ...COOKIE_OPTS,
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    res.redirect('/');
  } catch (e) {
    console.error('[callback error]', e);
    res.status(500).send('登入處理失敗，請稍後再試');
  }
});

app.get('/auth/logout', (req, res) => {
  res.clearCookie('session', COOKIE_OPTS);
  res.redirect('/');
});

app.get('/api/me', (req, res) => {
  const token = req.cookies.session;
  if (!token) return res.json({ isAdmin: false });
  try {
    const payload = jwt.verify(token, SESSION_SECRET);
    res.json({ isAdmin: !!payload.admin, name: payload.name || null });
  } catch {
    res.json({ isAdmin: false });
  }
});

app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  index: 'index.html',
}));

app.listen(PORT, () => {
  console.log(`[server] listening on :${PORT} (${IS_PROD ? 'production' : 'development'})`);
  console.log(`[server] admin whitelist: ${ADMIN_IDS.length} id(s)`);
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}
