const express = require('express');
const fetch = require('node-fetch');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全チェック
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

// トップページ
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><meta charset="utf-8"><title>Web Mirror (常時Proxy)</title></head>
      <body style="font-family:sans-serif; padding:20px;">
        <h2>🔄 Web Mirror (常時Proxy・軽量版)</h2>
        <form action="/view" method="get">
          <input name="url" style="width:60%;" placeholder="https://example.com" />
          <button>表示</button>
        </form>
        <p>リンクは常に proxy 経由になります。</p>
      </body>
    </html>
  `);
});

// 表示ルート
app.get('/view', async (req, res) => {
  const target = req.query.url;
  if (!target || !isAllowed(target)) return res.status(400).send('無効なURLです。');

  try {
    const response = await fetch(target);
    const contentType = response.headers.get('content-type') || '';

    // HTML以外はそのままストリームで返す
    if (!contentType.includes('text/html')) {
      res.setHeader('content-type', contentType);
      return response.body.pipe(res);
    }

    let html = await response.text();
    const base = response.url || target;

    // 常に /view?url=… に書き換える
    const rewriteUrl = (match, p1) => {
      try {
        const resolved = new URL(p1, base).toString();
        return match.replace(p1, `/view?url=${encodeURIComponent(resolved)}`);
      } catch { return match; }
    };

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
