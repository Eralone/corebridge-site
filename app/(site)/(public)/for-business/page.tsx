import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { ForBusinessBody } from './ForBusinessBody';

export const metadata: Metadata = {
  title: 'Интеграция 1С для бизнеса и интеграторов — CoreBridge',
  description:
    'Корпоративная интеграция 1С с маркетплейсами и CRM: ритейл, оптовая торговля, производство, ' +
    'ИТ-интеграторы. Установка на своём сервере, сопровождение, заявка на внедрение.',
  alternates: { canonical: 'https://corebridge.ru/for-business' },
};

export default function Page() {
  return (
    <>
      <PublicHeader active="about" />
      <ForBusinessBody />
      <PublicFooter />
    </>
  );
}
