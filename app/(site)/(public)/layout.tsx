import type { ReactNode } from 'react';
import '@/styles/public.css';

/**
 * Публичные страницы. Здесь подключаются их постраничные стили — в эталоне
 * они лежали в <style> внутри каждого HTML-файла.
 *
 * Шапку и подвал подключает каждая страница сама: у части экранов (юридические,
 * например) свой состав навигации, а оборачивать всё одинаково нельзя.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
