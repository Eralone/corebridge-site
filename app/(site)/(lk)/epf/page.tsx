import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { EpfBody } from './EpfBody';

export const metadata: Metadata = { title: 'Файл .epf — CoreBridge', robots: { index: false } };

export default function Page() {
  return (
    <LkShell
      active="epf"
      title="Файл .epf и JWT-токен"
      subtitle="Всё, чтобы запустить интеграцию"
    >
      <EpfBody />
    </LkShell>
  );
}
