import type { Metadata } from 'next';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { LandingBody } from './LandingBody';

export const metadata: Metadata = {
  title: 'CoreBridge — no-code сервисная интеграция 1С',
  description:
    'Один файл .epf подключает вашу 1С к 33 сервисам: маркетплейсы, сайты, CRM, доставка, оплата и аналитика. Без программистов и без серверов.',
  alternates: { canonical: 'https://corebridge.ru/' },
};

export default function Page() {
  return (
    <>
      <PublicHeader />
      <LandingBody />
      <PublicFooter />
    </>
  );
}
