const ALLANIME_API = 'https://api.allanime.day/api';
const ALLANIME_REFR = 'https://allmanga.to';
const ALLANIME_BASE = 'allanime.day';
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0';

const HEX_MAP = {
  '79':'A','7a':'B','7b':'C','7c':'D','7d':'E','7e':'F','7f':'G',
  '70':'H','71':'I','72':'J','73':'K','74':'L','75':'M','76':'N','77':'O',
  '68':'P','69':'Q','6a':'R','6b':'S','6c':'T','6d':'U','6e':'V','6f':'W',
  '60':'X','61':'Y','62':'Z',
  '59':'a','5a':'b','5b':'c','5c':'d','5d':'e','5e':'f','5f':'g',
  '50':'h','51':'i','52':'j','53':'k','54':'l','55':'m','56':'n','57':'o',
  '48':'p','49':'q','4a':'r','4b':'s','4c':'t','4d':'u','4e':'v','4f':'w',
  '40':'x','41':'y','42':'z',
  '08':'0','09':'1','0a':'2','0b':'3','0c':'4','0d':'5','0e':'6','0f':'7',
  '00':'8','01':'9',
  '15':'-','16':'.','67':'_','46':'~',
  '02':':','17':'/','07':'?','1b':'#','63':'[','65':']','78':'@',
  '19':'!','1c':'$','1e':'&','10':'(','11':')','12':'*','13':'+','14':',',
  '03':';','05':'=','1d':'%',
};

const SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;

const EPISODES_GQL = `query($showId:String!){show(_id:$showId){_id availableEpisodesDetail}}`;

const EPISODE_EMBED_GQL = `query($showId:String!,$translationType:VaildTranslationTypeEnumType!,$episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;

const PROVIDER_PATTERNS = [
  { name: 'wixmp', pattern: 'Default :' },
  { name: 'youtube', pattern: 'Yt-mp4 :' },
  { name: 'sharepoint', pattern: 'S-mp4 :' },
  { name: 'hianime', pattern: 'Luf-Mp4 :' },
];

let cachedKey = null;

async function getDecryptionKey() {
  if (cachedKey) return cachedKey;
  const encoder = new TextEncoder();
  const data = encoder.encode('Xot36i3lK3:v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  cachedKey = new Uint8Array(hash);
  return cachedKey;
}

function decodeHex(hexStr) {
  const pairs = hexStr.match(/.{1,2}/g) || [];
  let decoded = pairs.map(p => HEX_MAP[p.toLowerCase()] || '').join('');
  decoded = decoded.replace('/clock', '/clock.json');
  return decoded;
}

async function gqlRequest(query, variables) {
  const res = await fetch(ALLANIME_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': ALLANIME_REFR,
      'User-Agent': AGENT,
    },
    body: JSON.stringify({ variables, query }),
  });
  if (!res.ok) throw new Error(`AllAnime API error: ${res.status}`);
  return res.json();
}

export async function searchAnime(title, mode = 'sub') {
  const data = await gqlRequest(SEARCH_GQL, {
    search: { allowAdult: false, allowUnknown: false, query: title },
    limit: 40,
    page: 1,
    translationType: mode,
    countryOrigin: 'ALL',
  });
  return (data?.data?.shows?.edges || []).map(e => ({
    id: e._id,
    name: e.name,
    episodes: e.availableEpisodes,
  }));
}

export async function getEpisodeList(showId, mode = 'sub') {
  const data = await gqlRequest(EPISODES_GQL, { showId });
  const detail = data?.data?.show?.availableEpisodesDetail;
  if (!detail || !detail[mode]) return [];
  return detail[mode].map(Number).sort((a, b) => a - b);
}

async function decryptTobeparsed(blob) {
  const key = await getDecryptionKey();
  const raw = Uint8Array.from(atob(blob), c => c.charCodeAt(0));

  const iv = raw.slice(1, 13);
  const ciphertext = raw.slice(13, raw.length - 16);

  const ctrIv = new Uint8Array(16);
  ctrIv.set(iv, 0);
  ctrIv[15] = 2;

  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'AES-CTR' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: ctrIv, length: 32 },
    cryptoKey,
    ciphertext,
  );

  const plain = new TextDecoder().decode(decrypted);
  const results = [];
  const regex = /"sourceUrl":"--([^"]*)"[^}]*"sourceName":"([^"]*)"/g;
  let match;
  while ((match = regex.exec(plain)) !== null) {
    results.push({ name: match[2], encoded: match[1] });
  }
  return results;
}

async function getEpisodeSourceUrls(showId, episode, mode = 'sub') {
  const data = await gqlRequest(EPISODE_EMBED_GQL, {
    showId,
    translationType: mode,
    episodeString: String(episode),
  });

  const raw = JSON.stringify(data);

  if (raw.includes('"tobeparsed"')) {
    const blobMatch = raw.match(/"tobeparsed":"([^"]*)"/);
    if (blobMatch) {
      return decryptTobeparsed(blobMatch[1]);
    }
  }

  const results = [];
  const sourceUrls = data?.data?.episode?.sourceUrls || [];
  for (const src of sourceUrls) {
    if (src.sourceUrl && src.sourceUrl.startsWith('--')) {
      results.push({
        name: src.sourceName || 'unknown',
        encoded: src.sourceUrl.slice(2),
      });
    }
  }
  return results;
}

async function fetchProviderLinks(providerPath) {
  const url = `https://${ALLANIME_BASE}${providerPath}`;
  const res = await fetch(url, {
    headers: { 'Referer': ALLANIME_REFR, 'User-Agent': AGENT },
  });
  if (!res.ok) return [];
  const text = await res.text();

  const sources = [];

  if (text.includes('repackager.wixmp.com')) {
    const regex = /"link":"([^"]*)","resolutionStr":"([^"]*)"/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      sources.push({ url: m[1], quality: m[2] });
    }
    sources.sort((a, b) => {
      const aNum = parseInt(a.quality) || 0;
      const bNum = parseInt(b.quality) || 0;
      return bNum - aNum;
    });
  } else if (text.includes('master.m3u8') || text.includes('.m3u8')) {
    const hlsMatch = text.match(/"hls"[^}]*"url":"([^"]*)"/);
    if (hlsMatch) {
      const m3u8Url = hlsMatch[1];
      const refrMatch = text.match(/"Referer":"([^"]*)"/);
      sources.push({
        url: m3u8Url,
        quality: 'adaptive',
        referer: refrMatch ? refrMatch[1] : null,
      });
    }
  } else {
    const regex = /"link":"([^"]*)"/g;
    let m;
    while ((m = regex.exec(text)) !== null) {
      sources.push({ url: m[1], quality: 'default' });
    }
  }

  return sources;
}

function resolveProvider(sourceUrls, patternName) {
  for (const src of sourceUrls) {
    if (src.name === patternName || src.encoded.includes(patternName.split(' ')[0])) {
      return decodeHex(src.encoded);
    }
  }

  for (const src of sourceUrls) {
    const decoded = decodeHex(src.encoded);
    for (const p of PROVIDER_PATTERNS) {
      if (p.name === patternName && decoded.startsWith('/')) {
        return decoded;
      }
    }
  }
  return null;
}

export async function getStreamSources(title, episode, mode = 'sub') {
  const results = await searchAnime(title, mode);
  if (results.length === 0) return [];

  const show = results[0];
  const sourceUrls = await getEpisodeSourceUrls(show.id, episode, mode);
  if (sourceUrls.length === 0) return [];

  const allSources = [];

  const providerPromises = sourceUrls.map(async (src) => {
    try {
      const decoded = decodeHex(src.encoded);
      if (!decoded || !decoded.startsWith('/')) return;
      const links = await fetchProviderLinks(decoded);
      for (const link of links) {
        allSources.push({
          url: link.url,
          quality: link.quality,
          provider: src.name,
          referer: link.referer || null,
        });
      }
    } catch {
      // skip failed providers
    }
  });

  await Promise.all(providerPromises);

  allSources.sort((a, b) => {
    const aNum = parseInt(a.quality) || 0;
    const bNum = parseInt(b.quality) || 0;
    return bNum - aNum;
  });

  return allSources;
}
