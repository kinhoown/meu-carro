# Meu Carro — manutenções + diagnóstico OBD (Android)

App Android em React Native (Expo) para:

- **Cadastrar veículos** pela placa (antiga ou Mercosul), com marca, modelo, ano e valor pela **tabela FIPE**.
- **Registrar manutenções** (troca de óleo, filtros, correia, freios...) com custo, km, oficina e observações.
- **Lembretes de próxima troca** por km ou data, com sugestão automática pelo tipo de serviço.
- **Ler o carro por OBD-II** com adaptadores **ELM327** por **Bluetooth clássico**, **BLE** ou **Wi-Fi**:
  rotação, velocidade, temperaturas, carga, combustível, tensão, hodômetro (se o carro informar),
  **códigos de falha** (ler/apagar), códigos pendentes e chassi (VIN).
- **Dados na nuvem** (Firebase do Google), com login pela **conta Google** ou por e-mail; cada usuário só vê os próprios dados.

> Não existe API pública gratuita do Detran para buscar o carro pela placa. Por isso a placa é
> guardada como identificação, e o modelo vem da tabela FIPE (marca → modelo → ano).

## Estrutura

```
app/                      telas (expo-router)
  login.tsx               entrar com Google ou e-mail
  index.tsx               lista de veículos
  vehicle/new.tsx         cadastro (placa + FIPE)
  vehicle/[id]/index.tsx  detalhes, lembretes e histórico
  vehicle/[id]/maintenance.tsx  nova/editar manutenção
  vehicle/[id]/obd.tsx    conexão e diagnóstico OBD
lib/                      Firebase (login e banco), FIPE, formatação, regras de manutenção
obd/                      ELM327, PIDs, códigos de falha e transportes (classic / BLE / Wi-Fi)
firebase.config.ts        configuração do projeto Firebase (preencher)
firestore.rules           regras de segurança do banco
```

## 1. Instalar as ferramentas (uma vez)

1. **Node.js LTS**: https://nodejs.org (ou `winget install OpenJS.NodeJS.LTS`).
2. **JDK 17**: `winget install Microsoft.OpenJDK.17`.
3. **Android SDK**: já existe em `%LOCALAPPDATA%\Android\Sdk`. Defina a variável
   `ANDROID_HOME` apontando para essa pasta e adicione `%ANDROID_HOME%\platform-tools` ao `PATH`.

## 2. Configurar o Firebase (grátis)

Os veículos, manutenções e leituras ficam no **Cloud Firestore**, ligados à conta com que você entrou.
Entrando com o mesmo Google em outro celular, aparecem os mesmos dados.

1. Em https://console.firebase.google.com clique em **Criar um projeto** (nome `Meu Carro`;
   o Google Analytics pode ficar desativado).
2. **Adicionar o app Android** (ícone do Android na página inicial do projeto):
   - Nome do pacote: `com.meucarro.manutencao`
   - Certificado SHA-1: `DC:EC:24:A9:CC:52:BE:9F:3E:94:E0:C0:F9:B4:F5:49:B3:15:00:18`
   - Clique em **Registrar app**. O `google-services.json` **não** é necessário: pode pular os próximos passos.
3. **Adicionar o app da Web** (ícone `</>`, nome `Meu Carro`, sem Hosting). Ao final aparece o bloco
   `const firebaseConfig = { apiKey: ..., authDomain: ..., ... }`: copie esses valores para
   [firebase.config.ts](firebase.config.ts).
4. **Authentication → Vamos começar → Método de login**:
   - **Google**: ative, escolha o e-mail de suporte e salve. Depois abra o Google de novo, expanda
     **Configuração do SDK da Web** e copie o **ID do cliente da Web** para `googleWebClientId` em
     [firebase.config.ts](firebase.config.ts).
   - **E-mail/senha**: ative (opcional, para quem não quiser usar o Google).
5. **Firestore Database → Criar banco de dados**: local `southamerica-east1 (São Paulo)`, modo **produção**.
   Depois, na aba **Regras**, cole o conteúdo de [firestore.rules](firestore.rules) e clique em **Publicar**.
6. Envie o `firebase.config.ts` preenchido para o GitHub (`git push`): sai uma versão nova com o login funcionando.

> Os valores do `firebase.config.ts` não são segredos (vão dentro de todo app Firebase); quem protege
> os dados são as regras do Firestore. Se o login com Google mostrar "não autorizado para este app",
> o SHA-1 do app Android no Firebase está errado. Builds de teste feitos no PC (`expo run:android`)
> usam outra chave: adicione também o SHA-1 de `cd android && ./gradlew signingReport`.

## 3. Rodar no celular

O app usa Bluetooth e socket TCP nativos, então **não roda no Expo Go**: precisa de um build próprio.

```bash
npm install
npx expo install --fix          # alinha as versões com o SDK do Expo
```

Com o celular ligado no USB (depuração USB ativa):

```bash
npx expo run:android
```

Ou gere um APK na nuvem sem precisar do Android Studio:

```bash
npx eas-cli build -p android --profile preview
```

## Instalar e atualizar pelo celular

1. No celular, abra **https://github.com/kinhoown/meu-carro/releases/latest** e baixe o `.apk`.
2. Abra o arquivo e permita "instalar apps desconhecidos" para o navegador (só na primeira vez).
3. Depois disso, as novas versões aparecem **dentro do app**: uma faixa verde "Nova versão disponível"
   na tela inicial, e a tela **Atualizações do app** (no fim da lista de veículos) para baixar e instalar.

### Como publicar uma versão nova

Basta enviar o código para a branch `main`:

```bash
git add -A
git commit -m "Descreva o que mudou (vira a nota da atualização no app)"
git push
```

O GitHub Actions ([.github/workflows/android-release.yml](.github/workflows/android-release.yml)) gera o APK
assinado e cria a Release `v1.0.N`. Em ~15 minutos o app já mostra a atualização.

### Chave de assinatura (importante)

O Android só aceita atualizar por cima se o APK for assinado com a **mesma chave**. Ela fica em
`%USERPROFILE%\.meu-carro\` (`release.keystore` + `signing.env` com a senha) e uma cópia está nos
Secrets do GitHub. **Faça backup dessa pasta** — se perder a chave, será preciso desinstalar e
reinstalar o app.

Secrets usados pelo workflow: `MEUCARRO_KEYSTORE_BASE64`, `MEUCARRO_KEYSTORE_PASSWORD`,
`MEUCARRO_KEY_ALIAS`, `MEUCARRO_KEY_PASSWORD`.

## Usando o OBD

| Tipo de adaptador | Como conectar |
|---|---|
| **Bluetooth clássico** (o mais comum, ELM327 azul barato) | Pareie nas configurações do Android (PIN `1234` ou `0000`), depois aba **Bluetooth → Listar pareados**. |
| **BLE / Bluetooth 4.0** (Vgate iCar, Veepeak BLE, vLinker) | Aba **BLE → Procurar dispositivos**. Não precisa parear. |
| **Wi-Fi** | Conecte o celular na rede do adaptador (ex.: `WiFi_OBDII`), aba **Wi-Fi**, IP `192.168.0.10` porta `35000`. |

Dicas:
- Ligue a **ignição** (ou o motor) antes de conectar; a primeira conexão pode levar até 15 s detectando o protocolo.
- Com adaptador Wi-Fi o celular fica sem internet por essa rede; o app força o OBD pelo Wi-Fi, mas para
  **salvar a leitura** na nuvem os dados móveis precisam estar ativos.
- Nem todo carro informa hodômetro (PID A6) e chassi; carros brasileiros anteriores a ~2010 costumam ter menos sensores.
- Clones ELM327 "v2.1" muito baratos às vezes falham em alguns comandos. Se travar, desconecte e conecte de novo.

## Próximos passos sugeridos

- Notificações locais quando uma manutenção estiver para vencer (`expo-notifications`).
- Foto da nota fiscal anexada à manutenção (Firebase Storage).
- Integração com um provedor pago de consulta por placa, se quiser preencher o modelo automaticamente.
