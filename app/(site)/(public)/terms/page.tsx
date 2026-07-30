import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Условия использования — CoreBridge',
  description: 'Условия использования платформы CoreBridge: тарифы, лимиты, права и обязанности сторон.',
  alternates: { canonical: 'https://corebridge.ru/terms' },
};

export default function Page() {
  return <LegalPage name="terms" />;
}
