import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { BleTransport, type BleDeviceInfo } from './bleTransport';
import { ClassicTransport, type ClassicDevice } from './classicTransport';
import { Elm327 } from './elm327';
import { requestBluetoothPermissions } from './permissions';
import { PIDS, type PidDef } from './pids';
import type { ObdTransport } from './transport';
import { WifiTransport } from './wifiTransport';

export type ConnectTarget =
  | { kind: 'classic'; device: ClassicDevice }
  | { kind: 'ble'; device: BleDeviceInfo }
  | { kind: 'wifi'; host: string; port: number };

export type ObdStatus = 'desconectado' | 'conectando' | 'conectado';

interface ObdState {
  status: ObdStatus;
  label: string;
  protocol: string;
  error: string | null;
  /** PIDs suportados pelo carro que o app sabe ler. */
  available: PidDef[];
  /** Últimos valores lidos, por chave do PID. */
  values: Record<string, number>;
  live: boolean;
  connect(target: ConnectTarget): Promise<void>;
  disconnect(): Promise<void>;
  startLive(): void;
  stopLive(): void;
  readOnce(): Promise<Record<string, number>>;
  elm: () => Elm327 | null;
}

const ObdContext = createContext<ObdState | null>(null);

/** Mantém a conexão OBD viva entre telas. */
export function ObdProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ObdStatus>('desconectado');
  const [label, setLabel] = useState('');
  const [protocol, setProtocol] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<PidDef[]>([]);
  const [values, setValues] = useState<Record<string, number>>({});
  const [live, setLive] = useState(false);

  const transportRef = useRef<ObdTransport | null>(null);
  const elmRef = useRef<Elm327 | null>(null);
  const liveRef = useRef(false);
  const availableRef = useRef<PidDef[]>([]);

  const reset = useCallback(() => {
    liveRef.current = false;
    setLive(false);
    transportRef.current = null;
    elmRef.current = null;
    setStatus('desconectado');
    setAvailable([]);
    availableRef.current = [];
  }, []);

  const disconnect = useCallback(async () => {
    liveRef.current = false;
    const t = transportRef.current;
    reset();
    await t?.disconnect();
  }, [reset]);

  const connect = useCallback(
    async (target: ConnectTarget) => {
      await disconnect();
      setError(null);
      setValues({});
      setStatus('conectando');

      let transport: ObdTransport;
      if (target.kind === 'wifi') {
        transport = new WifiTransport(target.host, target.port);
      } else {
        if (!(await requestBluetoothPermissions())) {
          setStatus('desconectado');
          setError('Permissão de Bluetooth negada.');
          return;
        }
        transport = target.kind === 'classic' ? new ClassicTransport(target.device) : new BleTransport(target.device);
      }

      transport.onClose((reason) => {
        if (transportRef.current !== transport) return;
        reset();
        setError(reason ?? 'Conexão perdida');
      });

      try {
        await transport.connect();
        transportRef.current = transport;
        const elm = new Elm327(transport);
        await elm.init();
        elmRef.current = elm;

        const supported = await elm.supportedPids();
        const list = PIDS.filter((p) => supported.has(p.pid));
        availableRef.current = list;
        setAvailable(list);
        setProtocol(elm.protocolName);
        setLabel(transport.label);
        setStatus('conectado');
      } catch (e) {
        transportRef.current = null;
        await transport.disconnect();
        reset();
        setError((e as Error).message);
      }
    },
    [disconnect, reset],
  );

  const readOnce = useCallback(async () => {
    const elm = elmRef.current;
    if (!elm) return {};
    const result: Record<string, number> = {};
    for (const def of availableRef.current) {
      const v = await elm.readPid(def);
      if (v != null) result[def.key] = v;
    }
    const volts = await elm.readBatteryVoltage();
    if (volts != null) result.battery = volts;
    setValues((prev) => ({ ...prev, ...result }));
    return result;
  }, []);

  const startLive = useCallback(() => {
    if (liveRef.current || !elmRef.current) return;
    liveRef.current = true;
    setLive(true);
    (async () => {
      // Lê em ciclo os PIDs rápidos (rpm, velocidade, temperaturas, carga, acelerador).
      const fastKeys = ['rpm', 'speed', 'coolant', 'load', 'throttle', 'intake', 'oil', 'voltage'];
      while (liveRef.current && elmRef.current) {
        const elm = elmRef.current;
        for (const def of availableRef.current.filter((d) => fastKeys.includes(d.key))) {
          if (!liveRef.current) break;
          const v = await elm.readPid(def);
          if (v != null) setValues((prev) => ({ ...prev, [def.key]: v }));
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    })();
  }, []);

  const stopLive = useCallback(() => {
    liveRef.current = false;
    setLive(false);
  }, []);

  const value: ObdState = {
    status,
    label,
    protocol,
    error,
    available,
    values,
    live,
    connect,
    disconnect,
    startLive,
    stopLive,
    readOnce,
    elm: () => elmRef.current,
  };

  return <ObdContext.Provider value={value}>{children}</ObdContext.Provider>;
}

export function useObd(): ObdState {
  const ctx = useContext(ObdContext);
  if (!ctx) throw new Error('useObd precisa estar dentro de ObdProvider');
  return ctx;
}
