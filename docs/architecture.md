# Arquitetura do Hedge

**Status:** aceita; evolução para conta e nuvem em preparação
**Atualização:** 29 de setembro de 2026

Este documento registra as decisões iniciais de arquitetura do Hedge. Ele deve
ser atualizado quando uma decisão estrutural for alterada. O objetivo não é
antecipar todas as necessidades futuras, mas estabelecer limites simples para
que o aplicativo continue compreensível à medida que crescer.

## Objetivos arquiteturais

1. Priorizar operações financeiras rápidas executadas no dispositivo.
2. Permitir leitura e escrita offline, com sincronização posterior.
3. Usar o menor número razoável de dependências e abstrações.
4. Preservar a correção dos cálculos e dos dados financeiros.
5. Permitir múltiplos temas sem acoplar componentes a cores específicas.

Conta de usuário e sincronização passam a fazer parte da arquitetura aceita. A
implementação ainda não está ativa; o plano define a ordem e os bloqueios.
Continuam fora do escopo web, colaboração, múltiplas moedas, analytics e EAS Update.

## Stack decidida

| Área | Decisão |
| --- | --- |
| Plataformas | Android e iOS |
| Aplicativo | Expo no fluxo gerenciado e React Native |
| Linguagem | TypeScript com modo estrito |
| Navegação | Expo Router; pilha JavaScript com `react-native-gesture-handler` compatível com o SDK para transições temporizadas entre telas secundárias |
| Persistência | `expo-sqlite`, usando sua API diretamente |
| Backup local | `expo-file-system`, `expo-document-picker` e `expo-sharing` |
| Estilos | `StyleSheet` do React Native |
| Estado local | `useState` e `useReducer` |
| Estado global | React Context apenas para tema, preferências, sessão e resumo de sincronização |
| Preferências | `expo-sqlite/kv-store` |
| Entrada de datas | `@react-native-community/datetimepicker`, usando o controle nativo do sistema |
| Gráficos vetoriais | `react-native-svg` e `react-native-svg-transformer`, para gráficos e ícones SVG locais |
| Interface do sistema | `expo-status-bar` e `expo-navigation-bar`, acompanhando a aparência resolvida do tema |
| Testes | Jest com `jest-expo` |
| Lint | ESLint com `eslint-config-expo` |
| Dados remotos | PostgreSQL gerenciado pelo Supabase em São Paulo |
| Autenticação | Supabase Auth com código de uso único por e-mail |
| Cliente remoto | `@supabase/supabase-js` e `react-native-url-polyfill`, usando RPCs |
| Sincronização | Protocolo próprio com fila SQLite, idempotência, versões e cursor incremental |
| Sessão | AES-GCM com `expo-crypto` e chave em `expo-secure-store` |
| Conectividade | `expo-network`; tarefas oportunistas com `expo-background-task` |
| Desenvolvimento nativo | `expo-dev-client` para validar módulos em aparelhos físicos |
| Backend local | CLI Supabase como devDependency; Docker é requisito externo |

As versões compatíveis devem ser instaladas pelo Expo. Pacotes do ecossistema
Expo não devem ter versões escolhidas manualmente quando `expo install` puder
resolvê-las.

## Estrutura de pastas

```text
Hedge/
├── assets/
│   ├── fonts/                 # Fontes empacotadas no aplicativo
│   └── images/                # Imagens e ilustrações locais
├── docs/
│   ├── architecture.md        # Decisões estruturais do projeto
│   └── database-schema-v1.md  # Schema SQLite inicial congelado
└── src/
    ├── app/                   # Rotas, layouts e composição de telas
    ├── components/            # Componentes visuais compartilhados
    ├── db/
    │   ├── benchmarks/         # Fixtures e medição reproduzível do SQLite local
    │   ├── migrations/        # Alterações sequenciais do schema
    │   ├── localProfiles.ts   # Registro e troca atômica entre bancos de perfil
    │   ├── repositories/      # Único acesso aos dados financeiros
    │   └── sync/              # Outbox e reconciliação local sem transporte remoto
    ├── domain/
    │   ├── calculations/      # Cálculos financeiros puros
    │   └── models/            # Tipos e conceitos do domínio
    │   └── sync/              # Contratos puros da sincronização futura
    ├── features/
    │   ├── accounts/          # Casos de uso e UI específicos de contas
    │   ├── categories/        # Casos de uso e UI específicos de categorias
    │   ├── settings/          # Configurações e arquivos de backup
    │   └── transactions/      # Casos de uso e UI específicos de lançamentos
    ├── theme/                 # Tokens, temas, provider e hook de tema
    └── utils/                 # Funções pequenas, genéricas e sem estado
```

Arquivos `.gitkeep` existem somente para tornar as pastas vazias versionáveis.
Eles devem ser removidos quando a pasta receber seu primeiro arquivo real.

Pastas genéricas como `services`, `store`, `hooks`, `types` e `helpers` não
serão criadas antecipadamente. Um módulo permanece junto da funcionalidade que
o utiliza; ele só será promovido para uma área compartilhada depois que houver
reutilização concreta.

## Responsabilidades e dependências

O fluxo principal será:

```text
rota/tela -> funcionalidade -> repositório -> SQLite
                    |              |
                    +----> domínio <+
```

### `src/app`

Contém as rotas reconhecidas pelo Expo Router, layouts de navegação e a
composição das telas. Rotas podem ler parâmetros, coordenar componentes e
acionar operações de uma funcionalidade.

Uma rota não deve conter SQL, cálculos financeiros nem regras de persistência.
As áreas principais são Início, Histórico, Categorias, Contas e Configurações; a
navegação entre elas é apresentada pela interface como uma barra inferior
persistente. Telas de criação e edição ficam fora dessas áreas para manter os
fluxos focados.

### `src/features`

Organiza código pelo conceito percebido pelo usuário. Cada funcionalidade pode
conter seus componentes exclusivos, validações, hooks e operações. Não é
necessário criar subpastas internas até que a quantidade de arquivos justifique
isso.

Uma funcionalidade não deve importar detalhes internos de outra. Código comum
de domínio vai para `domain`; UI genuinamente compartilhada vai para
`components`.

### `src/domain`

Contém modelos e cálculos financeiros puros. Não pode importar React, React
Native, Expo Router ou SQLite. Essa restrição mantém a parte mais sensível do
aplicativo simples de testar e independente da interface.

### `src/db`

Centraliza a conexão, inicialização, migrações e consultas ao SQLite. Somente
repositórios podem executar consultas relacionadas aos dados financeiros. Eles
retornam modelos do domínio, e não detalhes internos do driver SQLite.

`DatabaseProvider` e `useDatabase` são as únicas portas de React para a conexão
Expo SQLite. Rotas e funcionalidades não importam o driver nem executam SQL.

Também abriga adaptadores pequenos para armazenamento local auxiliar.
`preferences.ts` encapsula preferências visuais, `localProfiles.ts` mantém o
registro dos arquivos de perfil e `sessionStorage.ts` expõe o adaptador limitado
usado pela sessão cifrada. Esses são os únicos pontos que acessam o
`expo-sqlite/kv-store` diretamente; nenhum módulo fora de `src/db` acessa esse
storage diretamente.

### `src/components`

Contém componentes reutilizados por mais de uma funcionalidade, como botão,
campo monetário ou cartão. Componentes usam tokens do tema e não conhecem o
banco de dados.

### `src/theme`

Define os contratos visuais, temas disponíveis, resolução da aparência e o
`ThemeProvider`. Nenhum componente deve usar uma cor literal quando existir um
token semântico equivalente.

### `src/utils`

Aceita apenas funções genéricas, pequenas e sem estado. Uma função relacionada
especificamente a contas ou lançamentos permanece na respectiva funcionalidade
ou no domínio.

## Persistência

O SQLite é a fonte de verdade. Não haverá uma cópia de todas as contas e
transações em um estado global. As telas consultarão o banco ao entrar em foco
e atualizarão o resultado após uma escrita relevante. Eventos locais de
recorrência carregam as ocorrências alteradas para que telas não afetadas não
refaçam consultas. Uma solução de cache ou reatividade só será adicionada se
esse modelo demonstrar uma limitação real.

As seguintes regras foram decididas:

- valores monetários serão armazenados como `INTEGER` em centavos;
- `REAL` não será usado para dinheiro;
- datas civis serão textos no formato `YYYY-MM-DD`;
- instantes técnicos, quando necessários, serão ISO 8601 em UTC;
- chaves estrangeiras serão ativadas com `PRAGMA foreign_keys = ON`;
- o banco usará `PRAGMA journal_mode = WAL`;
- consultas receberão valores por parâmetros, nunca por concatenação de texto;
- históricos usarão paginação por cursor e listas virtualizadas; telas não
  materializarão toda a tabela de lançamentos para uma página;
- saldos, gastos por categoria e séries mensais serão agregados no SQLite e
  validados como inteiros seguros antes de chegar à interface;
- operações com várias escritas relacionadas usarão transações;
- o schema evoluirá por migrações pequenas, sequenciais e versionadas;
- as migrações serão executadas durante o `onInit` do `SQLiteProvider`.

O [schema v1](database-schema-v1.md) está congelado na primeira migração. Ele
usa tabelas `STRICT` para contas, categorias, lançamentos, regras recorrentes e
ocorrências recorrentes. A migração 8 acrescenta somente índices para paginação,
agregações e busca de ocorrências. Identificadores são inteiros locais, saldos são
derivados dos lançamentos e transferências são representadas por uma única
linha com conta de origem e destino.

Contas usam arquivamento lógico para preservar o histórico e as referências de
transferências: registros arquivados são excluídos das consultas que alimentam
telas e não podem receber novas escritas. Arquivar uma conta desativa suas
regras recorrentes ativas na mesma transação. Regras recorrentes usam exclusão lógica para preservar procedência e podem ser pausadas sem exclusão; regras pausadas não geram novas ocorrências até serem retomadas. Uma tabela
de ocorrências registra cada data processada mesmo depois da exclusão do
lançamento gerado, evitando geração duplicada. Ao inicializar ou retornar ao
primeiro plano, o repositório resolve a data civil pelo fuso financeiro imutável
do conjunto e gera as datas vencidas de regras ativas em lotes transacionais
independentes e idempotentes. Lotes e checkpoints ficam persistidos; uma
interrupção preserva os lotes já confirmados, e a próxima execução retoma o mesmo
lote pelas ocorrências ausentes. A
interface só atualiza seus saldos depois que o processamento completo termina;
ela bloqueia a abertura até essa etapa concluir ou exibe uma recuperação
explícita em caso de falha. A migração 1 não deve ser
alterada depois de aplicada; mudanças futuras exigem novas migrações.

As migrações 9 e 10 preparam a identidade local para sincronização sem mudar as
chaves inteiras usadas pela interface. Contas, categorias, regras, lançamentos e
ocorrências recebem `sync_id` imutável, `sync_version` e marcador de exclusão;
as ocorrências usam a identidade determinística formada pela identidade da regra
e pela data civil. Cada banco também contém exatamente um `local_profile`, com
`profile_id`, `ledger_id` e `generation`. Bancos anteriores recebem esses valores
uma única vez dentro da transação da migração. Antes dessa primeira migração, o
aplicativo cria no diretório do SQLite uma cópia
`*.pre-global-identity.v8.recovery.db`; uma interrupção reverte a migração e a
próxima abertura pode retomá-la sem duplicar identidades.

A migração 11 instala, dentro de cada banco de perfil, a outbox, a base remota
confirmada, recibos, cursor incremental, IDs de eventos aplicados e conflitos.
Ela também cria comandos iniciais para entidades que já existiam. A projeção
financeira e seu comando são confirmados na mesma transação do repositório; uma
falha na fila reverte a mutação. Exclusões de categorias e lançamentos passam a
usar os tombstones introduzidos pela migração 9 e deixam de participar das
consultas locais, preservando a proposta para publicação e revisão.

A migração 12 conclui as garantias financeiras locais anteriores ao servidor.
O fuso financeiro é preenchido na primeira inicialização e depois permanece
imutável no perfil. A identidade da ocorrência e a do lançamento recorrente são
derivadas da mesma combinação `regra + data`, com sufixo próprio para o
lançamento; registros anteriores e suas referências na reconciliação são
convertidos atomicamente. Lotes e checkpoints de recorrência passam a ter
persistência explícita.

Cada conta também recebe uma `financial_version`, preenchida a partir dos
lançamentos existentes e incrementada por gatilhos para toda inclusão, edição ou
exclusão lógica que afete seu saldo, incluindo os dois lados de uma transferência.
Uma retificação informa a versão lida pela tela e falha dentro da transação se
outra movimentação já a tornou obsoleta. A falha preserva tanto os metadados da
conta quanto o saldo atual.

## Estado da interface

Estado temporário de tela, como campos de formulário e abertura de modais,
permanece local com hooks do React. React Context será usado somente para dados
pequenos e realmente transversais: tema, preferências e uma única confirmação
temporária de operação concluída exibida acima da navegação.

Redux, Zustand, React Query e bibliotecas equivalentes não fazem parte da
arquitetura inicial.

## Temas

Tema visual e aparência do sistema serão dimensões separadas:

- **tema:** Hedge, Oceano, Pôr do sol, Amora, Rosa, Areia, Meia-noite, Volcânico,
  Aurora, Cítrico, Custom ou outro conjunto futuro;
- **aparência:** clara, escura ou acompanhar o sistema.

Um tema fornece tokens semânticos de cor, incluindo `background`, `surface`,
`surfaceElevated`, `surfaceSubtle`, `text`, `textMuted`, `primary`,
`onPrimary`, contêineres de destaque, bordas, foco, estados positivo,
negativo, de atenção e informativo, além dos tokens compartilhados de
espaçamento, raio e tipografia. O provider resolve tema e aparência para um
conjunto final de tokens. Os temas disponíveis são Hedge, Oceano, Pôr do sol,
Amora, Rosa, Areia, Meia-noite, Volcânico, Aurora, Cítrico e Custom; todos
oferecem variantes clara e escura para validar que componentes não dependem de
uma paleta específica. O tema Custom persiste somente duas sementes escolhidas
pelo usuário — principal e secundária — e deriva localmente os demais tokens.
A principal governa ações e foco; a secundária orienta superfícies neutras e o
estado informativo. Estados positivo, negativo e de atenção mantêm significado
visual próprio, e cores de primeiro plano são escolhidas por contraste.

A seleção de tema, aparência e a preferência de ocultar saldos é armazenada no `expo-sqlite/kv-store` pelo adaptador
`src/db/preferences.ts`. O `src/db/sessionStorage.ts` é o segundo adaptador
autorizado, com escopo exclusivo para o ciphertext de sessão; o `ThemeProvider`
consome a API tipada de preferências, aplica os padrões para
nomes e definições Custom inválidos ou indisponíveis e expõe gravações que informam falha sem gerar
rejeições não observadas. Inicialmente, temas podem alterar cores e propriedades
visuais pequenas, mas não a estrutura ou o espaçamento fundamental das telas.
No Android, a barra de navegação nativa é ocultada nas telas do aplicativo. A
barra inferior persistente do próprio app concentra a navegação principal e
mantém o espaço do rodapé consistente entre telas.

Os componentes compartilhados mínimos são `Screen`, `Text`, `Card`, `Field` e
`Button`. Eles ficam em `src/components`, recebem suas decisões visuais do
tema e não têm conhecimento de funcionalidades ou do banco de dados. Cores de
primeiro plano sobre cores persistidas pelo usuário são resolvidas por uma
regra de contraste em `src/theme`, escolhendo entre tokens do tema ativo; não
devem usar preto ou branco literais como fallback visual.
O `DatePickerField` também fica nessa área e converte escolhas do controle
nativo para datas civis no formato `YYYY-MM-DD` antes de devolvê-las ao
formulário.
Seletores visuais reutilizados por contas e categorias também permanecem nessa
área, com opções locais de ícones minimalistas Lucide e emojis, além de cinco
tons derivados do tema ativo, sem dependência de recursos remotos. Ícones
minimalistas são SVGs empacotados e recebem a cor resolvida pelos tokens ou
pela regra de contraste do tema ativo.
Cada conta e categoria persiste os dois valores e os exibe em conjunto: o ícone
sobre a cor escolhida. A escolha de um dos cinco tons predefinidos também
persiste seu índice, para que seja resolvida novamente ao tema ativo mudar;
cores da roda não recebem índice e permanecem imutáveis.
As demais cores ficam disponíveis exclusivamente em uma roda de tons e
controles de vivacidade e luminosidade. A escolha visual é convertida para uma
cor hexadecimal antes da persistência, sem expor esse formato técnico na
interface.

## Backup e restauração

O backup é iniciado manualmente na área Configurações e funciona inteiramente
offline. A exportação cria um único arquivo com a extensão `.hedge-backup` e
abre a folha nativa de compartilhamento, permitindo salvar no dispositivo ou
em qualquer aplicativo ou provedor de arquivos disponibilizado pelo sistema. A
restauração usa o seletor nativo de documentos e aceita um arquivo por vez.

O arquivo é um snapshot SQLite consistente, criado pelas APIs nativas de backup
e serialização do `expo-sqlite`, e contém as tabelas financeiras e as
preferências permitidas: tema, aparência, tema Custom e ocultação de saldos. Uma
tabela reservada, presente somente no artefato, registra a versão do formato, a
versão do schema, o instante UTC da exportação e a identidade do perfil e ledger.
Antes da serialização, a cópia remove outbox, base confirmada, recibos, cursor,
eventos aplicados, conflitos e checkpoints técnicos. Tokens e sessões nunca
integram o SQLite de backup. Essa tabela é validada e removida antes da
restauração; não integra o schema normal do aplicativo.

A restauração não sobrescreve o arquivo SQLite ativo. Após confirmação explícita,
o arquivo é desserializado em memória, tem formato, schema, preferências,
identidade vinculada e integridade validados, recebe migrações pendentes e é
copiado para um arquivo SQLite novo. Só então o registro de perfis passa a
apontar para essa nova geração; a geração anterior permanece preservada se a
importação for interrompida. Backups vinculados só restauram no mesmo perfil e
ledger; backups v1 continuam aceitos, são migrados e passam a ser um perfil local
isolado. Formatos ou schemas mais recentes que o aplicativo são rejeitados,
assim como arquivos corrompidos, metadados inválidos e arquivos com mais de 100
MB. A extensão é verificada antes da leitura e a integridade SQLite é verificada
antes de qualquer troca de seleção.

O backup não é criptografado, seguindo a decisão atual de usar SQLite padrão.
Como o arquivo sai do sandbox e contém dados financeiros, a interface informa
que ele deve ser guardado em local seguro. Backup automático, sincronização e
recebimento direto pela folha de compartilhamento de outro aplicativo ficam
fora deste fluxo inicial.

## Conta, sincronização e funcionamento offline

Operações financeiras com dados locais não dependerão de conexão. Portanto:

- login inicial, novo dispositivo e publicação de alterações exigem conexão,
  mas ausência de rede não bloqueia dados locais;
- cada mutação grava dados e comando de sincronização na mesma transação local;
- PostgreSQL recebe operações idempotentes por RPC, com RLS e versões esperadas;
- conflitos ficam preservados para revisão, sem última escrita por relógio;
- sincronização em segundo plano é oportunista e retomável;
- fontes, imagens e demais recursos serão incluídos no pacote;
- não serão instalados analytics ou relatórios remotos de falhas;
- o EAS Update não será configurado para atualizações durante a execução;
- gráficos financeiros serão renderizados no dispositivo com `react-native-svg`;
- builds e publicação podem usar internet, mas o aplicativo produzido deve
  continuar funcional sem ela.

Cada perfil local usa um arquivo SQLite próprio. O arquivo legado `hedge.db`
torna-se o primeiro perfil sem mover os dados existentes; novos perfis recebem
nomes internos aleatórios que não incorporam entrada do usuário. Um registro
mínimo no `expo-sqlite/kv-store` relaciona os IDs de perfil aos arquivos e indica
qual está ativo. A troca só grava a nova seleção depois que o arquivo de destino
foi aberto, migrado, verificado e teve sua identidade conferida; se qualquer
etapa falhar, a seleção e a conexão atuais permanecem inalteradas. O
`DatabaseProvider` remonta a
conexão depois do commit dessa seleção e expõe criação, listagem e troca aos
fluxos de identidade futuros, sem manter dados financeiros em Context.

`src/db/sync` implementa a reconciliação local antes da existência do servidor.
Comandos usam IDs idempotentes, versões esperadas e dependências; leases vencidos
voltam à fila após reinício. Recibos aceitos atualizam a base confirmada e
removem o comando, enquanto rejeições mantêm o payload original e geram um
conflito revisável. Propostas rejeitadas continuam protegendo a projeção até uma
decisão explícita. A revisão classifica edição, exclusão, arquivamento e troca de
categoria concorrentes; aceitar o remoto aplica a base confirmada, enquanto
manter o local cria um novo comando contra a versão remota observada e reescreve
as dependências. Um evento baixado atualiza a projeção somente quando não há
proposta local pendente ou rejeitada para a mesma entidade; caso haja, a base
confirmada avança e a pendência é rebaseada. Eventos repetidos são ignorados e o
cursor do lote só é salvo depois da aplicação. O transporte atual existe apenas em memória
para testar perda, duplicação, reordenação e interrupção; nenhum dado sai do
dispositivo nesta etapa.

Se “offline” também precisar impedir backups do sistema operacional, isso será
tratado como uma decisão de privacidade separada antes da distribuição.

## Segurança

Na fase inicial será usado o SQLite padrão, protegido pelo sandbox e pelos
mecanismos do dispositivo. Isso não representa criptografia própria do banco.

Nesta fase não adotamos SQLCipher nem criptografia ponta a ponta. A sessão local
é cifrada com AES-GCM, com uma chave por perfil no SecureStore e ciphertext
separado no `expo-sqlite/kv-store`; o payload é associado ao perfil como dado
autenticado. Logout, expiração, chave ausente ou ciphertext inválido removem
somente esses artefatos de sessão, sem apagar banco financeiro, outbox ou cursor.
O SQLite continua protegido pelo sandbox do dispositivo. RLS, RPCs e isolamento
por usuário continuam requisitos para a fase remota.

## Testes

Testes serão colocados próximos ao código testado com os sufixos `.test.ts` ou
`.test.tsx`. A ferramenta adotada é Jest com o preset `jest-expo`, que fornece
uma base compatível com módulos Expo. A prioridade será dada a cálculos
financeiros, conversão de valores, validações, repositórios e migrações.

Testes de infraestrutura SQLite usam `src/db/testDatabase.ts`, um adapter
exclusivo de testes sobre `node:sqlite`. Ele cria bancos em memória para o
executor e bancos temporários em arquivo para validar `WAL`, `foreign_keys`,
migrações e schema real. Essa ferramenta não é importada pelo aplicativo e não
é uma dependência de runtime. O ambiente de desenvolvimento precisa de Node.js
22.5 ou superior para executar essa parte da suíte.

## Medição local antes da nuvem

As fixtures e helpers em `src/db/benchmarks` estabelecem datasets determinísticos
de 1 mil, 10 mil e 50 mil lançamentos sem serem importados pela interface de
produção. O [protocolo de medição local](local-sync-benchmark.md) define a coleta
em aparelhos físicos para abertura, commit, memória, rolagem e feedback. Os
contratos executáveis de comando, recibo, evento, snapshot, conflito e cursor
ficam em `src/domain/sync`; são puros. As Etapas 4 e 5 usam esses contratos apenas no
SQLite e em um transporte simulado, sem ativar sincronização remota.

## Dependências deliberadamente excluídas

Não fazem parte da arquitetura inicial:

- ORM;
- biblioteca de estado global;
- biblioteca de busca/cache de servidor;
- biblioteca de componentes ou CSS utilitário;
- biblioteca de datas;
- biblioteca genérica de validação;
- framework de injeção de dependências;
- cliente de API;
- monorepo.

Uma nova dependência só deve ser adicionada quando uma API nativa ou já
instalada não resolver adequadamente o problema e quando a redução de
complexidade for maior que seu custo de configuração e manutenção. Dependências
que mudem limites arquiteturais devem ser registradas neste documento.
