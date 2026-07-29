import type { ReactNode } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import '@/styles/admin.css';

/**
 * Каркас админ-субдомена. Экраны лежат под app/(admin)/admin/, а открываются
 * в корне admin.corebridge.ru — пути переписывает middleware.ts, потому что
 * /admin/* на этом домене забирает nginx и отправляет в API.
 *
 * Вход проверяет AdminGuard в браузере: cookie админ-сессии имеет path=/admin
 * и на запрос страницы не отправляется, поэтому серверный guard невозможен.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminGuard>{children}</AdminGuard>;
}
