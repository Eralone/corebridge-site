import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности — CoreBridge',
  description: 'Как CoreBridge обрабатывает персональные данные: цели, сроки, права субъекта и порядок обращения.',
  alternates: { canonical: 'https://corebridge.ru/privacy' },
};

export default function Page() {
  return <LegalPage name="privacy" />;
}
