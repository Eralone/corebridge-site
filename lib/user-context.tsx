'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getProfile } from '@/lib/api/lk';

/**
 * Замена window.CB_USER из design-source/assets/shell.js.
 * В дизайне это был захардкоженный объект; здесь — данные из GET /lk/profile.
 */
export interface CurrentUser {
  name: string;
  /** Подпись под именем в сайдбаре: в дизайне «Пробный тариф» */
  org: string;
  initials: string;
  role: 'owner' | 'manager' | 'user' | 'admin';
  email: string;
}

/**
 * Экспортируем сам контекст, а не только провайдер: тестам и сториз нужен
 * заранее заданный пользователь без похода в GET /lk/profile.
 */
export const UserContext = createContext<CurrentUser | null>(null);

/** «Дмитрий Королев» → «ДК». В дизайне было «КД» — там инициалы заданы вручную. */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '—';
}

export function UserProvider({
  children,
  planTitle,
}: {
  children: ReactNode;
  /** Название тарифа для подписи под именем; приходит с дашборда */
  planTitle?: string;
}) {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let alive = true;
    getProfile()
      .then((p) => {
        if (!alive) return;
        setUser({
          name: p.user.name ?? p.user.email,
          org: planTitle ?? p.company.company_name ?? '',
          initials: initialsOf(p.user.name ?? p.user.email),
          role: p.user.role,
          email: p.user.email,
        });
      })
      .catch(() => {
        // 401 обрабатывает middleware — сюда попадаем только при сбое сети
      });
    return () => {
      alive = false;
    };
  }, [planTitle]);

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export const useUser = () => useContext(UserContext);
