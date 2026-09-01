# MVP funcional do Hedge

**Status:** definido
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

O usuário pode cadastrar diferentes contas bancárias. Uma conta possui nome,
banco relacionado, saldo e um indicador visual único e customizável, escolhido
como um ícone de uma seleção ou uma cor.

Na criação, o usuário informa obrigatoriamente o saldo inicial. Esse valor é
registrado como um lançamento comum, sujeito às mesmas regras de edição e
exclusão dos demais lançamentos. Contas podem ter saldo negativo.

Despesas pontuais decrementam o saldo da conta selecionada e rendas pontuais o
incrementam. A tela inicial mostra o saldo atual consolidado do usuário e o
quanto foi gasto em cada categoria.

## Lançamentos pontuais e histórico

Despesa pontual e renda pontual são lançamentos distintos para o usuário. Cada
um afeta uma conta, respectivamente reduzindo ou aumentando seu saldo.

Todo lançamento pontual possui nome, valor e data; a descrição é opcional. A
categoria é obrigatória para uma despesa e não é necessária para uma renda.
Não é permitido registrar lançamentos pontuais com data futura.

O usuário pode acessar um histórico de despesas e rendas pontuais e pode
editar ou excluir seus lançamentos. A exclusão é permanente: o lançamento
deixa de integrar o histórico e os cálculos de saldo e gastos.

## Transferências

Uma transferência entre contas é registrada como um único lançamento na
funcionalidade **nova transferência**. Ela não deve exigir que o usuário
registre separadamente uma saída na conta de origem e uma entrada na conta de
destino.

## Categorias e orçamento mensal

O MVP cria inicialmente as seguintes categorias genéricas: **Compras**,
**Assinatura**, **Entretenimento**, **Alimentação** e **Outros**.

O usuário pode criar, editar e excluir categorias. Ao criar uma categoria,
deve definir seu orçamento mensal, que pode ser zero. Alterar o orçamento não
altera o histórico.

O gasto mensal de uma categoria é determinado pela data informada em cada
lançamento de despesa. A tela inicial apresenta esse valor por categoria.

Ao excluir uma categoria, os lançamentos que a utilizavam permanecem no
histórico e nos cálculos. Neles, a categoria passa a ser ausente e a interface
deve exibir **Categoria excluída**.

## Lançamentos recorrentes

O usuário pode cadastrar despesas recorrentes e rendas recorrentes. Cada regra
recorrente gera automaticamente lançamentos pontuais de despesa ou renda de
acordo com sua definição. As regras recorrentes possuem período de repetição,
dia de cobrança e datas de início e de término opcionais.

O período de repetição inclui, inicialmente, semanal, mensal e anual. Em uma
recorrência semanal, o dia de cobrança é um dia da semana. Nas demais, ele é
um dia do calendário.

Em recorrências mensais, o dia 31 sempre significa o último dia do mês. Para
os dias 29 e 30, em fevereiro é usado o último dia daquele mês: dia 29 em ano
bissexto e dia 28 nos demais anos. Assim, nenhum lançamento recorrente é
gerado em uma data civil inexistente.

Se o dia de cobrança da iteração atual já passou, nenhum lançamento pontual é
criado retroativamente; a cobrança ocorre somente na próxima iteração.

O usuário pode visualizar, editar e excluir suas regras de despesas e rendas
recorrentes. Editar ou excluir uma regra não altera lançamentos pontuais já
gerados. A definição de recorrência não substitui o histórico: os lançamentos
gerados permanecem acessíveis como parte dele.

## Tema

Após concluir o primeiro cadastro, o usuário pode trocar o tema do aplicativo.
Tema e aparência continuam sendo preferências separadas, conforme definido na
[arquitetura](architecture.md).

## Fora do escopo por enquanto

Este documento não introduz suporte a outras moedas, conversão cambial,
sincronização, contas de usuário, backend ou acesso à rede.
