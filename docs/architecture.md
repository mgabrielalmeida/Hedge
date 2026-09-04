# Arquitetura do Hedge

**Status:** aceita  
**Data:** 1 de setembro de 2026

Este documento registra as decisões iniciais de arquitetura do Hedge. Ele deve
ser atualizado quando uma decisão estrutural for alterada. O objetivo não é
antecipar todas as necessidades futuras, mas estabelecer limites simples para
que o aplicativo continue compreensível à medida que crescer.

## Objetivos arquiteturais

1. Manter o desenvolvimento acessível para uma pessoa com pouca experiência.
2. Fazer todas as funcionalidades do aplicativo operarem sem internet.
3. Usar o menor número razoável de dependências e abstrações.
4. Preservar a correção dos cálculos e dos dados financeiros.
5. Permitir múltiplos temas sem acoplar componentes a cores específicas.

Não são objetivos iniciais: versão web, backend, contas de usuário,
sincronização entre dispositivos, colaboração, plugins ou uma arquitetura
distribuída.

## Stack decidida

| Área | Decisão |
| --- | --- |
| Plataformas | Android e iOS |
| Aplicativo | Expo no fluxo gerenciado e React Native |
| Linguagem | TypeScript com modo estrito |
| Navegação | Expo Router |
| Persistência | `expo-sqlite`, usando sua API diretamente |
| Estilos | `StyleSheet` do React Native |
| Estado local | `useState` e `useReducer` |
| Estado global | React Context apenas para tema e configurações pequenas |
| Preferências | `expo-sqlite/kv-store` |
| Testes | Jest com `jest-expo` |
| Lint | ESLint com `eslint-config-expo` |
| Dados remotos | Nenhum |

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
    │   ├── migrations/        # Alterações sequenciais do schema
    │   └── repositories/      # Único acesso aos dados financeiros
    ├── domain/
    │   ├── calculations/      # Cálculos financeiros puros
    │   └── models/            # Tipos e conceitos do domínio
    ├── features/
    │   ├── accounts/          # Casos de uso e UI específicos de contas
    │   ├── categories/        # Casos de uso e UI específicos de categorias
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
As áreas principais são Início, Histórico, Categorias, Contas e Aparência; a
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

Também abriga adaptadores pequenos para armazenamento local auxiliar. O
`preferences.ts` encapsula o `expo-sqlite/kv-store`; nenhum outro módulo acessa
esse storage diretamente.

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
e atualizarão o resultado após uma escrita relevante. Uma solução de cache ou
reatividade só será adicionada se esse modelo demonstrar uma limitação real.

As seguintes regras foram decididas:

- valores monetários serão armazenados como `INTEGER` em centavos;
- `REAL` não será usado para dinheiro;
- datas civis serão textos no formato `YYYY-MM-DD`;
- instantes técnicos, quando necessários, serão ISO 8601 em UTC;
- chaves estrangeiras serão ativadas com `PRAGMA foreign_keys = ON`;
- o banco usará `PRAGMA journal_mode = WAL`;
- consultas receberão valores por parâmetros, nunca por concatenação de texto;
- operações com várias escritas relacionadas usarão transações;
- o schema evoluirá por migrações pequenas, sequenciais e versionadas;
- as migrações serão executadas durante o `onInit` do `SQLiteProvider`.

O [schema v1](database-schema-v1.md) está congelado na primeira migração. Ele
usa tabelas `STRICT` para contas, categorias, lançamentos, regras recorrentes e
ocorrências recorrentes. Identificadores são inteiros locais, saldos são
derivados dos lançamentos e transferências são representadas por uma única
linha com conta de origem e destino.

Regras recorrentes usam exclusão lógica para preservar procedência. Uma tabela
de ocorrências registra cada data processada mesmo depois da exclusão do
lançamento gerado, evitando geração duplicada. A migração 1 não deve ser
alterada depois de aplicada; mudanças futuras exigem novas migrações.

## Estado da interface

Estado temporário de tela, como campos de formulário e abertura de modais,
permanece local com hooks do React. React Context será usado somente para dados
pequenos e realmente transversais, inicialmente tema e preferências.

Redux, Zustand, React Query e bibliotecas equivalentes não fazem parte da
arquitetura inicial.

## Temas

Tema visual e aparência do sistema serão dimensões separadas:

- **tema:** Hedge, Oceano, Pôr do sol, Amora, Rosa, Areia, Meia-noite ou outro
  conjunto futuro;
- **aparência:** clara, escura ou acompanhar o sistema.

Um tema fornece tokens semânticos de cor, incluindo `background`, `surface`,
`surfaceElevated`, `surfaceSubtle`, `text`, `textMuted`, `primary`,
`onPrimary`, contêineres de destaque, bordas, foco, estados positivo,
negativo, de atenção e informativo, além dos tokens compartilhados de
espaçamento, raio e tipografia. O provider resolve tema e aparência para um
conjunto final de tokens. Os temas disponíveis são Hedge, Oceano, Pôr do sol,
Amora, Rosa, Areia e Meia-noite; todos oferecem variantes clara e escura para
validar que componentes não dependem de uma paleta específica.

A seleção é armazenada no `expo-sqlite/kv-store` pelo adaptador
`src/db/preferences.ts`. Essa é a única área autorizada a acessar o storage
diretamente: o `ThemeProvider` consome sua API tipada, aplica os padrões para
dados inválidos ou indisponíveis e expõe gravações que informam falha sem gerar
rejeições não observadas. Inicialmente, temas podem alterar cores e propriedades
visuais pequenas, mas não a estrutura ou o espaçamento fundamental das telas.

Os componentes compartilhados mínimos são `Screen`, `Text`, `Card`, `Field` e
`Button`. Eles ficam em `src/components`, recebem suas decisões visuais do
tema e não têm conhecimento de funcionalidades ou do banco de dados.
Seletores visuais reutilizados por contas e categorias também permanecem nessa
área, com opções locais de ícones e cores e sem dependência de recursos remotos.
Além das cores predefinidas, esses seletores oferecem uma roda de tons e
controles de vivacidade e luminosidade. A escolha visual é convertida para uma
cor hexadecimal antes da persistência, sem expor esse formato técnico na
interface.

## Funcionamento offline

O aplicativo instalado não dependerá de conexão de rede. Portanto:

- não haverá backend, autenticação remota ou cliente HTTP;
- fontes, imagens e demais recursos serão incluídos no pacote;
- não serão instalados analytics ou relatórios remotos de falhas;
- o EAS Update não será configurado para atualizações durante a execução;
- builds e publicação podem usar internet, mas o aplicativo produzido deve
  continuar funcional sem ela.

Se “offline” também precisar impedir backups do sistema operacional, isso será
tratado como uma decisão de privacidade separada antes da distribuição.

## Segurança

Na fase inicial será usado o SQLite padrão, protegido pelo sandbox e pelos
mecanismos do dispositivo. Isso não representa criptografia própria do banco.

Antes de uma distribuição pública, será tomada uma decisão explícita sobre
SQLCipher e armazenamento da chave com `expo-secure-store`. Essa decisão está
adiada porque altera o fluxo de build e a gestão de chaves; ela não deve ser
introduzida silenciosamente durante outra funcionalidade.

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
