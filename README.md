# Hedge

Hedge será um gestor de finanças pessoais para Android e iOS, inteiramente
offline. O projeto usará Expo, React Native, TypeScript e SQLite, priorizando
uma implementação pequena e fácil de manter.

O projeto usa Expo SDK 57, React Native e TypeScript estrito. A navegação é
feita pelo Expo Router e os dados financeiros serão persistidos localmente com
SQLite.

## Documentação

- [Arquitetura do projeto](docs/architecture.md)
- [Especificação funcional do MVP](docs/mvp.md)
- [Schema v1 do banco de dados](docs/database-schema-v1.md)

## Princípios

- funcionar sem conta, servidor ou conexão com a internet;
- manter o SQLite como fonte de verdade dos dados financeiros;
- usar poucas dependências e somente quando houver uma necessidade concreta;
- separar telas, regras financeiras e persistência sem criar camadas
  cerimoniais;
- permitir múltiplos temas por meio de tokens visuais semânticos.

## Desenvolvimento

O ambiente de desenvolvimento requer Node.js 22.5 ou superior e npm. Não usamos
Android Studio, JDK, Android SDK, emulador, React Native CLI nem projetos
nativos locais.

```text
npm install
npm run start
```

Durante o desenvolvimento inicial, o aplicativo é executado em um dispositivo
físico pelo Expo Go. Os comandos `npm run typecheck`, `npm run lint` e
`npm test` verificam, respectivamente, tipos, estilo e testes.
