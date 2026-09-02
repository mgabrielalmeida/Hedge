export type RepositoryValue = string | number | null;

export type RepositorySession = {
  getAllAsync: <T>(source: string, ...parameters: RepositoryValue[]) => Promise<T[]>;
  getFirstAsync: <T>(source: string, ...parameters: RepositoryValue[]) => Promise<T | null>;
  runAsync: (source: string, ...parameters: RepositoryValue[]) => Promise<unknown>;
};

export type RepositoryDatabase = RepositorySession & {
  withExclusiveTransactionAsync: (
    task: (transaction: RepositorySession) => Promise<void>,
  ) => Promise<void>;
};

export type Clock = () => string;

export const systemClock: Clock = () => new Date().toISOString();
