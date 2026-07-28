import type { ReactNode } from 'react';
import '@/styles/auth.css';

/**
 * Экраны входа и восстановления доступа. Общая шапка сайта им не нужна —
 * в макете это самостоятельные страницы во весь экран.
 *
 * auth.css подключён импортом, а не <link>: так стили едут только на этих
 * маршрутах. В корневой layout их класть нельзя — имена вроде .tabs-nav и
 * .divider встречаются и в других страницах макета со своими значениями.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
