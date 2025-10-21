// server.js
const express = require('express');
const fetch = require('node-fetch');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

/* ===============================
   ✅ 安全性チェック
================================ */
function isAllowed(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (
      host.includes('localhost') ||
      host.startsWith('127.') ||
      host.startsWith('::1')
    ) return false;
    return true;
  } catch {
    return false;
  }
}

/* ===============================
   🏠 トップページ
================================ */
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <meta charset="utf-8">
        <title>Web Mirror</title>
        <style>
          body { font-family: sans-serif; padding: 30px; background: #f8f8f8; color: #222; }
          input { width: 70%; padding: 8px; border-radius: 6px; border: 1px solid #ccc; }
          button { padding: 8px 16px; border-radius: 6px; border: none; background: #0078ff; color: white; cursor: pointer; }
          button:hover { background: #005fcc; }
          footer { margin-top: 40px; font-size: 12px; color: #777; }
        </style>
      </head>
      <body>
        <h2>🔍 Web Mirror (Light β)</h2>
        <form action="/view" method="get">
          <input name="url" placeholder="https://example.com" />
          <button>表示</button>
        </form>
        <footer>
          &copy; 2025 mer0w0. All rights reserved.
        </footer>
      </body>
    </html>
  `);
});

/* ===============================
   🌐 コンテンツ表示ルート
================================ */
app.get('/view', async (req, res) => {
  const target = req.query.url;
  if (!target || !isAllowed(target)) {
    return res.status(400).send('無効なURLです。');
  }

  try {
    const response = await fetch(target, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; WebMirror/1.0)',
        'accept-language': 'ja,en;q=0.9'
      }
    });

    const contentType = response.headers.get('content-type') || '';

    // HTML以外はそのまま返す
    if (!contentType.includes('text/html')) {
      res.setHeader('content-type', contentType);
      return response.body.pipe(res);
    }

    // HTML変換開始
    let html = await response.text();
    const base = response.url || target;

    // URL書き換え関数
    const rewriteUrl = (match, p1) => {
      try {
        // URLにクォートなど混じってたら除去
        const clean = p1.replace(/['"]/g, '').trim();
        const resolved = new URL(clean, base).toString();
        const proxied = `/view?url=${encodeURIComponent(resolved)}`;
        return match.replace(p1, proxied);
      } catch {
        return match;
      }
    };

    // HTML内の主要タグ・CSS url() をすべて書き換え
    const patterns = [
      /<a\s+[^>]*href=["']([^"']+)["']/gi,
      /<img\s+[^>]*src=["']([^"']+)["']/gi,
      /<script\s+[^>]*src=["']([^"']+)["']/gi,
      /<link\s+[^>]*href=["']([^"']+)["']/gi,
      /<iframe\s+[^>]*src=["']([^"']+)["']/gi,
      /<video\s+[^>]*src=["']([^"']+)["']/gi,
      /<audio\s+[^>]*src=["']([^"']+)["']/gi,
      /<source\s+[^>]*src=["']([^"']+)["']/gi,
      /url\((['"]?)([^'")]+)\1\)/gi
    ];

    patterns.forEach(pat => {
      html = html.replace(pat, rewriteUrl);
    });

    // <base>タグを削除してリダイレクト誤動作防止
    html = html.replace(/<base[^>]*>/gi, '');

    // セキュリティヘッダー追加
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('x-powered-by', 'WebMirror Light');

    res.send(html);
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).send('ページの読み込みに失敗しました。');
  }
});

/* ===============================
   🚀 サーバー起動
================================ */
app.listen(PORT, () => {
  console.log(`✅ WebMirror running on http://localhost:${PORT}`);
});
