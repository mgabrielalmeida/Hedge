# Dados fictícios de desenvolvimento

O arquivo `src/db/developmentSeed.ts` contém um conjunto hardcoded de dados
fictícios para facilitar o desenvolvimento visual e manual do Hedge. Ele cria
contas, categorias adicionais, saldos iniciais, receitas, despesas,
transferências e regras recorrentes em um banco recém-criado.

## Regra de segurança

O seed só é chamado por `initializeDatabase` quando `__DEV__` é verdadeiro.
Além disso, ele só executa quando ainda não existe nenhuma conta. Portanto:

- os dados não fazem parte de uma migração;
- builds de produção não executam esse código;
- o seed não substitui nem mistura dados já existentes;
- os valores e nomes são fictícios e não devem ser usados como dados reais.

Para testar novamente, use um banco de desenvolvimento novo (por exemplo,
limpando os dados do aplicativo no emulador). O seed não deve ser convertido
em migração nem chamado por uma rotina de restauração ou importação.
