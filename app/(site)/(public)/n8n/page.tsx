import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { N8nBody } from './N8nBody';

export const metadata: Metadata = {
  title: 'Автоматизация 1С: API, вебхуки, сценарии n8n — CoreBridge',
  description:
    'Своя логика поверх интеграции 1С: вызовы API, вебхуки, условия и расписания. ' +
    'Готовые сценарии n8n включаются одной кнопкой, без программиста.',
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
