/**
 * Foto real do modelo do carro, buscada na Wikipédia (imagens livres do Wikimedia Commons).
 * Não precisa de chave de API. A foto escolhida fica salva no veículo (photo_url).
 */

export interface PhotoCandidate {
  title: string;
  url: string;
}

/**
 * Cabeçalho exigido pela política da Wikimedia: o padrão do Android ("okhttp/...") é
 * bloqueado com 403, então toda chamada (API e imagens) se identifica como o app.
 */
const UA = 'MeuCarro/1.0 (Android; github.com/kinhoown/meu-carro)';
export const WIKI_HEADERS = { 'User-Agent': UA, 'Api-User-Agent': UA };

/** A Wikimedia só serve miniaturas em larguras padrão (800 px dá erro 400). */
const THUMB_WIDTH = '960';

/** "GM - Chevrolet" -> "Chevrolet" ; "VW - VolksWagen" -> "Volkswagen" ; "Caoa Chery/Chery" -> "Chery" */
export function normalizeBrand(brand: string): string {
  let b = brand.includes(' - ') ? brand.split(' - ').pop()! : brand;
  if (b.includes('/')) b = b.split('/').pop()!;
  b = b.replace(/^caoa\s+/i, '').trim();
  if (/^volkswagen$/i.test(b)) return 'Volkswagen';
  return b
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 3 && w !== 'kia' ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/^Bmw$/, 'BMW');
}

const TWO_WORD_FIRST = new Set(['grand', 'new', 'range', 'space', 'classe', 'serie', 'série', 'land', 'santa', 'c4', 'c3', 'up!']);
const TWO_WORD_SECOND = new Set(['plus', 'cross', 'sport', 'sw4', 'weekend', 'picasso', 'lounge', 'aircross']);

/** "Onix HATCH LT 1.0 12V" -> "Onix" ; "Corolla Cross XRE 2.0" -> "Corolla Cross" ; "COMPASS LONGITUDE" -> "Compass" */
export function modelFamily(model: string): string {
  const words = model.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
  if (!words.length) return model;
  const first = words[0];
  // "ONIX SEDAN Plus LT" -> "Onix Plus"
  const second = words.slice(1, 3).find((w) => w.toLowerCase() === 'plus') ?? words[1];
  const take =
    second && !/\d/.test(second) && (TWO_WORD_FIRST.has(first.toLowerCase()) || TWO_WORD_SECOND.has(second.toLowerCase()))
      ? [first, second]
      : [first];
  return take.map((w) => (w === w.toUpperCase() && w.length > 3 ? w[0] + w.slice(1).toLowerCase() : w)).join(' ');
}

export function photoQuery(brand: string, model: string): string {
  return `${normalizeBrand(brand)} ${modelFamily(model)}`;
}

/** Monta a query string sem URLSearchParams (incompleto no React Native). */
function qs(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

async function searchWiki(lang: 'pt' | 'en', query: string): Promise<PhotoCandidate[]> {
  const params = qs({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '10',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: THUMB_WIDTH,
  });
  const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, {
    headers: WIKI_HEADERS,
  });
  if (!res.ok) throw new Error(`Wikipédia respondeu ${res.status}`);
  const json = await res.json();
  const pages = Object.values<{ index: number; title: string; thumbnail?: { source: string } }>(json.query?.pages ?? {});
  return pages
    .sort((a, b) => a.index - b.index)
    .filter((p) => p.thumbnail?.source && !/\.svg/i.test(p.thumbnail.source) && !/logo/i.test(p.thumbnail.source))
    .map((p) => ({ title: p.title, url: p.thumbnail!.source }));
}

/**
 * Busca fotos do modelo e ordena: título igual à busca primeiro, depois títulos que contêm
 * todas as palavras, depois o resto. Páginas só da marca (ex.: "Chevrolet") ficam de fora.
 */
export async function searchCarPhotos(query: string, brand?: string): Promise<PhotoCandidate[]> {
  let list = await searchWiki('pt', query).catch(() => [] as PhotoCandidate[]);
  if (list.length < 2) list = [...list, ...(await searchWiki('en', query).catch(() => []))];

  const q = strip(query);
  const words = q.split(/\s+/).filter(Boolean);
  const brandOnly = brand ? strip(normalizeBrand(brand)) : '';
  const score = (c: PhotoCandidate) => {
    const t = strip(c.title).replace(/\s*\(.*\)$/, '');
    if (t === q) return 3;
    if (words.every((w) => t.includes(w))) return 2;
    if (words.slice(1).some((w) => t.includes(w))) return 1;
    return 0;
  };
  const seen = new Set<string>();
  return list
    .filter((c) => strip(c.title) !== brandOnly && !/^lista/i.test(c.title))
    .filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)))
    .map((c, i) => ({ c, s: score(c), i }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}

const BAD_WORDS = /\b(rear|back|heck|traseira|traseiro|belakang|arriere|interior|interieur|dashboard|cockpit|engine|motor|trunk|badge|logo|emblem|wheel|seat|concept|prototype|render|sketch|crash|accident|police|taxi|racing|rally|drift|type r)\b/i;

/**
 * Fotos do Wikimedia Commons com o ano no nome (pega a geração certa do carro).
 * Só entram arquivos com o nome do modelo; foto de frente e do ano exato sobem na lista.
 */
export async function searchCommons(query: string, year?: number | null): Promise<PhotoCandidate[]> {
  const params = qs({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${query}${year ? ` ${year}` : ''} filetype:bitmap`,
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: THUMB_WIDTH,
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: WIKI_HEADERS,
  });
  if (!res.ok) throw new Error(`Wikimedia respondeu ${res.status}`);
  const json = await res.json();
  const pages = Object.values<{ index: number; title: string; imageinfo?: { thumburl?: string; url: string }[] }>(
    json.query?.pages ?? {},
  );
  const words = strip(query).split(/\s+/).slice(1); // sem a marca
  return pages
    .map((p) => ({ p, name: p.title.replace(/^File:|^Arquivo:/, '').replace(/\.[a-z]+$/i, '') }))
    .filter(({ p, name }) => p.imageinfo?.[0] && words.every((w) => strip(name).includes(w)) && !BAD_WORDS.test(name))
    .map(({ p, name }) => {
      let score = 0;
      if (/\b(front|frente|frontal|vorne|dianteira)\b/i.test(name)) score += 2;
      const years = (name.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
      if (year && years.includes(year)) score += 3;
      else if (year && years.some((y) => Math.abs(y - year) <= 1)) score += 2;
      else if (year && years.some((y) => Math.abs(y - year) <= 3)) score += 1;
      return { c: { title: name, url: p.imageinfo![0].thumburl ?? p.imageinfo![0].url }, score, index: p.index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.c);
}

/** Todas as opções de foto: primeiro as do ano certo (Commons), depois a foto da página do modelo. */
export async function photoOptions(brand: string, model: string, year?: number | null, custom?: string) {
  const query = custom?.trim() || photoQuery(brand, model);
  const [commons, wiki] = await Promise.all([
    searchCommons(query, custom ? null : year).catch(() => [] as PhotoCandidate[]),
    searchCarPhotos(query, brand).catch(() => [] as PhotoCandidate[]),
  ]);
  const seen = new Set<string>();
  return [...commons.slice(0, 8), ...wiki.slice(0, 4)].filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
}

/** Melhor foto para o veículo, ou null se nada parecido foi achado. */
export async function findCarPhoto(brand: string, model: string, year?: number | null): Promise<PhotoCandidate | null> {
  const query = photoQuery(brand, model);
  const fam = strip(modelFamily(model)).split(/\s+/)[0];
  const commons = await searchCommons(query, year).catch(() => [] as PhotoCandidate[]);
  if (commons.length) return commons[0];
  const list = await searchCarPhotos(query, brand);
  // Só aceita automaticamente se o título tiver o nome do modelo (evita foto de outro carro).
  return list.find((c) => strip(c.title).includes(fam)) ?? null;
}
