import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { IntegrationsCatalog } from './IntegrationsCatalog';

export const metadata: Metadata = {
  title: 'Интеграции — CoreBridge',
  description:
    '33 сервиса в 8 категориях: маркетплейсы, сайты, CRM, доставка, оплата, маркетинг, мессенджеры и аналитика. Подключаются галочкой в файле .epf.',
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
