# Orientações para o repositório

- Leia `docs/architecture.md` antes de alterar a estrutura ou introduzir uma
  dependência.
- Preserve o funcionamento inteiramente offline do aplicativo.
- Prefira APIs do React Native, JavaScript e Expo às dependências externas.
- Não coloque SQL, regras financeiras ou cálculos diretamente em rotas.
- Use valores monetários inteiros em centavos; não use ponto flutuante para
  dinheiro.
- Mantenha identificadores, nomes de arquivos e código em inglês.
- Coloque testes próximos ao módulo testado usando o sufixo `.test.ts` ou
  `.test.tsx`.
