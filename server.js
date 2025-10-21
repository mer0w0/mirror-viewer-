// server.js
const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全なURL判定（最低限）
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

// メインページ
app.get('/', (req, res) => {
  res.send(`
    <html><head><meta charset="utf-8"><title>Web Mirror</title></head>
    <body style="font-family: sans-serif; padding:20px;">
      <h2>🔍 Web Mirror</h2>
      <form action="/view" method="get">
        <input name="url" style="width:60%;" placeholder="https://example.com" />
        <button>表示</button>
      </form>
      <p>（完全個人用）</p>
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

    // HTML以外ならそのまま返す
    if (!contentType.includes('text/html')) {
      res.setHeader('content-type', contentType);
      response.body.pipe(res);
      return;
    }

    // HTMLなら書き換え処理
    const html = await response.text();
    const base = response.url || target;
    const $ = cheerio.load(html, { decodeEntities: false });

    const rewrite = (attrVal) => {
      if (!attrVal) return attrVal;
      try {
        const resolved = new URL(attrVal, base).toString();
        return `/view?url=${encodeURIComponent(resolved)}`;
      } catch {
        return attrVal;
      }
    };

    $('a[href]').each((_, el) => $(el).attr('href', rewrite($(el).attr('href'))));
    $('img[src]').each((_, el) => $(el).attr('src', rewrite($(el).attr('src'))));
    $('script[src]').each((_, el) => $(el).attr('src', rewrite($(el).attr('src'))));
    $('link[rel="stylesheet"][href]').each((_, el) => $(el).attr('href', rewrite($(el).attr('href'))));
    $('form[action]').each((_, el) => $(el).attr('action', rewrite($(el).attr('action'))));

    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.send($.html());
  } catch (err) {
    console.error(err);
    res.status(500).send('読み込み中にエラーが発生しました。');
  }
});

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
