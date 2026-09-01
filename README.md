# Hedge

Hedge será um gestor de finanças pessoais para Android e iOS, inteiramente
offline. O projeto usará Expo, React Native, TypeScript e SQLite, priorizando
uma implementação pequena e fácil de manter.

O aplicativo ainda não foi inicializado. Neste momento, o repositório contém
somente a estrutura de pastas e as decisões que orientarão o desenvolvimento.

## Documentação

- [Arquitetura do projeto](docs/architecture.md)
- [Especificação funcional do MVP](docs/mvp.md)

## Princípios

- funcionar sem conta, servidor ou conexão com a internet;
- manter o SQLite como fonte de verdade dos dados financeiros;
- usar poucas dependências e somente quando houver uma necessidade concreta;
- separar telas, regras financeiras e persistência sem criar camadas
  cerimoniais;
- permitir múltiplos temas por meio de tokens visuais semânticos.
