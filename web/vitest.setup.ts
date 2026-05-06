import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
  SnackbarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/lib/supabase', () => {
  const chain = () => {
    const obj: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike', 'is', 'in', 'or', 'and', 'not', 'limit', 'range', 'order', 'single', 'maybeSingle']) {
      obj[m] = vi.fn(() => obj);
    }
    obj.then = vi.fn((cb: (v: unknown) => void) => { cb({ data: [], error: null, count: 0 }); return { catch: vi.fn() }; });
    return obj;
  };
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
      from: vi.fn(() => chain()),
    },
    getServiceSupabase: vi.fn(() => ({
      auth: { admin: { listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }) } },
      from: vi.fn(() => chain()),
    })),
  };
});

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
