import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { ContactsBody } from './ContactsBody';

export const metadata: Metadata = {
  // ⚠️ в эталоне описание обещало «офис в Москве, Telegram» — ни того, ни другого нет
  title: 'Контакты CoreBridge — связаться с командой',
  description: 'Контакты CoreBridge: телефон, email, форма обращения. Реквизиты Исполнителя.',
  alternates: { canonical: 'https://corebridge.ru/contacts' },
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <ContactsBody />
      <PublicFooter />
    </>
  );
}
