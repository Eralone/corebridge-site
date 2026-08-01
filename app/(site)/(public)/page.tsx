import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { OrganizationLd } from '@/components/JsonLd';
import { LandingBody } from './LandingBody';

export const metadata: Metadata = {
  title: 'Интеграция 1С с маркетплейсами, CRM и сайтами — CoreBridge',
  description:
    'Интеграция 1С с Ozon, Wildberries, Яндекс.Маркетом, Битрикс24, СДЭК и ещё 30 сервисами. ' +
    'Один файл .epf для УТ 11, УНФ, КА 2 / ERP и Бухгалтерии 3.0 — без программистов.',
  alternates: { canonical: 'https://corebridge.ru/' },
};

export default function Page() {
  return (
    <>
      <OrganizationLd />
      <PublicHeader />
      <LandingBody />
      <PublicFooter />
    </>
  );
}
