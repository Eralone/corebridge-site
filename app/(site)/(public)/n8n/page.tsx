import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { N8nBody } from './N8nBody';

export const metadata: Metadata = {
  title: 'Сценарии n8n — CoreBridge',
  description:
    'Свои правила поверх готовых интеграций 1С: условия, расписания и уведомления. Готовые сценарии включаются одной кнопкой.',
  alternates: { canonical: 'https://corebridge.ru/n8n' },
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <N8nBody />
      <PublicFooter />
    </>
  );
}
