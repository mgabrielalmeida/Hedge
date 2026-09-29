import {
  clearEncryptedSession,
  loadEncryptedSession,
  saveEncryptedSession,
  type SessionDependencies,
  type SessionPayload,
} from './session';

jest.mock('expo-crypto/build/aes', () => ({}));

const payload: SessionPayload = {
  accessToken: 'access', refreshToken: 'refresh', userId: 'user-a', expiresAt: '2026-10-01T00:00:00.000Z',
};

describe('encrypted local sessions', () => {
  it('keeps sessions isolated by local profile and removes both artifacts on logout', async () => {
    const dependencies = createDependencies();
    await saveEncryptedSession('profile-a', payload, dependencies);

    await expect(loadEncryptedSession('profile-b', dependencies)).resolves.toBeNull();
    await clearEncryptedSession('profile-a', dependencies);
    await expect(loadEncryptedSession('profile-a', dependencies)).resolves.toBeNull();
    expect(dependencies.storage.removeItem).toHaveBeenCalledWith('auth.session.payload.v1.profile-a');
    expect(dependencies.secureStore.deleteItemAsync).toHaveBeenCalledWith('hedge.session.key.v1.profile-a');
  });

  it('drops an unreadable payload when its SecureStore key is missing without touching financial storage', async () => {
    const dependencies = createDependencies();
    await dependencies.storage.setItem('auth.session.payload.v1.profile-a', 'ciphertext');

    await expect(loadEncryptedSession('profile-a', dependencies)).resolves.toBeNull();
    expect(dependencies.storage.removeItem).toHaveBeenCalledWith('auth.session.payload.v1.profile-a');
    expect(dependencies.storage.removeItem).not.toHaveBeenCalledWith(expect.stringContaining('sync_'));
  });

  it('expires a session by clearing only its encrypted payload and key', async () => {
    const dependencies = createDependencies(new Date('2026-10-02T00:00:00.000Z'));
    await saveEncryptedSession('profile-a', payload, dependencies);

    await expect(loadEncryptedSession('profile-a', dependencies)).resolves.toBeNull();
    expect(dependencies.storage.removeItem).toHaveBeenCalledWith('auth.session.payload.v1.profile-a');
    expect(dependencies.secureStore.deleteItemAsync).toHaveBeenCalledWith('hedge.session.key.v1.profile-a');
  });
});

function createDependencies(now = new Date('2026-09-29T00:00:00.000Z')): SessionDependencies {
  const secure = new Map<string, string>();
  const values = new Map<string, string>();
  const key = { encoded: jest.fn().mockResolvedValue('key-material') };
  return {
    crypto: {
      decrypt: jest.fn(async (sealed) => new TextEncoder().encode(String(sealed))),
      encrypt: jest.fn(async (plain) => ({ combined: async () => new TextDecoder().decode(plain) })),
      generateKey: jest.fn().mockResolvedValue(key),
      importKey: jest.fn().mockResolvedValue(key),
      sealedFromCombined: jest.fn((combined) => combined as never),
    },
    now: () => now,
    secureStore: {
      deleteItemAsync: jest.fn(async (name: string) => { secure.delete(name); }),
      getItemAsync: jest.fn(async (name: string) => secure.get(name) ?? null),
      setItemAsync: jest.fn(async (name: string, value: string) => { secure.set(name, value); }),
    },
    storage: {
      getItem: jest.fn(async (name: string) => values.get(name) ?? null),
      removeItem: jest.fn(async (name: string) => { values.delete(name); }),
      setItem: jest.fn(async (name: string, value: string) => { values.set(name, value); }),
    },
  } as SessionDependencies;
}
