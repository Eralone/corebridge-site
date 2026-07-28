import type { Metadata } from 'next';
import { AuthCenter } from '@/components/auth/AuthSplit';
import { ForgotForm } from './ForgotForm';

export const metadata: Metadata = {
  title: 'Восстановление пароля — CoreBridge',
  robots: { index: false },
};

export default function Page() {
  return (
    <AuthCenter>
      <ForgotForm />
    </AuthCenter>
  );
}
