# Schema v1 do banco de dados

**Status:** congelado  
**Versão:** 1  
**Data:** 1 de setembro de 2026

Este documento registra o primeiro schema persistente do Hedge. A fonte de
verdade executável é a migração
`src/db/migrations/001_initial_schema.ts`. Depois de publicada ou aplicada, ela
não deve ser alterada; toda evolução deverá ser feita por uma nova migração
sequencial.

O schema materializa os requisitos definidos no [MVP](mvp.md) e segue os
limites da [arquitetura](architecture.md). Preferências de interface não fazem
parte deste banco e continuam destinadas ao `expo-sqlite/kv-store`.

## Processo de definição e congelamento

O schema foi definido em quatro etapas:

1. os requisitos funcionais foram traduzidos em entidades e invariantes;
2. foram decididas as representações ainda não especificadas, incluindo IDs,
   sinais monetários, transferências, exclusões e recorrências;
3. o DDL foi executado em um banco SQLite temporário com dados representativos
   e tentativas deliberadamente inválidas;
4. o SQL validado foi registrado como a migração 1 e recebeu testes de
   congelamento do contrato.

A validação temporária usou SQLite 3.50.4. O `expo-sqlite` instalado no projeto
inclui SQLite 3.50.3, compatível com as tabelas `STRICT` e demais recursos
utilizados. A suíte automatizada usa o adapter `src/db/testDatabase.ts` sobre
`node:sqlite` para verificar a execução da migração, `foreign_keys`, WAL,
`user_version`, categorias iniciais e idempotência da inicialização. O executor
também é testado contra SQLite real para aplicação parcial, versão futura,
listas inválidas e rollback de migração com falha.

## Convenções comuns

- As tabelas são `STRICT` para impedir coerções de tipo inesperadas.
- Identificadores usam `INTEGER PRIMARY KEY`, sem `AUTOINCREMENT`.
- Valores monetários usam centavos inteiros e ficam limitados ao intervalo
  seguro do JavaScript, de `-9007199254740991` a `9007199254740991`.
- Datas civis usam `YYYY-MM-DD`. O banco verifica a forma textual; validade
  gregoriana e regras como proibição de datas futuras pertencem ao domínio.
- Instantes técnicos usam ISO 8601 em UTC.
- `created_at` recebe um valor padrão do SQLite. Os repositórios atualizarão
  `updated_at` explicitamente; não há triggers de atualização.
- Strings opcionais vazias devem ser normalizadas para `NULL` pelo domínio
  antes de serem persistidas pelos repositórios.
- Não há colunas de moeda porque BRL é a única moeda do MVP.
- Não há saldos, totais ou gastos materializados. Todos são derivados dos
  lançamentos.

## `accounts`

Representa uma conta financeira e contém:

| Coluna | Contrato |
| --- | --- |
| `id` | Identificador inteiro local |
| `name` | Nome não vazio; pode se repetir |
| `institution_name` | Nome local e não vazio da instituição |
| `visual_type` | `icon` ou `color` |
| `visual_value` | Identificador do ícone ou valor da cor |
| `created_at`, `updated_at` | Instantes técnicos |

Não existe tabela de instituições nem restrição de unicidade para o indicador
visual. A exclusão de contas não pertence ao MVP. Referências de lançamentos e
recorrências usam `ON DELETE RESTRICT`, impedindo perda acidental do histórico.

## `categories`

Contém o nome e o orçamento mensal atual em centavos. O nome é não vazio e
único segundo a comparação `NOCASE` do SQLite. O orçamento aceita zero, mas não
valores negativos. O v1 não mantém histórico de alterações de orçamento.

A migração cria como registros comuns, editáveis e excluíveis:

- Compras;
- Assinatura;
- Entretenimento;
- Alimentação;
- Outros.

Ao excluir uma categoria, `transactions.category_id` recebe `NULL`. A despesa
permanece no histórico e a interface deve exibir **Categoria excluída**.

Uma categoria usada por uma regra de despesa ativa não pode ser apagada
diretamente. A operação de repositório deverá, em uma transação, desativar as
regras afetadas, remover suas referências e então excluir a categoria. A
restrição de `recurring_rules` impede que essa etapa seja esquecida.

## `transactions`

Um lançamento possui `kind`, conta principal, possível conta de destino,
possível categoria, nome, descrição, valor, data civil e instantes técnicos.

`kind` aceita:

- `expense`;
- `income`;
- `transfer`;
- `opening_balance`.

`amount_cents` representa o efeito sobre `account_id`:

| Tipo | Convenção |
| --- | --- |
| Despesa | valor negativo |
| Renda | valor positivo |
| Transferência | valor negativo na origem |
| Saldo inicial | positivo, negativo ou zero |

Uma transferência ocupa uma única linha. `account_id` é a origem,
`destination_account_id` é o destino e o efeito no destino é o inverso de
`amount_cents`. Origem e destino devem ser diferentes. Transferências não têm
categoria e não são recorrentes no v1.

O saldo de uma conta é calculado somando os valores nos quais ela é a conta
principal e o inverso dos valores nos quais ela é o destino. Assim,
transferências se anulam no saldo consolidado.

O saldo inicial é um lançamento comum com `kind = opening_balance`. Um índice
parcial permite no máximo um por conta. A criação da conta e desse lançamento
deverá ocorrer na mesma transação SQLite.

Lançamentos são excluídos fisicamente. Categorias usam `ON DELETE SET NULL` e
contas usam `ON DELETE RESTRICT`.

## `recurring_rules`

Uma regra recorrente copia para cada lançamento gerado seu tipo, conta,
categoria, nome, descrição e valor. Alterações posteriores na regra não
modificam lançamentos já gerados.

Somente `expense` e `income` são permitidos. Despesas ativas exigem categoria;
rendas não aceitam categoria. O sinal de `amount_cents` segue a mesma convenção
dos lançamentos.

O calendário é representado assim:

| Frequência | `charge_day` | `charge_month` |
| --- | --- | --- |
| `weekly` | 1 a 7, de segunda a domingo | `NULL` |
| `monthly` | 1 a 31 | `NULL` |
| `yearly` | 1 a 31 | 1 a 12 |

`start_date` é inclusiva e sempre persistida. Quando omitida na interface, será
resolvida para a data civil local de criação. `end_date` é opcional, inclusiva
e não pode anteceder o início. Dias inexistentes são ajustados para o último
dia do mês pelo domínio.

Regras são excluídas logicamente com `is_active = 0` e `deleted_at` preenchido.
Isso preserva a procedência dos lançamentos anteriores. A geração considera
somente a ocorrência devida no dia atual; datas perdidas não são preenchidas
retroativamente.

## `recurring_occurrences`

Registra o processamento de uma data de cobrança. O par
`(recurring_rule_id, scheduled_date)` é único. `transaction_id` aponta para o
lançamento criado e também é único.

Se o usuário excluir um lançamento gerado, `transaction_id` recebe `NULL`, mas
a ocorrência permanece. Esse tombstone impede que a mesma cobrança seja
gerada novamente. Lançamento e ocorrência devem ser criados na mesma transação
SQLite.

Regras usam exclusão lógica e ocorrências as referenciam com
`ON DELETE RESTRICT`. O vínculo entre ocorrência e lançamento usa
`ON DELETE SET NULL`.

## Índices do v1

Além dos índices implícitos de chaves e restrições únicas, o schema cria:

- um saldo inicial por conta;
- lançamentos por conta e data;
- transferências recebidas por destino e data;
- despesas por categoria e data;
- regras recorrentes por conta;
- regras recorrentes por categoria;
- regras recorrentes ativas;
- ocorrências pelo lançamento relacionado.

## Adaptador de preferências

O adaptador foi implementado em `src/db/preferences.ts`. Ele é a única área do
aplicativo que acessa diretamente `expo-sqlite/kv-store`; o `ThemeProvider`
usa apenas sua API tipada.

As chaves persistidas são `preferences.themeName` e
`preferences.appearance`. Leituras inválidas, ausentes ou que falhem retornam
os padrões `hedge` e `system`, sem impedir a inicialização da interface. As
gravações são expostas separadamente para tema e aparência e continuam
propagando falhas ao chamador.

O contexto de tema atualiza a aparência da sessão de forma imediata e retorna
`false` quando a persistência falha, evitando rejeições não observadas. O
armazenamento é injetável no adaptador para testes. Essa infraestrutura não
cria tabelas no banco financeiro nem altera a migração 1.
