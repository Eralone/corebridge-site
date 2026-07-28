import type { Metadata } from 'next';
import { AuthSplit } from '@/components/auth/AuthSplit';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = {
  title: 'Регистрация в CoreBridge',
  description:
    'Создайте аккаунт CoreBridge и подключите 1С к маркетплейсам, CRM и сервисам доставки без программистов.',
  robots: { index: false },
};

export default function Page() {
  return (
    <AuthSplit
      warm
      title="Бессрочный пробный тариф"
      lead="Все механики. Любая конфигурация 1С. Без кредитной карты."
      features={[
        '22 механики · маркетплейсы, CRM, сервисы',
        'n8n-шаблоны включены',
        // в макете «1 проект · 5 операций в сутки» — на сервере лимит месячный
        '1 проект · 500 операций в месяц',
        'Отмена в любой момент',
      ]}
      // в макете внизу панели «Уже с нами: 1 247 компаний» — цифра выдуманная
    >
      <RegisterForm />
    </AuthSplit>
  );
}
