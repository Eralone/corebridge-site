import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { OrganizationLd } from '@/components/JsonLd';
import { LandingBody } from './LandingBody';

export const metadata: Metadata = {
  title: 'Интеграция 1С с маркетплейсами, CRM и сайтами — CoreBridge',
  description:
    'Интеграция 1С с маркетплейсами, сайтами, CRM, доставкой и оплатой: заказы, остатки, цены, ' +
    'маркировка «Честный знак». Для УТ 11, УНФ, КА 2 / ERP и Бухгалтерии 3.0.',
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
