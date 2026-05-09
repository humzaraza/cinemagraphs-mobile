import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import {
  getTokens,
  setTokens,
  removeTokens,
  getAccessToken,
  getRefreshToken,
} from './api';

const TOKENS_KEY = 'auth_tokens';

beforeEach(() => {
  vi.mocked(SecureStore.getItemAsync).mockReset();
  vi.mocked(SecureStore.setItemAsync).mockReset();
  vi.mocked(SecureStore.deleteItemAsync).mockReset();
});

describe('getTokens', () => {
  it('returns null when SecureStore returns null', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    const result = await getTokens();
    expect(result).toBeNull();
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(TOKENS_KEY);
  });

  it('returns parsed TokenPair when SecureStore returns valid JSON', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken: 'a-token', refreshToken: 'r-token' }),
    );
    const result = await getTokens();
    expect(result).toEqual({ accessToken: 'a-token', refreshToken: 'r-token' });
  });

  it('returns null on malformed JSON', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('not-json{');
    const result = await getTokens();
    expect(result).toBeNull();
  });

  it('returns null when JSON is valid but missing accessToken', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ refreshToken: 'r-token' }),
    );
    const result = await getTokens();
    expect(result).toBeNull();
  });

  it('returns null when JSON is valid but missing refreshToken', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken: 'a-token' }),
    );
    const result = await getTokens();
    expect(result).toBeNull();
  });
});

describe('setTokens', () => {
  it('writes JSON-encoded pair to SecureStore under correct key', async () => {
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue(undefined);
    await setTokens({ accessToken: 'a-token', refreshToken: 'r-token' });
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      TOKENS_KEY,
      JSON.stringify({ accessToken: 'a-token', refreshToken: 'r-token' }),
    );
  });

  it('throws when accessToken is empty string', async () => {
    await expect(
      setTokens({ accessToken: '', refreshToken: 'r-token' }),
    ).rejects.toThrow('accessToken');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('throws when refreshToken is empty string', async () => {
    await expect(
      setTokens({ accessToken: 'a-token', refreshToken: '' }),
    ).rejects.toThrow('refreshToken');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
});

describe('removeTokens', () => {
  it('calls SecureStore.deleteItemAsync with correct key', async () => {
    vi.mocked(SecureStore.deleteItemAsync).mockResolvedValue(undefined);
    await removeTokens();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKENS_KEY);
  });
});

describe('getAccessToken / getRefreshToken', () => {
  it('getAccessToken returns the access token from a stored pair', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(
      JSON.stringify({ accessToken: 'a-token', refreshToken: 'r-token' }),
    );
    expect(await getAccessToken()).toBe('a-token');
  });

  it('getRefreshToken returns null when no pair is stored', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    expect(await getRefreshToken()).toBeNull();
  });
});
