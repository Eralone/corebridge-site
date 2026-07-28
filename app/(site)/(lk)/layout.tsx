import type { ReactNode } from 'react';
import { UserProvider } from '@/lib/user-context';

/**
 * Каркас ЛК — структура .app из design-source (dashboard.html и др.):
 *   <div class="app"> <aside class="sidebar"> <div class="app-main"> …
 * Сайдбар и топбар подключает каждая страница: у топбара свои title/subtitle.
 * Доступ проверяет middleware.ts, здесь повторной проверки нет.
 */
export default function LkLayout({ children }: { children: ReactNode }) {
  return <UserProvider>{children}</UserProvider>;
}
