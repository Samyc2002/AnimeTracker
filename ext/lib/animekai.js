const BASE_URL = 'https://animekai.to';
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0';
const DECODE_URL = 'https://raw.githubusercontent.com/sdaqo/anipy-cli/refs/heads/key-gen/scripts/decoder/generated/kai.json';

let cachedDecoders = null;

async function fetchDecoders() {
  if (cachedDecoders) return cachedDecoders;
  const res = await fetch(DECODE_URL, { headers: { 'User-Agent': AGENT } });
  cachedDecoders = await res.json();
  return cachedDecoders;
}

function reverseIt(n) {
  return n.split('').reverse().join('');
}

function substitute(input, keys, values) {
  const map = {};
  for (let i = 0; i < keys.length; i++) {
    map[keys[i]] = values[i];
  }
  return input.split('').map(c => map[c] || c).join('');
}

function rc4Transform(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let i = 0;
  j = 0;
  const result = [];
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    result.push(data.charCodeAt(k) ^ s[(s[i] + s[j]) & 255]);
  }
  return String.fromCharCode(...result);
}

function base64UrlEncode(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return atob(s);
}

function strictEncode(n, ops) {
  const opsArr = ops.split(';');
  const result = [];
  for (let i = 0; i < n.length; i++) {
    const code = n.charCodeAt(i);
    const op = opsArr[i % opsArr.length];
    const transformed = evalOp(op, code);
    result.push(transformed & 255);
  }
  let b64 = btoa(String.fromCharCode(...result));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strictDecode(n, ops) {
  const opsArr = ops.split(';');
  let padded = n.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  const raw = atob(padded);
  const result = [];
  for (let i = 0; i < raw.length; i++) {
    const b = raw.charCodeAt(i);
    const op = opsArr[i % opsArr.length];
    const transformed = evalOp(op, b);
    result.push(transformed & 255);
  }
  return String.fromCharCode(...result);
}

function evalOp(expr, n) {
  expr = expr.trim();
  if (expr === '~n & 255') return (~n) & 255;
  if (expr === 'n ^ 217') return n ^ 217;
  if (expr === 'n ^ 70') return n ^ 70;
  if (expr === 'n ^ 147') return n ^ 147;
  if (expr === 'n ^ 222') return n ^ 222;

  let m;

  m = expr.match(/^\(n \+ (\d+)\) % 256$/);
  if (m) return (n + parseInt(m[1])) % 256;

  m = expr.match(/^\(n - (\d+) \+ 256\) % 256$/);
  if (m) return (n - parseInt(m[1]) + 256) % 256;

  m = expr.match(/^n \^ (\d+)$/);
  if (m) return n ^ parseInt(m[1]);

  m = expr.match(/^\(n << 4 \| \(n & 0xFF\) >> 4\) & 255$/);
  if (m) return ((n << 4) | ((n & 0xFF) >> 4)) & 255;

  m = expr.match(/^\(\(n & 0xFF\) >> 4 \| n << 4\) & 255$/);
  if (m) return (((n & 0xFF) >> 4) | (n << 4)) & 255;

  throw new Error(`Unsupported op: ${expr}`);
}

function safeEval(expression, n) {
  const funcs = {
    transform: rc4Transform,
    base64_url_encode: base64UrlEncode,
    base64_url_decode: base64UrlDecode,
    reverse_it: reverseIt,
    substitute,
    strict_decode: strictDecode,
    strict_encode: strictEncode,
  };

  let expr = expression;
  let maxIter = 50;
  while (maxIter-- > 0) {
    const funcMatch = expr.match(/(\w+)\(([^()]*)\)/);
    if (!funcMatch) break;

    const [fullMatch, funcName, argsStr] = funcMatch;
    const func = funcs[funcName];
    if (!func) throw new Error(`Unknown function: ${funcName}`);

    const args = parseArgs(argsStr, n);
    const result = func(...args);
    n = result;
    expr = expr.replace(fullMatch, 'n');
  }
  return n;
}

function parseArgs(argsStr, n) {
  const args = [];
  let depth = 0;
  let current = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr[i];
    if (inString) {
      current += c;
      if (c === stringChar) inString = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      current += c;
      continue;
    }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += c;
  }
  if (current.trim()) args.push(current.trim());

  return args.map(a => {
    if (a === 'n') return n;
    if ((a.startsWith('"') && a.endsWith('"')) || (a.startsWith("'") && a.endsWith("'"))) {
      return a.slice(1, -1);
    }
    return a;
  });
}

async function generateToken(id) {
  const decoders = await fetchDecoders();
  return safeEval(decoders.generate_token, id);
}

async function decodeIframeData(data) {
  const decoders = await fetchDecoders();
  const decoded = safeEval(decoders.decode_iframe_data, data);
  return decodeURIComponent(decoded);
}

async function decodeResult(data) {
  const decoders = await fetchDecoders();
  const decoded = safeEval(decoders.decode, data);
  return decodeURIComponent(decoded);
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': AGENT, 'Referer': BASE_URL },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': AGENT, 'Referer': BASE_URL },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

function matchAll(html, regex) {
  const results = [];
  let m;
  while ((m = regex.exec(html)) !== null) results.push(m);
  return results;
}

function getAttr(html, attr) {
  const m = html.match(new RegExp(`${attr}=["']([^"']*)["']`));
  return m ? m[1] : null;
}

export async function searchAnime(query) {
  const url = `${BASE_URL}/browser?keyword=${encodeURIComponent(query)}`;
  const html = await fetchPage(url);
  const items = matchAll(html, /<div class="aitem"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g);
  return items.map(([block]) => {
    const hrefMatch = block.match(/href="([^"]*\/[^"]*)"/);
    const href = hrefMatch ? hrefMatch[1] : '';
    const identifier = href.split('/').pop();
    const titleMatch = block.match(/<a[^>]*class="title"[^>]*title="([^"]*)"/);
    const name = titleMatch ? titleMatch[1] : '';
    const hasDub = /class="dub"/.test(block);
    return { identifier, name, hasDub };
  });
}

export async function getEpisodes(identifier, lang = 'sub') {
  const watchHtml = await fetchPage(`${BASE_URL}/watch/${identifier}`);
  const aniIdMatch = watchHtml.match(/class="rate-box"[^>]*data-id="([^"]*)"/);
  if (!aniIdMatch) throw new Error('Could not find ani_id');
  const aniId = aniIdMatch[1];

  const token = await generateToken(aniId);
  const epUrl = `${BASE_URL}/ajax/episodes/list?ani_id=${encodeURIComponent(aniId)}&_=${encodeURIComponent(token)}`;
  const epJson = await fetchJson(epUrl);

  const langMap = { '1': ['sub'], '3': ['sub', 'dub'] };
  const episodes = [];
  const epMatches = matchAll(epJson.result, /<a[^>]*\bnum="([^"]*)"[^>]*\blangs="([^"]*)"[^>]*\btoken="([^"]*)"/g);
  for (const m of epMatches) {
    const [, num, langs, epToken] = m;
    if (num && langs && (langMap[langs] || []).includes(lang)) {
      episodes.push({ num: parseFloat(num), token: epToken });
    }
  }
  return episodes.sort((a, b) => a.num - b.num);
}

export async function getStreamSources(title, episode, mode = 'sub') {
  const results = await searchAnime(title);
  if (results.length === 0) return [];

  const anime = results[0];
  const episodes = await getEpisodes(anime.identifier, mode);
  const ep = episodes.find(e => e.num === episode);
  if (!ep || !ep.token) return [];

  const token = await generateToken(ep.token);
  const linksUrl = `${BASE_URL}/ajax/links/list?token=${encodeURIComponent(ep.token)}&_=${encodeURIComponent(token)}`;
  const linksJson = await fetchJson(linksUrl);

  const langIds = mode === 'dub' ? ['dub', 'softdub'] : ['sub', 'softsub'];
  const serverIds = [];

  for (const langId of langIds) {
    const sectionRegex = new RegExp(
      `<div[^>]*class="server-items[^"]*"[^>]*data-id="${langId}"[^>]*>([\\s\\S]*?)</div>`,
    );
    const sectionMatch = linksJson.result.match(sectionRegex);
    if (!sectionMatch) continue;
    const lidMatches = matchAll(sectionMatch[1], /data-lid="([^"]*)"/g);
    for (const m of lidMatches) {
      serverIds.push(m[1]);
    }
  }

  const allSources = [];

  for (const id of serverIds) {
    try {
      const viewToken = await generateToken(id);
      const viewUrl = `${BASE_URL}/ajax/links/view?id=${encodeURIComponent(id)}&_=${encodeURIComponent(viewToken)}`;
      const viewJson = await fetchJson(viewUrl);

      const iframeData = JSON.parse(await decodeIframeData(viewJson.result));
      const megaUrl = iframeData.url.replace(/\/(e|e2)\//, '/media/');

      const mediaJson = await fetchJson(megaUrl);
      const decoded = JSON.parse(await decodeResult(mediaJson.result));

      const sourceFile = decoded.sources?.[0]?.file;
      if (!sourceFile) continue;

      const subtitles = (decoded.tracks || [])
        .filter(t => t.kind === 'captions')
        .map(t => ({ url: t.file, lang: t.label, label: t.label }));

      const m3u8Res = await fetch(sourceFile, {
        headers: { 'User-Agent': AGENT, 'Referer': BASE_URL },
      });
      if (!m3u8Res.ok) {
        allSources.push({ url: sourceFile, quality: '1080p', subtitles });
        continue;
      }

      const m3u8Text = await m3u8Res.text();
      const baseUri = sourceFile.substring(0, sourceFile.lastIndexOf('/') + 1);

      const streamMatches = [...m3u8Text.matchAll(/RESOLUTION=\d+x(\d+)[^\n]*\n([^\n]+)/g)];
      if (streamMatches.length === 0) {
        allSources.push({ url: sourceFile, quality: 'adaptive', subtitles });
      } else {
        for (const match of streamMatches) {
          const resolution = match[1];
          let streamUrl = match[2].trim();
          if (!streamUrl.startsWith('http')) {
            streamUrl = baseUri + streamUrl;
          }
          allSources.push({ url: streamUrl, quality: `${resolution}p`, subtitles });
        }
      }

      if (allSources.length > 0) break;
    } catch (err) {
      console.error('[AnimeKai] Server failed:', id, err.message);
    }
  }

  allSources.sort((a, b) => {
    const aNum = parseInt(a.quality) || 0;
    const bNum = parseInt(b.quality) || 0;
    return bNum - aNum;
  });

  return allSources;
}
