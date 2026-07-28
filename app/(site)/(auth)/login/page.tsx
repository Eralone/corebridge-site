import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AuthSplit } from '@/components/auth/AuthSplit';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Вход в CoreBridge — личный кабинет',
  description:
    'Войдите в личный кабинет CoreBridge — платформу интеграции 1С с маркетплейсами и CRM.',
  robots: { index: false },
};

export default function Page() {
  return (
    <AuthSplit
      title="Интеграция 1С с маркетплейсами — без единой строки кода"
      lead="Один .epf-файл соединяет вашу 1С с Ozon, Wildberries, Битрикс24, СДЭК и ещё 30+ сервисами."
      features={[
        '22 готовые механики интеграции',
        'Поддержка УТ 11, УНФ, КА/ERP, БП 3.0',
        // в макете «30 дней пробного доступа» — на сервере пробный тариф бессрочный
        'Бессрочный пробный тариф',
        'Данные не покидают ваш контур',
      ]}
      // подпись внизу панели в макете — отзыв от имени выдуманного человека, не переносим
    >
      {/* useSearchParams требует границы Suspense, иначе страница не пререндерится */}
      <Suspense fallback={<div className="sub">Загрузка…</div>}>
        <LoginForm />
      </Suspense>
    </AuthSplit>
  );
}
