// Config plugin: assina o APK de release com a chave do projeto quando as variáveis
// MEUCARRO_KEYSTORE* existem (no PC e no GitHub Actions). Sem elas, usa a chave de debug.
// Sempre a MESMA chave é obrigatória para o Android aceitar a atualização por cima do app instalado.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `signingConfigs {
        release {
            if (System.getenv('MEUCARRO_KEYSTORE')) {
                storeFile file(System.getenv('MEUCARRO_KEYSTORE'))
                storePassword System.getenv('MEUCARRO_KEYSTORE_PASSWORD')
                keyAlias System.getenv('MEUCARRO_KEY_ALIAS')
                keyPassword System.getenv('MEUCARRO_KEY_PASSWORD')
            }
        }
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('MEUCARRO_KEYSTORE')) return cfg;

    const withBlock = gradle.replace(/signingConfigs \{\r?\n/, RELEASE_SIGNING);
    const withRelease = withBlock.replace(
      /(buildTypes \{[\s\S]*?release \{(?:\s*\/\/.*)*\s*)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('MEUCARRO_KEYSTORE') ? signingConfigs.release : signingConfigs.debug",
    );
    if (withBlock === gradle || withRelease === withBlock) {
      throw new Error('withReleaseSigning: não encontrei os blocos de assinatura no app/build.gradle');
    }
    cfg.modResults.contents = withRelease;
    return cfg;
  });
};
