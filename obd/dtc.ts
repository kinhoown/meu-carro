/** Converte 2 bytes do modo 03 em código de falha (ex.: 0x01 0x33 -> P0133). */
export function decodeDtc(a: number, b: number): string {
  const system = ['P', 'C', 'B', 'U'][(a >> 6) & 0x03];
  const d1 = (a >> 4) & 0x03;
  const d2 = (a & 0x0f).toString(16);
  const rest = b.toString(16).padStart(2, '0');
  return `${system}${d1}${d2}${rest}`.toUpperCase();
}

/** Descrições dos códigos genéricos mais comuns. Códigos de fabricante (P1xxx etc.) não estão aqui. */
const DESCRIPTIONS: Record<string, string> = {
  P0100: 'Sensor de fluxo de ar (MAF) – circuito',
  P0101: 'Sensor MAF – faixa/desempenho',
  P0105: 'Sensor de pressão do coletor (MAP) – circuito',
  P0106: 'Sensor MAP – faixa/desempenho',
  P0110: 'Sensor de temperatura do ar de admissão – circuito',
  P0115: 'Sensor de temperatura do motor – circuito',
  P0120: 'Sensor de posição da borboleta (TPS) – circuito',
  P0128: 'Temperatura do motor abaixo do esperado (termostato)',
  P0130: 'Sonda lambda (banco 1, sensor 1) – circuito',
  P0133: 'Sonda lambda (banco 1, sensor 1) – resposta lenta',
  P0135: 'Aquecedor da sonda lambda (banco 1, sensor 1)',
  P0141: 'Aquecedor da sonda lambda (banco 1, sensor 2)',
  P0171: 'Mistura pobre (banco 1)',
  P0172: 'Mistura rica (banco 1)',
  P0201: 'Bico injetor cilindro 1 – circuito',
  P0202: 'Bico injetor cilindro 2 – circuito',
  P0203: 'Bico injetor cilindro 3 – circuito',
  P0204: 'Bico injetor cilindro 4 – circuito',
  P0300: 'Falha de ignição aleatória / múltiplos cilindros',
  P0301: 'Falha de ignição no cilindro 1',
  P0302: 'Falha de ignição no cilindro 2',
  P0303: 'Falha de ignição no cilindro 3',
  P0304: 'Falha de ignição no cilindro 4',
  P0325: 'Sensor de detonação – circuito',
  P0335: 'Sensor de rotação (virabrequim) – circuito',
  P0340: 'Sensor de fase (comando de válvulas) – circuito',
  P0400: 'Recirculação de gases (EGR) – fluxo',
  P0420: 'Eficiência do catalisador abaixo do limite (banco 1)',
  P0440: 'Sistema de emissões evaporativas (cânister)',
  P0443: 'Válvula de purga do cânister – circuito',
  P0500: 'Sensor de velocidade do veículo',
  P0505: 'Controle da marcha lenta',
  P0560: 'Tensão do sistema (bateria/alternador)',
  P0562: 'Tensão do sistema baixa',
  P0563: 'Tensão do sistema alta',
  P0600: 'Falha de comunicação da ECU',
  P0700: 'Falha no sistema de controle da transmissão',
};

export function describeDtc(code: string): string {
  return DESCRIPTIONS[code] ?? 'Consulte o manual ou uma oficina (código específico do fabricante ou não catalogado).';
}
