import type { Metadata } from 'next';
import { AuthCenter } from '@/components/auth/AuthSplit';
import { VerifyBody } from './VerifyBody';

export const metadata: Metadata = {
  title: 'Подтверждение email — CoreBridge',
  robots: { index: false },
};

/**
 * Токен читаем из searchParams на сервере, а не хуком: страница и так
 * динамическая из-за ссылки из письма, лишняя граница Suspense не нужна.
 */
export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthCenter bigIcon>
      <VerifyBody token={searchParams.token ?? null} />
    </AuthCenter>
  );
}
