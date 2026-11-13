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

/** Sobe quando a busca automática melhora: fotos escolhidas sozinhas são buscadas de novo. */
export const PHOTO_SEARCH_VERSION = 2;

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

const TWO_WORD_FIRST = new Set(['grand', 'new', 'range', 'space', 'classe', 'serie', 'série', 'land', 'santa', 'c4', 'c3']);
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

/**
 * Palavras inteiras de um texto, sem acento e sem hífen dentro do nome:
 * "2016 Chevrolet Onix (front)" -> [2016, chevrolet, onix, front] ; "T-Cross" -> [tcross] ; "Up!" -> [up].
 * Comparar palavras inteiras evita que "Gol" ache "Golf" ou "Ka" ache "Kadjar".
 */
export function tokens(s: string): string[] {
  return strip(s)
    .replace(/([a-z0-9])-(?=[a-z0-9])/g, '$1')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const isYear = (t: string) => /^(19|20)\d{2}$/.test(t);

/** Marcas comuns (para tirar a marca do texto que o usuário digitou). */
const BRANDS = new Set(
  (
    'chevrolet gm volkswagen vw fiat ford renault toyota honda hyundai jeep nissan peugeot citroen mitsubishi ' +
    'kia chery caoa bmw audi mercedes benz volvo land rover suzuki subaru jac byd gwm haval ram dodge chrysler ' +
    'mini porsche lexus troller lifan effa'
  ).split(' '),
);

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
  const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}`, { headers: WIKI_HEADERS });
  if (!res.ok) throw new Error(`Wikipédia respondeu ${res.status}`);
  const json = await res.json();
  const pages = Object.values<{ index: number; title: string; thumbnail?: { source: string } }>(json.query?.pages ?? {});
  return pages
    .sort((a, b) => a.index - b.index)
    .filter((p) => p.thumbnail?.source && !/\.svg/i.test(p.thumbnail.source) && !/logo/i.test(p.thumbnail.source))
    .map((p) => ({ title: p.title, url: p.thumbnail!.source }));
}

/** Fotos que não mostram o carro inteiro por fora (ou não são o carro de rua). */
const BAD_WORDS = new Set(
  (
    'rear back heck traseira traseiro belakang arriere tail taillight taillights interior interieur inside ' +
    'dashboard dash cockpit steering engine motor trunk badge logo emblem wheel wheels rim rims seat seats ' +
    'headlight headlights detail concept prototype render sketch drawing crash accident wreck police policia ' +
    'taxi racing race rally drift tuning tuned modified miniature toy diecast lego advertisement brochure'
  ).split(' '),
);
const FRONT_WORDS = new Set(['front', 'frente', 'frontal', 'vorne', 'dianteira']);

/** O que procurar: palavras do modelo (obrigatórias), extras (versão etc.), marca e ano. */
export interface PhotoSearch {
  text: string;
  required: string[];
  extra: string[];
  brand: string[];
  year: number | null;
}

/** Busca automática a partir dos dados da FIPE. */
export function searchFromVehicle(brand: string, model: string, year?: number | null): PhotoSearch {
  const b = normalizeBrand(brand);
  const fam = modelFamily(model);
  return { text: `${b} ${fam}`, required: tokens(fam), extra: [], brand: tokens(b), year: year ?? null };
}

/**
 * Busca digitada pelo usuário, ex.: "Onix LTZ 2016" ou "Chevrolet Onix 2016".
 * Marca e ano são reconhecidos; o modelo é obrigatório e o resto (versão etc.) só ajuda
 * a ordenar, assim "LTZ" não zera os resultados.
 */
export function searchFromText(text: string, brand: string, model: string): PhotoSearch {
  const all = tokens(text);
  const brandToks = tokens(normalizeBrand(brand));
  const year = all.find(isYear);
  const words = all.filter((t) => !isYear(t) && !BRANDS.has(t) && !brandToks.includes(t));
  const famToks = tokens(modelFamily(model)).filter((t) => words.includes(t));
  const required = famToks.length ? famToks : words.slice(0, 1);
  const hasBrand = all.some((t) => BRANDS.has(t) || brandToks.includes(t));
  return {
    text: hasBrand ? text : `${normalizeBrand(brand)} ${text}`,
    required,
    extra: words.filter((t) => !required.includes(t)),
    brand: hasBrand ? all.filter((t) => BRANDS.has(t) || brandToks.includes(t)) : brandToks,
    year: year ? Number(year) : null,
  };
}

function scoreName(name: string, q: PhotoSearch): number | null {
  const tk = tokens(name);
  if (!q.required.length || !q.required.every((r) => tk.includes(r))) return null;
  if (tk.some((t) => BAD_WORDS.has(t))) return null;
  let score = 0;
  if (q.brand.some((b) => tk.includes(b))) score += 1;
  if (tk.some((t) => FRONT_WORDS.has(t))) score += 2;
  score += q.extra.filter((e) => tk.includes(e)).length * 2;
  const years = tk.filter(isYear).map(Number);
  if (q.year) {
    if (years.includes(q.year)) score += 4;
    else if (years.some((y) => Math.abs(y - q.year!) <= 1)) score += 3;
    else if (years.some((y) => Math.abs(y - q.year!) <= 3)) score += 1;
    else if (years.length) score -= 2; // provavelmente outra geração
  }
  return score;
}

async function commonsRaw(text: string): Promise<{ name: string; url: string }[]> {
  const params = qs({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: `${text} filetype:bitmap`,
    gsrlimit: '40',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: THUMB_WIDTH,
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: WIKI_HEADERS });
  if (!res.ok) throw new Error(`Wikimedia respondeu ${res.status}`);
  const json = await res.json();
  const pages = Object.values<{ index: number; title: string; imageinfo?: { thumburl?: string; url: string }[] }>(
    json.query?.pages ?? {},
  );
  return pages
    .filter((p) => p.imageinfo?.[0])
    .sort((a, b) => a.index - b.index)
    .map((p) => ({
      name: p.title.replace(/^(File|Arquivo):/, '').replace(/\.[a-z]+$/i, ''),
      url: p.imageinfo![0].thumburl ?? p.imageinfo![0].url,
    }));
}

/**
 * Fotos do Wikimedia Commons: busca com o ano (geração certa) e sem o ano (mais opções).
 * Só entram arquivos com o nome do modelo em palavra inteira; frente e ano certo sobem.
 */
export async function searchCommons(q: PhotoSearch): Promise<PhotoCandidate[]> {
  // Várias buscas: o texto completo, e só marca + modelo (com e sem ano), porque o Commons
  // exige todas as palavras e a versão ("LTZ", "G5") quase nunca está no nome do arquivo.
  const base = `${q.brand.join(' ')} ${q.required.join(' ')}`.trim();
  const texts = [
    q.year && !tokens(q.text).includes(String(q.year)) ? `${q.text} ${q.year}` : q.text,
    q.year ? `${base} ${q.year}` : '',
    base,
  ];
  const unique = [...new Set(texts.filter(Boolean))];
  const runs = await Promise.all(unique.map((t) => commonsRaw(t).catch(() => [])));
  const seen = new Set<string>();
  const scored: { c: PhotoCandidate; score: number; index: number }[] = [];
  runs.flat().forEach((r, i) => {
    if (seen.has(r.url)) return;
    seen.add(r.url);
    const score = scoreName(r.name, q);
    if (score != null) scored.push({ c: { title: r.name, url: r.url }, score, index: i });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((x) => x.c);
}

/** Foto principal das páginas da Wikipédia cujo título tem o modelo em palavra inteira. */
export async function searchCarPhotos(q: PhotoSearch): Promise<PhotoCandidate[]> {
  let list = await searchWiki('pt', q.text).catch(() => [] as PhotoCandidate[]);
  if (list.length < 2) list = [...list, ...(await searchWiki('en', q.text).catch(() => []))];
  return list.filter((c) => {
    const tk = tokens(c.title);
    return q.required.length > 0 && q.required.every((r) => tk.includes(r)) && !/^lista/i.test(c.title);
  });
}

/** Opções para o usuário escolher: Commons (ano/versão certos primeiro) e depois a Wikipédia. */
export async function photoOptions(
  brand: string,
  model: string,
  year?: number | null,
  custom?: string,
): Promise<PhotoCandidate[]> {
  const q = custom?.trim() ? searchFromText(custom, brand, model) : searchFromVehicle(brand, model, year);
  const [commons, wiki] = await Promise.all([
    searchCommons(q).catch(() => [] as PhotoCandidate[]),
    searchCarPhotos(q).catch(() => [] as PhotoCandidate[]),
  ]);
  const seen = new Set<string>();
  return [...commons.slice(0, 16), ...wiki.slice(0, 4)].filter((c) =>
    seen.has(c.url) ? false : (seen.add(c.url), true),
  );
}

/** Melhor foto para o veículo, ou null se nada com o nome do modelo foi achado. */
export async function findCarPhoto(brand: string, model: string, year?: number | null): Promise<PhotoCandidate | null> {
  const q = searchFromVehicle(brand, model, year);
  const commons = await searchCommons(q).catch(() => [] as PhotoCandidate[]);
  if (commons.length) return commons[0];
  const wiki = await searchCarPhotos(q).catch(() => [] as PhotoCandidate[]);
  return wiki[0] ?? null;
}
