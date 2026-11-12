// Tabela FIPE pela API pública e gratuita da Parallelum (https://deividfortuna.github.io/fipe/).
// Tem limite de requisições por dia por IP, por isso guardamos as respostas em memória.

const BASE = 'https://parallelum.com.br/fipe/api/v1/carros';

export interface FipeItem {
  codigo: string;
  nome: string;
}

export interface FipeDetail {
  Valor: string;
  Marca: string;
  Modelo: string;
  AnoModelo: number;
  Combustivel: string;
  CodigoFipe: string;
  MesReferencia: string;
}

const cache = new Map<string, unknown>();

async function get<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const res = await fetch(BASE + path);
  if (!res.ok) {
    throw new Error(
      res.status === 429
        ? 'Limite diário da tabela FIPE atingido. Tente mais tarde.'
        : `Erro ao consultar a FIPE (${res.status})`,
    );
  }
  const data = (await res.json()) as T;
  cache.set(path, data);
  return data;
}

const normalize = (items: { codigo: string | number; nome: string }[]): FipeItem[] =>
  items.map((i) => ({ codigo: String(i.codigo), nome: i.nome }));

export async function getBrands(): Promise<FipeItem[]> {
  return normalize(await get('/marcas'));
}

export async function getModels(brand: string): Promise<FipeItem[]> {
  const data = await get<{ modelos: { codigo: number; nome: string }[] }>(`/marcas/${brand}/modelos`);
  return normalize(data.modelos);
}

export async function getYears(brand: string, model: string): Promise<FipeItem[]> {
  return normalize(await get(`/marcas/${brand}/modelos/${model}/anos`));
}

export async function getDetail(brand: string, model: string, year: string): Promise<FipeDetail> {
  return get(`/marcas/${brand}/modelos/${model}/anos/${year}`);
}
