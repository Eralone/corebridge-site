'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import {
  deleteIntegration,
  getIntegrations,
  pauseIntegration,
  resumeIntegration,
  saveCredentials,
} from '@/lib/api/lk';
import type { Integration } from '@/lib/contracts/lk';
import { adapterInfo } from '@/lib/adapters';
import { timeAgo } from '@/components/lk/events';
import { Popup } from '@/components/Popup';

/**
 * Мои интеграции. Отличия от design-source/integrations-app.html:
 *
 * · ⚠️ **модальное окно каталога не переносим.** Завести интеграцию с сайта
 *   нельзя: она создаётся из .epf через bridge, а у `/lk/integrations` есть
 *   только чтение, пауза, ключи и удаление. Кнопка «+ Добавить интеграцию»
 *   ведёт на `/epf`, где всё и начинается;
 * · три блока `.preview-block` внизу макета («Представление: таблица»,
 *   «Состояние: пусто», «Модальное окно») — это макеты состояний, а не секции
 *   экрана. Пустое состояние стало условным, остальное не переносится;
 * · поля «Запросов за месяц», «Контрагент» и «Склад 1С» сервер не отдаёт — «—»;
 * · счётчики в подзаголовке и вкладках считаются, а не зашиты.
 */

type StatusFilter = 'all' | 'active' | 'paused' | 'error';

const STATUS: Record<string, { cls: string; label: string }> = {
  active: { cls: 'badge-success', label: 'Active' },
  paused: { cls: 'badge-warning', label: 'Paused' },
  error: { cls: 'badge-danger', label: 'Error' },
  pending: { cls: 'badge-neutral', label: 'Pending' },
};

export function IntegrationsBody() {
  const [items, setItems] = useState<Integration[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<string>('Все');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [creds, setCreds] = useState<Integration | null>(null);

  const reload = () =>
    getIntegrations()
      .then(setItems)
      .catch(() => setFailed(true));

  useEffect(() => {
    void reload();
  }, []);

  const cats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items ?? []) {
      const c = adapterInfo(i.adapter_type).cat;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const visible = (items ?? []).filter((i) => {
    const info = adapterInfo(i.adapter_type);
    if (tab !== 'Все' && info.cat !== tab) return false;
    if (status !== 'all' && i.status !== status) return false;
    if (query) {
      const hay = `${i.display_name ?? ''} ${info.name} ${i.integration_id} ${i.adapter_type}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const active = (items ?? []).filter((i) => i.status === 'active').length;
  const broken = (items ?? []).filter((i) => i.status === 'error').length;

  async function act(id: string, fn: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    setNote(null);
    try {
      await fn();
      await reload();
      setNote(ok);
    } catch (e) {
      setNote(
        e instanceof ApiError && e.status === 403
          ? 'Недостаточно прав: это действие доступно владельцу аккаунта.'
          : 'Не получилось. Попробуйте ещё раз.',
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {failed && <div className="lk-error">Не удалось загрузить список интеграций. Обновите страницу.</div>}
      {note && (
        <div className="lk-error" style={{ background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
          {note}
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>Мои интеграции</h1>
          <p className="text-muted">
            Управляйте подключёнными сервисами и автоматизациями
            {items && items.length > 0 && (
              <>
                {' · '}
                <span className="badge badge-success badge-dot">{active} активных</span>
                {broken > 0 && (
                  <>
                    {' · '}
                    <span className="badge badge-danger badge-dot">{broken} с ошибкой</span>
                  </>
                )}
              </>
            )}
          </p>
        </div>
        {/* в макете кнопка открывала каталог-модалку; завести интеграцию
            с сайта нельзя — путь начинается с файла .epf */}
        <Link href="/epf" className="btn btn-primary">
          + Добавить интеграцию
        </Link>
      </div>

      {items && items.length > 0 && (
        <div className="toolbar">
          <div className="tabs">
            <a className={tab === 'Все' ? 'active' : undefined} onClick={() => setTab('Все')}>
              Все ({items.length})
            </a>
            {[...cats.entries()].map(([c, n]) => (
              <a key={c} className={tab === c ? 'active' : undefined} onClick={() => setTab(c)}>
                {c} ({n})
              </a>
            ))}
          </div>
          <div className="filters">
            <div className="search-input">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                className="input"
                placeholder="Поиск по названию…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="select"
              style={{ width: 'auto' }}
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              <option value="all">Все статусы</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>
      )}

      {items === null ? (
        <div className="lk-empty">Загружаем…</div>
      ) : items.length === 0 ? (
        <div className="int-cards">
          <Link href="/epf" className="icard-empty">
            <div className="pluscir">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>Интеграций пока нет</div>
              Скачайте файл .epf, вставьте токен в 1С и выберите сервис — интеграция появится здесь
              сама.
            </div>
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="lk-empty">
          <div className="ttl">Ничего не найдено</div>
          Измените запрос или снимите фильтры.
        </div>
      ) : (
        <div className="int-cards">
          {visible.map((i) => {
            const info = adapterInfo(i.adapter_type);
            const s = STATUS[i.status] ?? { cls: 'badge-neutral', label: i.status };
            const name = i.display_name || info.name;
            return (
              <article className="icard" key={i.integration_id}>
                <div className="icard-head">
                  <div className="row gap-12">
                    <div className="ic-ic" style={{ background: info.color, color: info.fg ?? '#fff' }}>
                      {info.glyph}
                    </div>
                    <div>
                      <h4>{name}</h4>
                      <div className="id">{i.integration_id}</div>
                    </div>
                  </div>
                </div>

                <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                  <span className="badge badge-neutral">{i.adapter_type}</span>
                  <span className={`badge ${s.cls} badge-dot`}>{s.label}</span>
                  {i.needs_reauth && <span className="badge badge-warning">нужны новые ключи</span>}
                </div>

                <div className="meta-row">
                  {/* requests_this_month, контрагент и склад 1С сервер не отдаёт */}
                  <span>
                    Запросов<strong>—</strong>
                  </span>
                  <span>
                    Последняя<strong>{i.last_sync_at ? timeAgo(i.last_sync_at) : 'не было'}</strong>
                  </span>
                  <span>
                    Ошибок<strong>{i.error_count}</strong>
                  </span>
                </div>

                <div className="icard-footer">
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setCreds(i)}
                    disabled={busyId === i.integration_id}
                  >
                    {i.needs_reauth ? 'Обновить ключи' : 'Настроить'}
                  </button>
                  {i.paused ? (
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={busyId === i.integration_id}
                      onClick={() =>
                        act(i.integration_id, () => resumeIntegration(i.integration_id), 'Обмен возобновлён.')
                      }
                    >
                      Возобновить
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={busyId === i.integration_id}
                      onClick={() =>
                        act(i.integration_id, () => pauseIntegration(i.integration_id), 'Обмен приостановлен.')
                      }
                    >
                      Пауза
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {creds && (
        <CredentialsForm
          integration={creds}
          busy={busyId === creds.integration_id}
          onClose={() => setCreds(null)}
          onSave={async (body) => {
            await act(creds.integration_id, () => saveCredentials(creds.integration_id, body), 'Ключи сохранены.');
            setCreds(null);
          }}
          onDelete={async () => {
            await act(
              creds.integration_id,
              () => deleteIntegration(creds.integration_id),
              'Интеграция удалена.',
            );
            setCreds(null);
          }}
        />
      )}
    </>
  );
}

/**
 * Форма ввода доступов. В макете её роль играла модалка каталога с описанием
 * «где взять ключи» — эти подсказки остались нужны, а выбор сервиса нет:
 * интеграция уже существует, меняем только ключи.
 */
function CredentialsForm({
  integration,
  busy,
  onClose,
  onSave,
  onDelete,
}: {
  integration: Integration;
  busy: boolean;
  onClose: () => void;
  onSave: (body: { adapter_type: string; api_key: string; api_secret?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const info = adapterInfo(integration.adapter_type);

  return (
    <Popup open title={`${info.name}: доступы`} onClose={onClose} actions={[]}>
      <p className="text-muted" style={{ fontSize: 13.5, marginTop: 0 }}>
        Ключи хранятся в зашифрованном виде и не показываются обратно — введите их заново, если
        меняете.
      </p>
      <div className="field">
        <label htmlFor="api-key">API-ключ</label>
        <input
          id="api-key"
          className="input"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="field">
        <label htmlFor="api-secret">Секрет (если сервис его выдаёт)</label>
        <input
          id="api-secret"
          className="input"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="row gap-8" style={{ justifyContent: 'space-between', marginTop: 20 }}>
        <button
          className="btn btn-danger-outline btn-sm"
          disabled={busy}
          onClick={() => {
            if (confirm('Удалить интеграцию? Обмен по ней прекратится.')) void onDelete();
          }}
        >
          Удалить интеграцию
        </button>
        <div className="row gap-8">
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !key}
            onClick={() =>
              void onSave({
                adapter_type: integration.adapter_type,
                api_key: key,
                ...(secret ? { api_secret: secret } : {}),
              })
            }
          >
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </Popup>
  );
}
