# Hedge

Hedge é um gestor de finanças pessoais para Android e iOS. O SQLite permanece
como fonte de verdade e todas as operações financeiras continuam disponíveis
offline. Conta e sincronização em nuvem fazem parte da arquitetura aceita, mas
ainda não estão ativas no aplicativo.

O projeto usa Expo SDK 57, React Native e TypeScript estrito. A navegação é
feita pelo Expo Router e os dados financeiros serão persistidos localmente com
SQLite.

## Documentação

- [Arquitetura do projeto](docs/architecture.md)
- [Especificação funcional do MVP](docs/mvp.md)
- [Schema v1 do banco de dados](docs/database-schema-v1.md)
- [Plano de conta, nuvem e sincronização offline](docs/cloud-sync-implementation-plan.md)

## Princípios

- abrir, navegar e salvar dados financeiros sem conexão;
- manter o SQLite como fonte de verdade dos dados financeiros;
- introduzir conta e sincronização somente na ordem e nos limites definidos pelo
  plano de implementação;
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

Durante o desenvolvimento local, o aplicativo pode ser aberto em um dispositivo
físico pelo Expo Go com `npm run start:go`. A validação de módulos nativos da
fase de conta e nuvem exigirá development build, iniciado com
`npm run start:dev-client`. Os comandos `npm run typecheck`, `npm run lint` e
`npm test` verificam, respectivamente, tipos, estilo e testes.
