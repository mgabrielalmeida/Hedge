# Plano de implementação: conta, nuvem e sincronização offline

**Data:** 27 de setembro de 2026  
**Status:** Etapas 0, 2, 3 e 4 concluídas; Etapa 1 concluída provisoriamente sem evidências físicas; transporte remoto ainda não implementado

Este plano mantém o SQLite como base usada pela interface. PostgreSQL será o
estado compartilhado confirmado, e a rede jamais participará do caminho crítico
de salvar uma despesa, consultar um saldo ou abrir o histórico.

## Decisões

- Supabase Auth para conta, inicialmente com código de uso único por e-mail.
- PostgreSQL Supabase em São Paulo, protegido por RLS e RPCs transacionais.
- `@supabase/supabase-js` será o único cliente remoto do app.
- IDs inteiros existentes permanecem locais; cada entidade receberá `sync_id`
  imutável. Ocorrências recorrentes usarão identidade determinística por regra e data.
- Cada escrita local e sua operação de outbox serão confirmadas na mesma transação.
- O servidor usará idempotência, versões esperadas, dependências, tombstones e
  cursor incremental. Conflitos serão apresentados para revisão, sem last-write-wins.
- Preferências visuais permanecem locais. Backup vinculado cria uma nova geração;
  não sobrescreve fisicamente um banco sincronizado.
- Tarefas de fundo são oportunistas. App fechado pode sincronizar somente quando
  o sistema operacional conceder uma janela.

## Etapa 0 — Preparação do repositório

Atualizar `AGENTS.md`, arquitetura, MVP e README; manter as migrações SQLite
existentes congeladas; instalar SDKs e registrar variáveis públicas apenas em
`.env.example`; configurar plugins nativos e CLI Supabase como devDependency.

**Aceite:** documentação coerente, dependências resolvidas, nenhuma credencial
versionada, typecheck/lint/testes aprovados e nenhum envio remoto ativado.

**Evidência de conclusão — 27 de setembro de 2026:** `AGENTS.md`,
`architecture.md`, `mvp.md` e `README.md` descrevem a mesma transição: dados
financeiros permanecem locais e offline, enquanto conta e sincronização ainda
não estão ativas. A migração `001_initial_schema.ts` foi restaurada exatamente
ao contrato publicado, com os orçamentos iniciais das categorias em zero; não
foi criada uma migração compensatória porque não existe forma segura de
distinguir um orçamento zero original de uma escolha posterior do usuário. As
dependências Expo compatíveis foram atualizadas e `npm run check:expo`,
`npm run typecheck`, `npm run lint` e `npm test -- --runInBand` passaram
(26 suítes e 128 testes). Apenas `.env.example` é versionado, e nenhum módulo
de infraestrutura remota é importado pelo aplicativo.

## Etapa 1 — Medição e contratos locais

Criar fixtures com 1 mil, 10 mil e 50 mil lançamentos e medir abertura, commit,
memória, rolagem e atualização da interface em aparelhos físicos. Definir tipos
executáveis para comando, recibo, evento, snapshot, conflito e cursor. Registrar
matriz de falhas, estados de sessão e critérios de desempenho.

**Aceite:** referência reproduzível; commit local p95 até 100 ms e feedback até
200 ms, ou correção planejada antes do próximo marco; contratos não dependem de UI.

**Conclusão excepcional sem evidência física — 27 de setembro de 2026:** fixtures determinísticas
para 1 mil, 10 mil e 50 mil lançamentos, seeding transacional e cálculo de p95
estão em `src/db/benchmarks`; os contratos executáveis e puros estão em
`src/domain/sync/contracts.ts`; o protocolo, matriz de falhas e estados de
sessão estão em `local-sync-benchmark.md`. Por decisão explícita, a Etapa 1 é
considerada concluída provisoriamente sem a coleta física. A pendência permanece
aberta: este ambiente não possui `adb` nem aparelho físico conectado, portanto
ainda não há medidas reais de abertura, commit, feedback, memória ou rolagem.
Essas evidências devem ser preenchidas antes do Marco A.

## Etapa 2 — Isolamento da persistência e desempenho

Concentrar o acesso ao SQLite em `src/db`; retirar imports diretos de telas;
auditar `last_insert_rowid`, transações e validações. Criar consultas paginadas,
índices e agregações locais; virtualizar o histórico e invalidar somente dados
afetados. Processar recorrências em lotes recuperáveis sem exibir saldo parcial.

**Aceite:** resultados financeiros equivalentes, nenhuma tela carrega toda a base
para uma página, e operações locais não dependem de rede.

**Evidência de conclusão — 28 de setembro de 2026:** `DatabaseProvider` e
`useDatabase` passaram a ser as únicas portas React para o SQLite; não há
imports de `expo-sqlite`, SQL ou API direta do driver em `src/app` ou
`src/features`. O histórico usa `FlatList` virtualizada e páginas de até 50
lançamentos por cursor composto de data e ID. Dashboard e detalhe de categoria
usam agregações e recortes SQL, sem materializar a tabela inteira para calcular
saldos, gastos ou projeções. A migração sequencial
`008_query_performance_indexes.ts` acrescenta índices para essas leituras sem
alterar as migrações publicadas. O uso de `last_insert_rowid()` foi eliminado em
favor de `INSERT ... RETURNING`; entradas e cursores são validados nos
repositórios. Recorrências são confirmadas em lotes transacionais retomáveis; a
interface só é notificada ao fim de uma execução bem-sucedida, portanto uma
interrupção não publica um saldo intermediário. A notificação inclui as
ocorrências geradas, permitindo que telas sem contas ou categorias afetadas
ignorem a invalidação. Testes cobrem paginação,
equivalência de saldos com transferências, agregações, índices, interrupção e
retomada idempotente. `npm run typecheck`, `npm run lint`,
`npm test -- --runInBand` (31 suítes e 141 testes) e `git diff --check`
passaram. Nenhum módulo remoto participa dessas operações.

## Etapa 3 — Identidade global e perfis locais

Adicionar migrações sequenciais para `sync_id`, versão, tombstone, perfil,
`ledger_id` e geração. Gerar identidades uma única vez para dados existentes,
preservar relações e criar cópia de recuperação em disco. Separar banco por perfil
e tornar troca de perfil atômica.

**Aceite:** bases antigas migram sem duplicar IDs; valores, relações e saldos são
preservados; interrupção e retomada são seguras; backups v1 continuam importáveis.

**Evidência de conclusão — 28 de setembro de 2026:** as migrações sequenciais 9
e 10 acrescentam `sync_id` imutável, `sync_version` e tombstone às cinco
entidades sincronizáveis, além do singleton `local_profile` com `profile_id`,
`ledger_id` e `generation`. O preenchimento ocorre uma única vez dentro da
transação da migração; ocorrências existentes e futuras usam identidade
determinística por regra e data. Antes de migrar uma base entre as versões 1 e
8, a inicialização grava no diretório SQLite uma cópia
`*.pre-global-identity.v8.recovery.db`. Testes executam a migração sobre dados
legados relacionados, comparam o saldo antes e depois, simulam interrupção com
rollback e retomada e verificam a imutabilidade e unicidade dos IDs.

O arquivo legado `hedge.db` é registrado como primeiro perfil. Novos perfis usam
arquivos SQLite separados; o registro local valida perfil, ledger e geração. A
troca prepara, verifica a integridade e confere a identidade do banco de destino
antes de persistir a seleção ativa,
mantendo o perfil anterior quando a abertura, migração ou validação falha. O
`DatabaseProvider` remonta a conexão somente após essa confirmação. O fluxo de
restauração continua aceitando backups no formato 1 com schema anterior e aplica
as novas migrações antes da substituição. `npm run check:expo`,
`npm run typecheck`, `npm run lint`, `npm test -- --runInBand` (35 suítes e 152
testes) e `git diff --check` passaram.
Nenhum módulo remoto ou envio de dados foi ativado.

## Etapa 4 — Outbox e reconciliação sem servidor

Criar `src/db/sync` com outbox, base confirmada, projeção, recibos, cursor e
conflitos. Toda mutação — transferência, saldo inicial, arquivamento, exclusão e
recorrência — deve registrar dados e comando atomicamente. Implementar dependências,
leases, rebase de pendências e aplicação idempotente de eventos. Usar transporte
simulado que perca, duplique, reordene e interrompa mensagens.

**Aceite:** reinício não perde comandos; downloads não sobrescrevem pendências;
reenvio não duplica efeitos; rejeições preservam a proposta e não bloqueiam
operações independentes.

**Evidência de conclusão — 28 de setembro de 2026:** a migração sequencial 11
cria a outbox persistente, base confirmada, recibos, cursor, registro idempotente
de eventos e conflitos por perfil SQLite. Entidades existentes são transformadas
em comandos iniciais com versões e dependências; uma interrupção reverte schema
e preenchimento juntos. As mutações de contas, categorias, lançamentos, regras e
ocorrências agora confirmam a projeção local e o comando na mesma transação.
Exclusões sincronizáveis usam tombstones, sem voltar a participar de saldos ou
consultas visíveis.

O coordenador local adquire leases expirantes, reenvia comandos com o mesmo ID,
persiste recibos, mantém propostas rejeitadas, registra conflitos e rebaseia a
versão esperada das pendências sobre a base confirmada sem substituir a projeção
local. Eventos repetidos são ignorados pelo ID; o cursor autoritativo do lote só
avança depois da aplicação. O transporte em memória simula resposta perdida,
duplicação, reordenação e interrupção. Testes cobrem reabertura do arquivo,
recuperação de lease, rollback da mutação quando a outbox falha, dependências de
transferência e recorrência, reenvio idempotente, evento remoto concorrente e
rejeição que não bloqueia comando independente. `npm run check:expo`,
`npm run typecheck`, `npm run lint`, `npm test -- --runInBand` (37 suítes e 161
testes) e `git diff --check` passaram. Nenhum servidor, cliente Supabase ou envio
de rede foi ativado.

## Etapa 5 — Recorrências e conflitos financeiros

Usar identidade `regra + data` para ocorrência e lançamento gerado; deduplicar em
transação. Persistir fuso financeiro do conjunto, checkpoints e lotes. Incrementar
versão financeira da conta em toda movimentação. Retificação de saldo deve detectar
alterações concorrentes. Criar revisão explícita para edição, exclusão, arquivamento
e categoria concorrentes.

**Aceite:** dois dispositivos simulados geram uma ocorrência; pausa, retomada,
fim de mês e ano bissexto permanecem corretos; retificação desatualizada nunca
altera o saldo silenciosamente.

**Evidência de conclusão — 29 de setembro de 2026:** a migração sequencial 12
persiste o fuso financeiro imutável do ledger, lotes retomáveis e checkpoints
por regra. Ocorrência e lançamento gerado usam identidades determinísticas
derivadas de `regra + data`; a migração converte lançamentos recorrentes antigos
e suas referências locais sem alterar as migrações publicadas. A restrição única
e a transação de geração impedem duplicação no mesmo banco, enquanto o transporte
simulado confirma apenas uma ocorrência quando dois bancos com a mesma regra a
geram independentemente.

Contas agora possuem uma versão financeira preenchida para dados existentes e
incrementada pelo SQLite em toda criação, edição ou tombstone de movimentação,
inclusive nas duas contas de uma transferência. A tela envia a versão que leu;
uma retificação obsoleta aborta antes de modificar conta ou saldo e apresenta
recuperação explícita. Propostas rejeitadas não são mais sobrescritas pelo pull.
Conflitos são classificados para revisão de edição, exclusão, arquivamento e
categoria, podendo aceitar o remoto ou reenfileirar a proposta local sobre a
versão observada.

Testes cobrem migração e backfill, identidades determinísticas, dois dispositivos
simulados, interrupção e retomada do mesmo lote, checkpoints, pausa e retomada,
fim de mês, ano bissexto, incrementos de versão, retificação concorrente e as
quatro classes de revisão. `npm run typecheck`, `npm run lint`,
`npm test -- --runInBand` (40 suítes e 171 testes) e `git diff --check` passaram.
`npm run check:expo` executou, mas apontou atualizações patch já pendentes para
Expo e seis módulos oficiais; nenhuma dependência foi alterada fora do escopo da
etapa. Nenhum schema PostgreSQL, cliente remoto ou envio de rede foi ativado; o
Marco A permanece bloqueado pela Etapa 6 e pelas evidências externas já
registradas.

## Etapa 6 — Backup, sessão e recuperação local

Restringir backup a dados financeiros e preferências permitidas; excluir tokens,
fila e cursores. Importar em banco isolado, validar integridade e trocar por nova
geração. Implementar sessão cifrada com AES-GCM, chave no SecureStore e payload
separado. Testar logout, troca de perfil, chave ausente e sessão expirada.

**Aceite:** backup corrompido/futuro/malicioso não altera o banco; restauração
interrompida recupera a versão anterior; sessão perdida não apaga dados ou fila.

## Marco A — bloqueio antes do PostgreSQL

Só iniciar o schema remoto quando as etapas 1–6 tiverem evidência de aceite,
outbox atômica, identidades globais, reconciliação, recorrências concorrentes,
backup seguro, isolamento de perfis, Docker disponível, CLI Supabase executável
e development builds Android/iOS disponíveis. Nenhum dado deve ser enviado antes.

## Etapa 7 — PostgreSQL local e autorização

Inicializar `supabase/` com Docker; criar migrações Postgres para ledger, geração,
entidades, versões, recibos, eventos e conflitos. Usar `BIGINT` monetário, `DATE`
para datas civis e `TIMESTAMPTZ` técnico. Implementar RLS, grants mínimos e RPCs
que validem `auth.uid()`, pertença, geração e payload. Testar pgTAP, rollback,
concorrência, locks, idempotência e cursor na ordem de commit.

**Aceite:** outro usuário, anônimo e escrita direta não acessam dados; falha
reverte todos os efeitos; concorrência não duplica nem perde lançamentos.

## Etapa 8 — Conta e primeiro vínculo

Implementar `src/auth` e `src/features/identity`, OTP, renovação serializada,
logout e importação retomável. Carga remota usa staging e só mostra saldo após
snapshot completo. Se houver dados remotos, exigir escolha explícita; não deduplicar
lançamentos por nome, data ou valor.

**Aceite:** instalação offline continua funcional; OTP, expiração e novo dispositivo
funcionam em aparelhos físicos; importação interrompida retoma sem duplicar.

## Etapa 9 — Transporte real e interface

Criar `src/sync/client.ts` e coordenador de pull/push com lotes, backoff e rede
observada por `expo-network`. Expor estados atualizado, pendente, offline e revisão.
Cancelar requests ao trocar perfil e preservar formulário/rolagem.

**Aceite:** dois aparelhos convergem após uso offline; 401, 429, 5xx e resposta
perdida preservam fila; sync não degrada as metas de UI.

## Etapa 10 — Fundo, restauração e ciclo da conta

Registrar tarefa Expo oportunista, usando a mesma fila. Publicar restauração como
nova geração; recusar comandos de gerações encerradas. Implementar saída com
pendências e exclusão autenticada idempotente.

**Aceite:** app encerrado apenas adia sincronização; restauração interrompida é
recuperável; logout/exclusão não vazam dados nem ressuscitam o conjunto.

## Etapa 11 — Homologação e liberação

Separar projetos de homologação e produção, configurar SMTP Resend no servidor,
CI com testes SQL e app, limites e backups. Medir bases grandes, rede lenta,
conflitos e recuperação. Liberar gradualmente com protocolo compatível entre
versões e capacidade de pausar sync sem perder dados locais.

**Aceite:** builds assinados, RLS e segredos revisados, recuperação ensaiada,
desempenho medido e documentação atualizada com evidências reais.

## Matriz mínima de testes

Modo avião + reinício; resposta perdida após commit; dois dispositivos editando;
relógios divergentes; transferência parcial; saldo inicial; retificação concorrente;
ocorrência duplicada; token expirado; logout durante tarefa; geração restaurada;
backup inválido; isolamento entre usuários; app encerrado sem execução em fundo.

Docker, projetos Supabase, SMTP e credenciais de produção não fazem parte desta
preparação. O valor do serviço e seus custos devem ser confirmados na contratação.
