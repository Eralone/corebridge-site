import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthCenter } from '@/components/auth/AuthSplit';
import { ResetForm } from './ResetForm';

export const metadata: Metadata = {
  title: 'Новый пароль — CoreBridge',
  robots: { index: false },
};

export default function Page() {
  return (
    <AuthCenter>
      {/* токен приходит в ?token=, а useSearchParams требует границы Suspense */}
      <Suspense fallback={<p className="sub">Загрузка…</p>}>
        <ResetForm />
      </Suspense>
    </AuthCenter>
  );
}
