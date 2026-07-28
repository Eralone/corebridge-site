import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { createElement } from 'react';

/**
 * next/link в App Router лезет за контекстом маршрутизатора, которого в jsdom нет.
 * Для проверки разметки нам нужен именно тег <a> с href — подменяем.
 */
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: any) => createElement('a', { href, ...rest }, children),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
