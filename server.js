// server.js
const express = require('express');
const fetch = require('node-fetch'); // Node18+なら不要
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全チェック（localhost/プライベートIPを避ける）
function isAllowed(raw) {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host.includes('localhost') || host.startsWith('127.') || host.startsWith('::1')) return false;
    return true;
  } catch {
    return false;
  }
}

// 起点ページ
app.get('/', (req, res) => {
  res.send(`
    <html><head><meta charset="utf-8"><title>Web Mirror</title></head>
    <body style="font-family:sans-serif; padding:20px;">
      <h2>🔄 Web Mirror (軽量版)</h2>
      <form action="/view" method="get">
        <input name="url" style="width:60%;" placeholder="https://example.com" />
        <button>表示</button>
      </form>
    </body></html>
  `);
});

// 表示ルート
app.get('/view', async (req, res) => {
  const target = req.query.url;
  if (!target || !isAllowed(target)) return res.status(400).send('無効なURLです。');

  try {
    const response = await fetch(target);
    const contentType = response.headers.get('content-type') || '';

    // HTML以外はストリームでそのまま返す
    if (!contentType.includes('text/html')) {
      res.setHeader('content-type', contentType);
      response.body.pipe(res);
      return;
    }

    // HTMLは軽量置換でリンク/画像を書き換え
    let html = await response.text();
    const base = response.url || target;

    const rewriteUrl = (match, p1) => {
      try {
        const resolved = new URL(p1, base).toString();
        return match.replace(p1, `/view?url=${encodeURIComponent(resolved)}`);
      } catch {
        return match;
      }
    };

    // <a href=""> と <img src=""> と <script src=""> と <link href=""> を軽量置換
    html = html.replace(/<a\s+[^>]*href="([^"]*)"/gi, rewriteUrl);
    html = html.replace(/<img\s+[^>]*src="([^"]*)"/gi, rewriteUrl);
    html = html.replace(/<script\s+[^>]*src="([^"]*)"/gi, rewriteUrl);
    html = html.replace(/<link\s+[^>]*href="([^"]*)"/gi, rewriteUrl);

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send('読み込み中にエラーが発生しました。');
  }
});

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
