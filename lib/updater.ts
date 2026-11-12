import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Atualização do app pelas Releases do GitHub.
 * O GitHub Actions publica cada versão com a tag "v1.0.<versionCode>" e o APK anexado.
 * O app compara o versionCode instalado com o da última release.
 */

const REPO: string = Constants.expoConfig?.extra?.updateRepo ?? 'kinhoown/meu-carro';

export interface AppUpdate {
  versionName: string;
  versionCode: number;
  notes: string;
  apkUrl: string;
  apkSize: number;
  publishedAt: string;
}

export interface InstalledVersion {
  versionName: string;
  versionCode: number;
}

export function installedVersion(): InstalledVersion {
  return {
    versionName: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '?',
    versionCode: Number(Application.nativeBuildVersion ?? 0),
  };
}

interface GithubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  published_at: string;
  assets: { name: string; browser_download_url: string; size: number }[];
}

/** Busca a última release. Retorna null se não houver nenhuma com APK. */
export async function fetchLatestRelease(): Promise<AppUpdate | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (res.status === 403) throw new Error('Limite de consultas ao GitHub atingido. Tente de novo em alguns minutos.');
  if (!res.ok) throw new Error(`Erro ao consultar atualizações (${res.status})`);

  const rel = (await res.json()) as GithubRelease;
  const apk = rel.assets.find((a) => a.name.toLowerCase().endsWith('.apk'));
  const code = Number(rel.tag_name.match(/(\d+)\s*$/)?.[1] ?? 0);
  if (!apk || !code) return null;

  return {
    versionName: rel.tag_name.replace(/^v/i, ''),
    versionCode: code,
    notes: (rel.body ?? '').trim(),
    apkUrl: apk.browser_download_url,
    apkSize: apk.size,
    publishedAt: rel.published_at,
  };
}

/** Retorna a atualização se ela for mais nova que a versão instalada. */
export async function checkForUpdate(): Promise<AppUpdate | null> {
  const latest = await fetchLatestRelease();
  if (!latest) return null;
  return latest.versionCode > installedVersion().versionCode ? latest : null;
}

/** Baixa o APK para o cache do app, informando o progresso (0 a 1). */
export async function downloadUpdate(update: AppUpdate, onProgress: (p: number) => void): Promise<string> {
  const target = `${FileSystem.cacheDirectory}meu-carro-${update.versionCode}.apk`;

  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists && existing.size === update.apkSize) {
    onProgress(1);
    return target;
  }

  const task = FileSystem.createDownloadResumable(update.apkUrl, target, {}, (p) => {
    const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : update.apkSize;
    if (total > 0) onProgress(p.totalBytesWritten / total);
  });
  const result = await task.downloadAsync();
  if (!result || result.status !== 200) throw new Error('Falha ao baixar a atualização.');
  return result.uri;
}

/**
 * Abre o instalador do Android. Na primeira vez o Android pede para permitir
 * "Instalar apps desconhecidos" para o Meu Carro.
 */
export async function installApk(fileUri: string): Promise<void> {
  const contentUri = await FileSystem.getContentUriAsync(fileUri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    // FLAG_GRANT_READ_URI_PERMISSION
    flags: 1,
  });
}

/** Remove APKs baixados antes (chamado ao abrir a tela). */
export async function cleanOldDownloads(): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) return;
  const files = await FileSystem.readDirectoryAsync(dir).catch(() => [] as string[]);
  const current = installedVersion().versionCode;
  await Promise.all(
    files
      .filter((f) => /^meu-carro-(\d+)\.apk$/.test(f) && Number(f.match(/\d+/)![0]) <= current)
      .map((f) => FileSystem.deleteAsync(dir + f, { idempotent: true })),
  );
}

export function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
