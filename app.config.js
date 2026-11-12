// Complementa o app.json com a versão e a assinatura.
// APP_VERSION_CODE é definido pelo GitHub Actions a cada build (número crescente);
// o app usa esse número para saber se existe atualização.
const versionCode = Number(process.env.APP_VERSION_CODE || 1);

module.exports = ({ config }) => ({
  ...config,
  version: `1.0.${versionCode}`,
  android: { ...config.android, versionCode },
  extra: {
    ...config.extra,
    // Repositório público de onde o app baixa as atualizações (Releases).
    updateRepo: 'kinhoown/meu-carro',
  },
  plugins: [...(config.plugins ?? []), './plugins/withReleaseSigning'],
});
