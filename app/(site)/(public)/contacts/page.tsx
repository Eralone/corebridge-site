import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { ContactsBody } from './ContactsBody';

export const metadata: Metadata = {
  // ⚠️ в эталоне описание обещало «офис в Москве, Telegram» — ни того, ни другого нет.
  // Телефона тоже не обещаем: обращения только по email (решение Дмитрия 2026-08-01)
  title: 'Контакты CoreBridge — связаться с командой',
  description:
    'Как связаться с CoreBridge: почта info@corebridge.ru, форма обращения по вопросам ' +
    'интеграции 1С, подключения и оплаты. Реквизиты Исполнителя и ИНН.',
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
