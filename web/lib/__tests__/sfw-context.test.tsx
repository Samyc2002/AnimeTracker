import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SfwProvider, useSfw } from '@/lib/sfw-context';

function wrapper({ children }: { children: ReactNode }) {
  return <SfwProvider>{children}</SfwProvider>;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('SfwProvider and useSfw', () => {
  it('defaults sfwMode to true', () => {
    const { result } = renderHook(() => useSfw(), { wrapper });
    expect(result.current.sfwMode).toBe(true);
  });

  it('reads sfwMode as false from localStorage', async () => {
    localStorage.setItem('sfw_mode', 'false');

    const { result } = renderHook(() => useSfw(), { wrapper });

    // useEffect runs asynchronously; wait for it
    await vi.waitFor(() => {
      expect(result.current.sfwMode).toBe(false);
    });
  });

  it('reads sfwMode as true from localStorage', async () => {
    localStorage.setItem('sfw_mode', 'true');

    const { result } = renderHook(() => useSfw(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.sfwMode).toBe(true);
    });
  });

  it('setSfwMode updates the value and writes to localStorage', () => {
    const { result } = renderHook(() => useSfw(), { wrapper });

    act(() => {
      result.current.setSfwMode(false);
    });

    expect(result.current.sfwMode).toBe(false);
    expect(localStorage.setItem).toHaveBeenCalledWith('sfw_mode', 'false');
  });

  it('setSfwMode(true) after false updates correctly', async () => {
    localStorage.setItem('sfw_mode', 'false');

    const { result } = renderHook(() => useSfw(), { wrapper });

    await vi.waitFor(() => {
      expect(result.current.sfwMode).toBe(false);
    });

    act(() => {
      result.current.setSfwMode(true);
    });

    expect(result.current.sfwMode).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith('sfw_mode', 'true');
  });
});
