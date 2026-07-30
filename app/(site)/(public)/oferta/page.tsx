import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Публичная оферта — CoreBridge',
  description: 'Публичная оферта CoreBridge: условия оказания услуг, порядок оплаты и реквизиты исполнителя.',
  alternates: { canonical: 'https://corebridge.ru/oferta' },
};

export default function Page() {
  return <LegalPage name="oferta" />;
}
