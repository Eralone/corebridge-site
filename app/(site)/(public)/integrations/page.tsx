import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { IntegrationsCatalog } from './IntegrationsCatalog';

export const metadata: Metadata = {
  title: 'Интеграции 1С: маркетплейсы, CRM, доставка — CoreBridge',
  description:
    'Каталог интеграций 1С: Ozon, Wildberries, Яндекс.Маркет, Битрикс24, AmoCRM, СДЭК, ЮKassa, ' +
    'Telegram, МойСклад, Google Sheets — что умеет каждая.',
  alternates: { canonical: 'https://corebridge.ru/integrations' },
};

export default function Page() {
  return (
    <>
      <PublicHeader active="integrations" />
      <IntegrationsCatalog />
      <PublicFooter />
    </>
  );
}
