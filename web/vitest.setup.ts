import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
  SnackbarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
