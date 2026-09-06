# MVP funcional do Hedge

**Status:** definido
**Data:** 3 de setembro de 2026

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
- editar e excluir contas, desde que pelo menos uma conta permaneça;
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

### Entrada e apresentação monetária

A apresentação de uma quantia usa o símbolo `R$`, ponto como separador de
milhar, vírgula como separador decimal e sempre duas casas decimais. Exemplos:
`R$ 0,00`, `R$ 12,50`, `R$ 1.234,56` e `-R$ 10,00`.

Nos campos monetários do aplicativo, a digitação é tratada como centavos: cada
algarismo informado atualiza automaticamente a vírgula decimal e o ponto de
milhar. Por exemplo, `200000` é apresentado como `2.000,00`. O usuário não
informa separador de milhar; o componente de interface o insere somente para
apresentação antes de entregar a quantia ao domínio. Tanto ponto quanto vírgula
continuam aceitos como separador entre reais e centavos em entradas textuais
não formatadas. Assim, `12.50` e `12,50` representam ambos 1.250 centavos.
A entrada segue estas regras:

- espaços externos são ignorados, mas espaços internos não são aceitos;
- o símbolo da moeda não é aceito; separadores de milhar são tratados pelo
  campo formatado de interface e não integram a quantia enviada ao domínio;
- a parte inteira é obrigatória e contém somente algarismos;
- a parte decimal é opcional e contém uma ou duas casas;
- no máximo um separador decimal pode aparecer;
- zeros à esquerda são aceitos;
- um sinal negativo inicial é aceito somente nos campos cujo conceito permita
  valor negativo, como saldo inicial;
- mais de duas casas decimais tornam a entrada inválida; valores nunca são
  arredondados implicitamente.

Consequentemente, `1234`, `1234,5`, `1234.50` e `-10,25` são entradas textuais
sintaticamente válidas, enquanto `R$ 10,00`, `10,`, `.50`, `1,234` e `10,999`
são inválidas. O texto `1.234,56` é uma apresentação criada pelo campo
monetário, não uma entrada textual bruta para o conversor. Como não existe
separador de milhar na entrada bruta, `1.23` significa um real e vinte e três
centavos, não cento e vinte e três reais.

A conversão é feita diretamente entre texto e centavos, sem passar por ponto
flutuante. O resultado e toda quantia recebida pelo domínio devem ser inteiros
seguros do JavaScript. Uma conversão ou soma que ultrapasse esse intervalo
falha explicitamente; não há saturação, arredondamento nem perda silenciosa de
precisão.

O conversor apenas interpreta a quantia. Regras contextuais são validadas
separadamente: despesas, rendas e transferências devem ter magnitude maior que
zero; orçamento mensal pode ser zero e não pode ser negativo; saldo inicial
pode ser positivo, negativo ou zero. O sinal persistido continua seguindo o
contrato do schema: despesa e transferência são negativas na conta de origem,
renda é positiva e saldo inicial conserva o sinal informado.

### Validade das datas civis

Uma data civil é válida somente quando tem exatamente a forma `YYYY-MM-DD`, é
uma data existente no calendário gregoriano e usa um ano entre `0001` e `9999`.
Mês e dia devem estar preenchidos com dois algarismos. A validação considera
anos bissextos e rejeita, por exemplo, `2025-02-29` e `2026-04-31`.

Regras dependentes do dia atual recebem explicitamente uma data civil de
referência. A camada que chama o domínio obtém o dia local do dispositivo; o
domínio não consulta relógio nem fuso horário por conta própria. A proibição de
lançamentos futuros compara a data informada com essa referência, permitindo o
próprio dia. Início e término de recorrência são inclusivos, e o término, quando
presente, não pode anteceder o início.

Instantes técnicos não são datas civis: usam ISO 8601 em UTC e terminam em
`Z`, conforme a convenção de persistência.

## Contas e saldos

O usuário pode cadastrar diferentes contas bancárias. Uma conta possui nome,
banco relacionado, saldo e um indicador visual customizável composto por um
ícone de uma seleção e uma cor.

Na criação, o usuário informa obrigatoriamente o saldo inicial. Esse valor é
registrado como um lançamento comum, sujeito às mesmas regras de edição e
exclusão dos demais lançamentos. Ele não é apresentado como um atributo ou
saldo separado da conta: a interface apresenta o saldo atual, sempre derivado
dos lançamentos. Contas podem ter saldo negativo.

Quando não houver nenhuma conta no banco de dados, o aplicativo abre o fluxo
de onboarding para criação da primeira conta. A exclusão de uma conta é
permitida somente quando houver outra conta cadastrada. A regra de tratamento
do histórico e das referências vinculadas à conta será definida antes de
implementar essa exclusão.

Despesas pontuais decrementam o saldo da conta selecionada e rendas pontuais o
incrementam. A tela inicial mostra o saldo atual consolidado do usuário e, por
categoria, o quanto foi gasto no mês escolhido, o orçamento mensal configurado
e a proporção entre eles. O usuário pode consultar o mês atual e os meses
anteriores. Categorias com orçamento zero continuam mostrando o gasto e o
orçamento, mas não recebem percentual ou progresso artificial, pois não há
limite mensal definido.

O saldo de uma conta considera todos os lançamentos em que ela aparece. O valor
é somado quando ela é a conta principal; em uma transferência recebida, o
inverso do valor negativo da origem é somado à conta de destino. O saldo
consolidado é a soma dos saldos de todas as contas, de modo que transferências
internas se anulam. Cada adição deve permanecer no intervalo de inteiros seguros
do JavaScript; excedê-lo é erro de domínio.

## Lançamentos pontuais e histórico

Despesa pontual e renda pontual são lançamentos distintos para o usuário. Cada
um afeta uma conta, respectivamente reduzindo ou aumentando seu saldo.

Todo lançamento pontual possui nome, valor e data; a descrição é opcional. A
categoria é obrigatória para uma despesa e não é necessária para uma renda.
Não é permitido registrar lançamentos pontuais com data futura.

O usuário pode acessar um histórico de despesas e rendas pontuais e pode
editar ou excluir seus lançamentos. O lançamento de saldo inicial também segue
essas regras, embora não seja apresentado como um atributo da conta. A
exclusão é permanente: o lançamento deixa de integrar o histórico e os
cálculos de saldo e gastos.

## Transferências

Uma transferência entre contas é registrada como um único lançamento na
funcionalidade **nova transferência**. Ela não deve exigir que o usuário
registre separadamente uma saída na conta de origem e uma entrada na conta de
destino.

As transferências possuem um histórico próprio. O usuário pode editar ou
excluir uma transferência; sua exclusão é permanente e remove o efeito dela
dos saldos das duas contas.

## Categorias e orçamento mensal

O MVP cria inicialmente as seguintes categorias genéricas: **Compras**,
**Assinatura**, **Entretenimento**, **Alimentação** e **Outros**.

O usuário pode criar, editar e excluir categorias. Ao criar uma categoria,
deve definir seu orçamento mensal, que pode ser zero. Alterar o orçamento não
altera o histórico.

O gasto mensal de uma categoria é determinado pela data informada em cada
lançamento de despesa. A tela inicial apresenta esse valor no mês selecionado,
por categoria, junto com seu orçamento mensal e, quando o orçamento for maior
que zero, a porcentagem de orçamento já utilizada.

Esse gasto é uma quantia não negativa: soma-se a magnitude das despesas da
categoria cuja data pertença ao ano e mês solicitados. Rendas, transferências,
saldos iniciais e despesas sem categoria não participam desse total.

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

O mesmo ajuste para o último dia válido é aplicado à recorrência anual, como em
uma cobrança de 29 de fevereiro durante um ano não bissexto. Na frequência
semanal, os dias são numerados de 1 a 7, de segunda-feira a domingo.

Se o dia de cobrança da iteração atual já passou, nenhum lançamento pontual é
criado retroativamente; a cobrança ocorre somente na próxima iteração.

O aplicativo processa as recorrências devidas no dia civil local ao abrir e ao
retornar ao primeiro plano. O processamento deve ser idempotente: mais de uma
execução no mesmo dia não pode gerar lançamentos duplicados.

O usuário pode visualizar, editar e excluir suas regras de despesas e rendas
recorrentes. Editar ou excluir uma regra não altera lançamentos pontuais já
gerados. A definição de recorrência não substitui o histórico: os lançamentos
gerados permanecem acessíveis como parte dele.

## Contrato da camada de domínio

A primeira implementação do domínio financeiro abrange modelos de conta,
categoria, lançamento, regra recorrente e ocorrência recorrente; conversão e
formatação monetária; validações de valores, textos e datas; cálculos de saldo
e gasto mensal; e cálculo das datas de recorrência. Persistência, consultas SQL
e coordenação de transações SQLite não pertencem a essa camada.

Os modelos são somente leitura e representam conceitos do domínio, não linhas
do driver SQLite. Lançamentos e regras recorrentes usam uniões discriminadas
por tipo, para que campos como destino e categoria tenham contratos próprios.
Uma despesa já persistida pode ter categoria ausente depois da exclusão dessa
categoria; uma nova despesa, por outro lado, exige categoria. Identificadores
persistidos são inteiros seguros positivos.

Nomes e demais textos obrigatórios são aparados nas extremidades e não podem
ficar vazios. Descrições são aparadas, e uma descrição vazia é normalizada para
ausência. A unicidade de nome de categoria continua sendo responsabilidade do
repositório e do banco, pois depende do conjunto de registros existentes.

Entrada inválida esperada, como texto monetário ou data civil malformados, é
representada por um resultado de validação com código de erro, sem exceção.
Exceções ficam reservadas para violação de uma invariante interna ou estouro do
intervalo de inteiros seguros durante um cálculo. Todas as funções de cálculo
recebem seus dados e referências temporais por argumento e permanecem puras.

## Tema

Após criar a primeira conta, o usuário pode trocar o tema durante o onboarding
ou pela área Aparência da navegação principal. Tema e aparência continuam sendo
preferências separadas, conforme definido na [arquitetura](architecture.md).
Contas e categorias combinam um ícone com uma cor predefinida ou criada em uma
roda de tons com controles simples de vivacidade e luminosidade.

## Fora do escopo por enquanto

Este documento não introduz suporte a outras moedas, conversão cambial,
sincronização, contas de usuário, backend ou acesso à rede.
