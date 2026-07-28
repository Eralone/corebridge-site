import type { Metadata } from 'next';
import { AuthCenter } from '@/components/auth/AuthSplit';
import { AcceptForm } from './AcceptForm';

export const metadata: Metadata = {
  title: 'Приглашение в команду — CoreBridge',
  robots: { index: false },
};

export default function Page({ searchParams }: { searchParams: { token?: string } }) {
  return (
    <AuthCenter>
      <AcceptForm token={searchParams.token ?? null} />
    </AuthCenter>
  );
}
