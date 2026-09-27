# Orientações para o repositório

## Fonte arquitetural

- Leia `docs/architecture.md` antes de alterar a estrutura ou introduzir uma
  dependência.
- Para a fase de conta e nuvem, leia também `docs/cloud-sync-implementation-plan.md`.
  Conclua as etapas locais e o marco de prontidão desse plano antes de iniciar
  o schema PostgreSQL ou enviar dados financeiros.
- Atualize `docs/architecture.md` quando uma mudança alterar a stack, os limites
  entre módulos, a política offline, a persistência ou o gerenciamento de
  estado.
- Não crie pastas genéricas como `services`, `store`, `hooks`, `types` ou
  `helpers` sem uma necessidade concreta e uma responsabilidade bem definida.
- Remova o `.gitkeep` de uma pasta quando ela receber seu primeiro arquivo real.

## Limites entre módulos

- Mantenha rotas em `src/app` pequenas: elas compõem telas, leem parâmetros e
  acionam funcionalidades. Não coloque nelas SQL, cálculos financeiros ou
  regras de persistência.
- Mantenha `src/domain` puro. Ele não pode importar React, React Native, Expo,
  Expo Router ou SQLite.
- Restrinja consultas SQL e acesso direto ao `expo-sqlite`, inclusive ao
  `kv-store`, a `src/db`. Os demais módulos devem usar repositórios ou pequenos
  adaptadores expostos por essa camada.
- Faça repositórios retornarem modelos do domínio, não linhas ou tipos internos
  do driver SQLite.
- Não importe detalhes internos de uma funcionalidade em outra. Extraia apenas
  código comprovadamente compartilhado para `domain` ou `components`.
- Mantenha componentes compartilhados independentes do banco de dados.

## Persistência e domínio financeiro

- Trate o SQLite como fonte de verdade. Não mantenha uma cópia global de contas,
  categorias ou lançamentos em Context ou outro store.
- Grave cada mutação financeira e seu comando de sincronização na mesma
  transação SQLite. A interface confirma o commit local sem aguardar rede.
- Preserve IDs locais e acrescente identidades globais imutáveis no protocolo.
  Use idempotência, versões esperadas, dependências e marcadores de exclusão;
  não resolva conflitos por timestamps do dispositivo.
- Use valores monetários inteiros em centavos; não use ponto flutuante para
  dinheiro.
- Use `YYYY-MM-DD` para datas civis e ISO 8601 em UTC para instantes técnicos.
- Use parâmetros vinculados em consultas; nunca concatene entrada do usuário em
  SQL.
- Use uma transação quando uma operação exigir várias escritas relacionadas.
- Ative `foreign_keys` e `WAL` na inicialização de cada conexão aplicável.
- Crie migrações pequenas, sequenciais e versionadas. Não altere uma migração já
  publicada ou aplicada; crie uma nova migração.
- Não decida implicitamente sem requisito questões como sinal dos valores,
  transferências, saldo inicial, exclusão de registros, recorrência ou formato
  de identificadores.

## Estado, interface e temas

- Prefira `useState` e `useReducer` para estado temporário de tela.
- Use React Context somente para estado pequeno e transversal, inicialmente tema
  e preferências.
- Use tokens semânticos do tema em componentes. Não espalhe cores literais pela
  interface.
- Mantenha tema visual e aparência clara, escura ou do sistema como dimensões
  separadas.

## Offline e dependências

- Preserve operações financeiras offline. A rede não pode bloquear abertura,
  navegação ou salvamento; autenticação e sincronização são assíncronas.
- A stack remota aceita nesta fase é Supabase Auth + PostgreSQL, com RPCs
  transacionais e protocolo próprio. Instalar SDKs não ativa envio de dados.
- Concentre sessão em `src/auth`, sincronização em `src/sync`, fila e projeção em
  `src/db/sync`, e backend em `supabase`. Rotas e telas não acessam Supabase.
- Nunca inclua service role, secret keys, senha de banco, SMTP ou tokens em
  `EXPO_PUBLIC_*`, backups ou logs. Sessões devem usar armazenamento cifrado.
- Sincronização em segundo plano é oportunista; não prometa execução imediata.
- Não configure EAS Update sem uma revisão explícita desta decisão arquitetural.
- Considere somente Android e iOS; suporte web está fora do escopo inicial.
- Prefira APIs do React Native, JavaScript e Expo às dependências externas.
- Adicione uma dependência somente diante de uma necessidade concreta e depois
  de verificar que seu benefício supera o custo de configuração e manutenção.
- Instale pacotes do ecossistema Expo com `npx expo install` para preservar a
  compatibilidade das versões.

## Convenções e qualidade

- Mantenha identificadores, nomes de arquivos e código em inglês.
- Coloque testes próximos ao módulo testado usando o sufixo `.test.ts` ou
  `.test.tsx`.
- Priorize testes para cálculos financeiros, conversões monetárias, validações,
  repositórios e migrações.
- Teste reenvios, interrupções, conflitos, recorrências em dois dispositivos,
  isolamento de usuários e restauração com clientes antigos antes da liberação.
- Preserve alterações não relacionadas já existentes no repositório.
