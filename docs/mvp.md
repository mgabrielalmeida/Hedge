# MVP funcional do Hedge

**Status:** em definição  
**Data:** 1 de setembro de 2026

Este documento registra as convenções funcionais já decididas para a primeira
versão do Hedge. Ele complementa a [arquitetura](architecture.md): não define
schema, APIs de persistência ou componentes de interface. Decisões ainda não
tomadas ficam fora deste documento até serem explicitamente aprovadas.

## Escopo do MVP

O Hedge permitirá ao usuário controlar suas finanças pessoais localmente, em
BRL, por meio de contas, categorias e lançamentos. O aplicativo não terá
conta de usuário, servidor ou sincronização.

As funcionalidades iniciais são:

- cadastrar contas bancárias;
- registrar despesas pontuais;
- registrar rendas pontuais;
- consultar o histórico de despesas e rendas pontuais;
- registrar transferências entre contas;
- editar e excluir lançamentos;
- criar, editar e excluir categorias;
- criar, consultar, editar e excluir despesas e rendas recorrentes;
- escolher um tema depois de concluir o primeiro cadastro.

## Moeda, valores e datas

- A única moeda do MVP é o real brasileiro (BRL).
- Valores monetários seguem a convenção arquitetural de armazenamento em
  centavos inteiros. A interface os apresenta em formato brasileiro.
- Datas que representem o dia de um lançamento ou ocorrência recorrente usam
  a convenção `YYYY-MM-DD` já definida na arquitetura.

## Contas e saldos

- O usuário pode cadastrar diferentes contas bancárias.
- A criação de uma conta exige que o usuário informe seu saldo inicial.
- Despesas pontuais decrementam o saldo da conta selecionada.
- Rendas pontuais incrementam o saldo da conta selecionada.
- A tela inicial mostra o saldo atual consolidado do usuário e o quanto foi
  gasto em cada categoria.

As regras exatas de cálculo do saldo a partir do saldo inicial e dos
lançamentos serão formalizadas antes do schema, respeitando os comportamentos
acima.

## Lançamentos pontuais e histórico

Despesa pontual e renda pontual são lançamentos distintos para o usuário. Cada
um afeta uma conta, respectivamente reduzindo ou aumentando seu saldo.

O usuário pode acessar um histórico de despesas e rendas pontuais e pode
editar ou excluir seus lançamentos. A exclusão é permanente: o lançamento
deixa de integrar o histórico e os cálculos de saldo e gastos.

## Transferências

Uma transferência entre contas é registrada como um único lançamento na
funcionalidade **nova transferência**. Ela não deve exigir que o usuário
registre separadamente uma saída na conta de origem e uma entrada na conta de
destino.

As regras complementares — por exemplo, as validações de origem, destino e
valor, e seu reflexo em históricos e categorias — ainda precisam ser definidas.

## Categorias e orçamento mensal

O MVP começa com categorias genéricas, como **Compras** e **Alimentação**.

O usuário pode criar, editar e excluir categorias. Ao criar uma categoria,
deve definir seu orçamento mensal. A tela inicial apresenta o valor gasto em
cada categoria, conforme o período mensal e demais critérios que ainda serão
especificados.

## Lançamentos recorrentes

O usuário pode cadastrar despesas recorrentes e rendas recorrentes. Cada regra
recorrente deve gerar automaticamente lançamentos pontuais de despesa ou renda
de acordo com a definição fornecida pelo usuário.

O usuário pode visualizar, editar e excluir suas regras de despesas e rendas
recorrentes. A definição de recorrência não substitui o histórico: os
lançamentos pontuais gerados precisam permanecer acessíveis como parte dele.

## Tema

Após concluir o primeiro cadastro, o usuário pode trocar o tema do aplicativo.
Tema e aparência continuam sendo preferências separadas, conforme definido na
[arquitetura](architecture.md).

## Fora do escopo por enquanto

Este documento não introduz suporte a outras moedas, conversão cambial,
sincronização, contas de usuário, backend ou acesso à rede.
