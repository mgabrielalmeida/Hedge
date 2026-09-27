# Plano de implementação: conta, nuvem e sincronização offline

**Data:** 27 de setembro de 2026  
**Status:** preparação documental; sincronização ainda não implementada

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

## Etapa 1 — Medição e contratos locais

Criar fixtures com 1 mil, 10 mil e 50 mil lançamentos e medir abertura, commit,
memória, rolagem e atualização da interface em aparelhos físicos. Definir tipos
executáveis para comando, recibo, evento, snapshot, conflito e cursor. Registrar
matriz de falhas, estados de sessão e critérios de desempenho.

**Aceite:** referência reproduzível; commit local p95 até 100 ms e feedback até
200 ms, ou correção planejada antes do próximo marco; contratos não dependem de UI.

## Etapa 2 — Isolamento da persistência e desempenho

Concentrar o acesso ao SQLite em `src/db`; retirar imports diretos de telas;
auditar `last_insert_rowid`, transações e validações. Criar consultas paginadas,
índices e agregações locais; virtualizar o histórico e invalidar somente dados
afetados. Processar recorrências em lotes recuperáveis sem exibir saldo parcial.

**Aceite:** resultados financeiros equivalentes, nenhuma tela carrega toda a base
para uma página, e operações locais não dependem de rede.

## Etapa 3 — Identidade global e perfis locais

Adicionar migrações sequenciais para `sync_id`, versão, tombstone, perfil,
`ledger_id` e geração. Gerar identidades uma única vez para dados existentes,
preservar relações e criar cópia de recuperação em disco. Separar banco por perfil
e tornar troca de perfil atômica.

**Aceite:** bases antigas migram sem duplicar IDs; valores, relações e saldos são
preservados; interrupção e retomada são seguras; backups v1 continuam importáveis.

## Etapa 4 — Outbox e reconciliação sem servidor

Criar `src/db/sync` com outbox, base confirmada, projeção, recibos, cursor e
conflitos. Toda mutação — transferência, saldo inicial, arquivamento, exclusão e
recorrência — deve registrar dados e comando atomicamente. Implementar dependências,
leases, rebase de pendências e aplicação idempotente de eventos. Usar transporte
simulado que perca, duplique, reordene e interrompa mensagens.

**Aceite:** reinício não perde comandos; downloads não sobrescrevem pendências;
reenvio não duplica efeitos; rejeições preservam a proposta e não bloqueiam
operações independentes.

## Etapa 5 — Recorrências e conflitos financeiros

Usar identidade `regra + data` para ocorrência e lançamento gerado; deduplicar em
transação. Persistir fuso financeiro do conjunto, checkpoints e lotes. Incrementar
versão financeira da conta em toda movimentação. Retificação de saldo deve detectar
alterações concorrentes. Criar revisão explícita para edição, exclusão, arquivamento
e categoria concorrentes.

**Aceite:** dois dispositivos simulados geram uma ocorrência; pausa, retomada,
fim de mês e ano bissexto permanecem corretos; retificação desatualizada nunca
altera o saldo silenciosamente.

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
