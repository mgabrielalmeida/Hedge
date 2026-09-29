import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto/build/aes';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from 'expo-sqlite/kv-store';

const KEY_PREFIX = 'hedge.session.key.v1.';
const PAYLOAD_PREFIX = 'auth.session.payload.v1.';

export type SessionPayload = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: string;
  readonly userId: string;
};

export type SessionDependencies = {
  readonly crypto: {
    readonly generateKey: () => Promise<AESEncryptionKey>;
    readonly importKey: (encoded: string) => Promise<AESEncryptionKey>;
    readonly encrypt: (plain: Uint8Array, key: AESEncryptionKey, aad: Uint8Array) => Promise<{ combined: (encoding: 'base64') => Promise<string> }>;
    readonly decrypt: (sealed: AESSealedData, key: AESEncryptionKey, aad: Uint8Array) => Promise<Uint8Array>;
    readonly sealedFromCombined: (combined: string) => AESSealedData;
  };
  readonly secureStore: Pick<typeof SecureStore, 'deleteItemAsync' | 'getItemAsync' | 'setItemAsync'>;
  readonly storage: Pick<typeof AsyncStorage, 'getItem' | 'removeItem' | 'setItem'>;
  readonly now: () => Date;
};

const defaultDependencies: SessionDependencies = {
  crypto: {
    generateKey: () => AESEncryptionKey.generate(),
    importKey: (encoded) => AESEncryptionKey.import(encoded, 'base64'),
    encrypt: (plain, key, aad) => aesEncryptAsync(plain, key, { additionalData: aad }),
    decrypt: (sealed, key, aad) => aesDecryptAsync(sealed, key, { additionalData: aad }) as Promise<Uint8Array>,
    sealedFromCombined: (combined) => AESSealedData.fromCombined(combined),
  },
  secureStore: SecureStore,
  storage: AsyncStorage,
  now: () => new Date(),
};

export async function saveEncryptedSession(
  profileId: string,
  payload: SessionPayload,
  dependencies: SessionDependencies = defaultDependencies,
): Promise<void> {
  assertProfileId(profileId);
  assertSessionPayload(payload);
  const key = await loadOrCreateKey(profileId, dependencies);
  const ciphertext = await dependencies.crypto.encrypt(
    new TextEncoder().encode(JSON.stringify(payload)),
    key,
    additionalData(profileId),
  );
  await dependencies.storage.setItem(payloadKey(profileId), await ciphertext.combined('base64'));
}

/** Returns null for logout, expiry, key invalidation, or an unreadable payload. */
export async function loadEncryptedSession(
  profileId: string,
  dependencies: SessionDependencies = defaultDependencies,
): Promise<SessionPayload | null> {
  assertProfileId(profileId);
  const payload = await dependencies.storage.getItem(payloadKey(profileId));
  if (!payload) return null;
  const encodedKey = await dependencies.secureStore.getItemAsync(keyName(profileId));
  if (!encodedKey) {
    await dependencies.storage.removeItem(payloadKey(profileId));
    return null;
  }
  try {
    const decrypted = await dependencies.crypto.decrypt(
      dependencies.crypto.sealedFromCombined(payload),
      await dependencies.crypto.importKey(encodedKey),
      additionalData(profileId),
    );
    const session = parseSession(new TextDecoder().decode(decrypted));
    if (Date.parse(session.expiresAt) <= dependencies.now().getTime()) {
      await clearEncryptedSession(profileId, dependencies);
      return null;
    }
    return session;
  } catch {
    await dependencies.storage.removeItem(payloadKey(profileId));
    return null;
  }
}

/** Logout changes session storage only; it never touches SQLite financial data or the outbox. */
export async function clearEncryptedSession(
  profileId: string,
  dependencies: SessionDependencies = defaultDependencies,
): Promise<void> {
  assertProfileId(profileId);
  await Promise.all([
    dependencies.storage.removeItem(payloadKey(profileId)),
    dependencies.secureStore.deleteItemAsync(keyName(profileId)),
  ]);
}

async function loadOrCreateKey(profileId: string, dependencies: SessionDependencies): Promise<AESEncryptionKey> {
  const name = keyName(profileId);
  const stored = await dependencies.secureStore.getItemAsync(name);
  if (stored) return dependencies.crypto.importKey(stored);
  const key = await dependencies.crypto.generateKey();
  await dependencies.secureStore.setItemAsync(name, await key.encoded('base64'), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

function keyName(profileId: string): string { return `${KEY_PREFIX}${profileId}`; }
function payloadKey(profileId: string): string { return `${PAYLOAD_PREFIX}${profileId}`; }
function additionalData(profileId: string): Uint8Array { return new TextEncoder().encode(`hedge-session:${profileId}:v1`); }

function parseSession(value: string): SessionPayload {
  const parsed: unknown = JSON.parse(value);
  assertSessionPayload(parsed);
  return parsed;
}

function assertSessionPayload(value: unknown): asserts value is SessionPayload {
  if (!value || typeof value !== 'object') throw new Error('Invalid encrypted session.');
  const candidate = value as Partial<SessionPayload>;
  if (typeof candidate.accessToken !== 'string' || typeof candidate.refreshToken !== 'string'
    || typeof candidate.userId !== 'string' || typeof candidate.expiresAt !== 'string'
    || Number.isNaN(Date.parse(candidate.expiresAt))) {
    throw new Error('Invalid encrypted session.');
  }
}

function assertProfileId(profileId: string): void {
  if (!profileId.trim() || profileId.length > 200) throw new Error('Invalid local profile identity.');
}
