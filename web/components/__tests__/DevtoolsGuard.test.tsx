import { render, act } from '@testing-library/react';
import DevtoolsGuard from '@/components/DevtoolsGuard';

describe('DevtoolsGuard', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  function setWindowDimensions(
    outerWidth: number,
    innerWidth: number,
    outerHeight: number,
    innerHeight: number,
  ) {
    Object.defineProperty(window, 'outerWidth', { value: outerWidth, writable: true, configurable: true });
    Object.defineProperty(window, 'innerWidth', { value: innerWidth, writable: true, configurable: true });
    Object.defineProperty(window, 'outerHeight', { value: outerHeight, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: innerHeight, writable: true, configurable: true });
  }

  it('returns null in development mode', () => {
    process.env.NODE_ENV = 'development';
    setWindowDimensions(1400, 1000, 900, 800);

    const { container } = render(<DevtoolsGuard />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.innerHTML).toBe('');
  });

  it('returns null when window dimensions are normal', () => {
    process.env.NODE_ENV = 'production';
    setWindowDimensions(1024, 1024, 768, 768);

    const { container } = render(<DevtoolsGuard />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(container.innerHTML).toBe('');
  });

  it('shows overlay when width gap exceeds threshold', () => {
    process.env.NODE_ENV = 'production';
    setWindowDimensions(1400, 1000, 800, 800);

    const { getByText } = render(<DevtoolsGuard />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(getByText('Developer Tools Detected')).toBeInTheDocument();
  });

  it('shows overlay when height gap exceeds threshold', () => {
    process.env.NODE_ENV = 'production';
    setWindowDimensions(1024, 1024, 1000, 700);

    const { getByText } = render(<DevtoolsGuard />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(getByText('Developer Tools Detected')).toBeInTheDocument();
  });
});
