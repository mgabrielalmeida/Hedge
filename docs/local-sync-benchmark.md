# Referência de medição local para sincronização

**Status:** pronta para coleta em aparelhos físicos
**Data:** 29 de setembro de 2026

Este protocolo cria uma linha de base antes de introduzir identidade global,
outbox ou rede. Ele mede exclusivamente o caminho local do SQLite: não requer
conta, Supabase, conexão ou credencial.

## Dataset e código reproduzível

As fixtures determinísticas estão em `src/db/benchmarks/fixtures.ts` e contêm
exatamente 1.000, 10.000 e 50.000 despesas. Cada conjunto usa uma conta de
benchmark, as cinco categorias iniciais e datas civis no intervalo de 2024 a
2025. `seedBenchmarkFixture` insere a conta e todos os lançamentos em uma única
transação, para que a preparação não seja confundida com o custo de commits
usuais da interface.

O helper `measureLocalCommit` recebe a operação local real, coleta 30 amostras
com `performance.now()` e informa o percentil 95. A operação medida deve ser a
criação de uma despesa pela mesma função de repositório usada pela tela, depois
que a fixture já estiver persistida.

## Procedimento em aparelho físico

1. Use uma development build Android ou iOS de perfil de desenvolvimento, sem
   depurador remoto e com o aparelho ligado à energia.
2. Registre modelo, sistema operacional, versão do Hedge, modo de energia e
   espaço livre. Feche outros aplicativos antes de cada conjunto.
3. Para cada tamanho, crie um banco novo, aplique migrações, execute a fixture
   uma vez e encerre/reabra o aplicativo. Repita três vezes por aparelho.
4. Meça a abertura do banco do início da inicialização até a primeira consulta
   de histórico pronta; execute 30 criações de despesa e registre p95 de commit
   e o instante do feedback visual; role o histórico do início ao fim e de volta.
5. Capture memória máxima pelo Android Studio Memory Profiler ou Xcode
   Instruments durante a rolagem. Capture FPS/jank pelo profiler nativo, não
   por estimativa visual. Anexe screenshots ou exportações ao registro da
   execução.

| Base | Abertura mediana | Commit p95 | Feedback p95 | Memória máxima | FPS/jank de rolagem | Dispositivo e evidência |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| 1.000 | pendente | pendente | pendente | pendente | pendente | pendente |
| 10.000 | pendente | pendente | pendente | pendente | pendente | pendente |
| 50.000 | pendente | pendente | pendente | pendente | pendente | pendente |

## Critérios e decisões de desempenho

- Commit local p95: até 100 ms.
- Feedback visual após confirmar o commit local: até 200 ms.
- Abertura, memória e rolagem não recebem uma meta numérica nesta etapa; a
  referência coletada define o orçamento antes de otimizações da Etapa 2.
- Se qualquer limite de commit ou feedback falhar, a Etapa 2 deve registrar a
  causa, a correção proposta, o dono e nova medição antes do Marco A.

## Matriz de falhas local

| Situação | Resultado local esperado | Evidência a coletar |
| --- | --- | --- |
| App encerrado durante leitura | Banco íntegro ao reabrir; nenhuma rede é necessária | abertura e `integrity_check` |
| App encerrado antes do commit | Não existe lançamento parcial | histórico e saldo após reabrir |
| App encerrado após o commit | Lançamento e saldo aparecem uma única vez | histórico e saldo após reabrir |
| Armazenamento indisponível | Erro explícito; formulário não confirma sucesso | gravação de tela e log sem dados financeiros |
| Base de 50 mil itens | Navegação e salvamento continuam locais | tabela acima |
| Sem rede / modo avião | Abertura, rolagem e commit permanecem disponíveis | gravação de tela |
| Dois dispositivos geram a mesma recorrência | Uma identidade `regra + data`; um único efeito remoto simulado | teste automatizado do transporte |
| Retificação após outra movimentação | Transação recusada; saldo e metadados permanecem atuais | versão financeira e teste automatizado |
| Lote recorrente interrompido | Checkpoint confirmado; retomada do mesmo lote sem duplicação | tabelas de lote/checkpoint e teste automatizado |
| Conflito financeiro | Proposta local preservada até decisão explícita | revisão classificada e resolução testada |

## Estados de sessão antes da implementação de autenticação

| Estado | Dados locais | Rede | Transição permitida nesta fase |
| --- | --- | --- | --- |
| `local_only` | disponível | irrelevante | estado atual do aplicativo |
| `offline_without_session` | disponível | indisponível | preparação para login futuro; não apaga banco |
| `online_without_session` | disponível | disponível | preparação para solicitar autenticação futura |
| `session_pending` | disponível | disponível ou indisponível | somente contrato; ainda não há token nem chamada remota |

Os estados são uma matriz de produto e teste. A Etapa 6 introduziu somente o
armazenamento local cifrado por perfil para sessão futura; não existe login,
renovação, transporte ou chamada remota nesta fase. Esses fluxos continuam
pertencendo à Etapa 8.

## Contratos locais de sincronização

`src/domain/sync/contracts.ts` fornece guardas executáveis para `SyncCommand`,
`SyncReceipt`, `SyncEvent`, `SyncSnapshot`, `SyncConflict` e `SyncCursor`.
Eles aceitam apenas identificadores opacos não vazios, versões inteiras não
negativas e valores de payload finitos. Não escolhem formato de UUID, schema
remoto, transporte, usuário ou geração: essas decisões pertencem às Etapas 3,
7 e 8. O módulo é TypeScript puro e não importa interface, React, Expo ou
SQLite.

Na Etapa 5, o contrato de conflito ganhou tipos puros para a classe de revisão e
a resolução. A persistência e a decisão continuam em `src/db/sync`; nenhuma UI,
API remota ou regra de relógio entra no domínio. As classes locais são edição,
exclusão, arquivamento e categoria concorrentes, e as resoluções aceitas são
manter a proposta local ou aceitar o evento remoto.
