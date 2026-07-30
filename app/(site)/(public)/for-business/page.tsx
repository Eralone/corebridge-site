import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { ForBusinessBody } from './ForBusinessBody';

export const metadata: Metadata = {
  title: 'Для бизнеса — CoreBridge',
  description:
    'Корпоративные интеграции 1С: ритейл, оптовая торговля, производство, ИТ-интеграторы. Установка на своём сервере, заявка на внедрение.',
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
