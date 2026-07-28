import type { AuditEntry } from '@/lib/contracts/lk';

/**
 * Лента событий на дашборде. В макете это пять придуманных строк
 * («Синхронизация остатков Ozon MP_001 завершена»), у сервера — журнал
 * `platform.audit_log` с кодами действий. Здесь перевод одного в другое.
 *
 * Набор кодов открытый: сервер добавляет новые по мере роста механик.
 * Поэтому незнакомый код не прячем и не роняем экран, а показываем как есть —
 * лучше техническая строка, чем пропавшее событие.
 */

type Kind = 'ok' | 'err' | 'info';

const KNOWN: Record<string, { kind: Kind; text: (e: AuditEntry) => string }> = {
  user_registered: { kind: 'ok', text: () => 'Аккаунт создан' },
  user_invited: { kind: 'info', text: (e) => `Приглашён участник ${val(e, 'email')}` },
  user_accepted_invite: { kind: 'ok', text: () => 'Участник присоединился к команде' },
  user_role_changed: { kind: 'info', text: (e) => `Роль изменена на ${val(e, 'role')}` },
  user_deleted: { kind: 'info', text: () => 'Участник удалён из команды' },
  password_reset: { kind: 'info', text: () => 'Пароль изменён' },
  password_changed: { kind: 'info', text: () => 'Пароль изменён' },
  license_issued: { kind: 'ok', text: (e) => `Выдана лицензия · тариф ${val(e, 'plan')}` },
  license_refreshed: { kind: 'info', text: () => 'Токен доступа обновлён' },
  payment_confirmed: { kind: 'ok', text: (e) => `Оплата подтверждена${amount(e)}` },
  plan_changed: { kind: 'info', text: (e) => `Тариф изменён на ${val(e, 'plan')}` },
  integration_created: { kind: 'ok', text: (e) => `Подключена интеграция ${val(e, 'adapter_type')}` },
  integration_activated: { kind: 'ok', text: (e) => `Интеграция включена ${val(e, 'adapter_type')}` },
  integration_deactivated: { kind: 'info', text: (e) => `Интеграция выключена ${val(e, 'adapter_type')}` },
  integration_error: { kind: 'err', text: (e) => `Ошибка интеграции ${val(e, 'adapter_type')}` },
  workflow_activated: { kind: 'ok', text: (e) => `Воркфлоу включён ${val(e, 'name')}` },
  workflow_deactivated: { kind: 'info', text: (e) => `Воркфлоу выключен ${val(e, 'name')}` },
  twofactor_enabled: { kind: 'ok', text: () => 'Включён второй фактор' },
  twofactor_disabled: { kind: 'info', text: () => 'Отключён второй фактор' },
  telegram_linked: { kind: 'ok', text: () => 'Telegram привязан' },
  telegram_unlinked: { kind: 'info', text: () => 'Telegram отвязан' },
  privacy_request_created: { kind: 'info', text: (e) => `Обращение по данным · ${val(e, 'type')}` },
  tenant_blocked: { kind: 'err', text: () => 'Доступ компании приостановлен' },
  tenant_deletion_scheduled: { kind: 'err', text: () => 'Запрошено удаление аккаунта' },
};

function val(e: AuditEntry, key: string): string {
  const v = e.new_value?.[key];
  return v == null ? '' : String(v);
}

function amount(e: AuditEntry): string {
  const v = e.new_value?.amount;
  return typeof v === 'number' ? ` · ${v.toLocaleString('ru-RU')} ₽` : '';
}

export function describe(e: AuditEntry): { kind: Kind; text: string } {
  const known = KNOWN[e.action];
  if (known) return { kind: known.kind, text: known.text(e).trim() };
  // запасной вариант: код действия как есть — событие лучше показать, чем скрыть
  return { kind: e.action.includes('error') || e.action.includes('failed') ? 'err' : 'info', text: e.action };
}

/** «3 минуты назад». Без библиотеки: Intl умеет это сам */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ];
  let v = diff;
  for (const [unit, span] of steps) {
    if (Math.abs(v) < span) return rtf.format(Math.round(v), unit);
    v /= span;
  }
  return rtf.format(Math.round(v), 'year');
}

const ICONS: Record<Kind, JSX.Element> = {
  ok: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  err: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 16v-4M12 8h.01" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
};

export function EventRow({ entry }: { entry: AuditEntry }) {
  const { kind, text } = describe(entry);
  return (
    <div className="event">
      <div className={`event-dot ${kind}`}>{ICONS[kind]}</div>
      <div>
        <div className="event-text">{text}</div>
        <div className="event-time">{timeAgo(entry.created_at)}</div>
      </div>
    </div>
  );
}
