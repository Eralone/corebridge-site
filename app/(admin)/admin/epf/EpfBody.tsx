'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import { getEpfVersions, releaseEpf, rollbackEpf } from '@/lib/api/admin';
import type { AdminEpfVersion } from '@/lib/contracts/admin';
import { Blocked, dt } from '@/components/admin/bits';

/** Конфигурации проверены у сервера: `/lk/epf/versions?config=erp` → INVALID_CONFIG со списком */
const CONFIGS: { code: string; title: string }[] = [
  { code: 'ut11', title: 'Управление торговлей 11' },
  { code: 'unf', title: 'Управление нашей фирмой' },
  { code: 'ka', title: 'Комплексная автоматизация' },
  { code: 'bp', title: 'Бухгалтерия предприятия 3.0' },
];

/**
 * Сборки .epf. **Макета нет** — собрано по образцу `admin-users.html`.
 *
 * Список версий сервер починил пакетом S13 — заодно добавил `file_size`,
 * `force_update` и `release_notes`. Обработку отказа оставляю: если источник
 * снова отвалится, экран скажет об этом, а не покажет пустую таблицу.
 */
export function EpfBody() {
  const [versions, setVersions] = useState<AdminEpfVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    getEpfVersions()
      .then((r) => setVersions(r.versions))
      .catch(() => {
        setFailed(true);
        setVersions([]);
      });
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Сборки .epf</h1>
          <p className="text-muted">
            Обработки для 1С. Активная версия — та, которую скачивают клиенты и на которую
            ориентируется проверка обновлений.
          </p>
        </div>
      </div>

      {note && (
        <div className="lk-error" style={{ background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
          {note}
        </div>
      )}
      {failed && <Blocked what="список версий" endpoint="GET /admin/epf/versions" />}

      <ReleaseForm onDone={(m) => { setNote(m); load(); }} />

      {CONFIGS.map((c) => {
        const list = (versions ?? []).filter((v) => v.config === c.code);
        return (
          <div className="adm-table-card mb-24" key={c.code}>
            <div className="h">
              <h3>
                {c.title} <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-faint)' }}>{c.code}</span>
              </h3>
              {list.length > 0 && (
                <span className="text-muted" style={{ fontSize: 12.5 }}>
                  версий: {list.length}
                </span>
              )}
            </div>
            {versions === null ? (
              <div className="adm-empty">Загружаем…</div>
            ) : list.length === 0 ? (
              <div className="adm-empty">
                {failed ? 'Список не пришёл — см. сообщение выше' : 'Сборок для этой конфигурации ещё нет'}
              </div>
            ) : (
              <div className="adm-scroll">
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Версия</th>
                      <th>Опубликована</th>
                      <th>Размер</th>
                      <th>Хэш</th>
                      <th>Состояние</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <b>{v.version}</b>
                          {v.force_update && (
                            <div style={{ fontSize: 11, color: 'var(--warning)' }}>обязательное обновление</div>
                          )}
                        </td>
                        <td>{dt(v.released_at)}</td>
                        <td>{v.file_size ? `${(v.file_size / 1024).toFixed(0)} КБ` : '—'}</td>
                        <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                          {v.sha256_hash ? `${v.sha256_hash.slice(0, 12)}…` : '—'}
                        </td>
                        <td>
                          {v.is_active ? (
                            <span className="badge badge-success">активная</span>
                          ) : v.is_deprecated ? (
                            <span className="badge badge-neutral">снята</span>
                          ) : (
                            <span className="badge badge-neutral">не активна</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Публикация и откат: обе операции принимают конфигурацию и версию явно */
function ReleaseForm({ onDone }: { onDone: (msg: string) => void }) {
  const [config, setConfig] = useState(CONFIGS[0].code);
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'release' | 'rollback') {
    setBusy(true);
    setError(null);
    try {
      await (kind === 'release' ? releaseEpf(config, version.trim()) : rollbackEpf(config, version.trim()));
      onDone(
        kind === 'release'
          ? `Версия ${version.trim()} для «${config}» стала активной — клиенты получат её при следующей проверке обновлений.`
          : `Откат на версию ${version.trim()} для «${config}» выполнен.`,
      );
      setVersion('');
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? 'Такой версии нет — проверьте номер.'
          : e instanceof ApiError && e.status === 400
            ? 'Сервер не принял конфигурацию или версию.'
            : 'Действие не выполнено.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="filter-bar" style={{ alignItems: 'flex-end' }}>
      <div className="field" style={{ margin: 0, minWidth: 220 }}>
        <label htmlFor="epf-config">Конфигурация</label>
        <select id="epf-config" className="select" value={config} onChange={(e) => setConfig(e.target.value)}>
          {CONFIGS.map((c) => (
            <option value={c.code} key={c.code}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      <div className="field" style={{ margin: 0, minWidth: 160 }}>
        <label htmlFor="epf-version">Версия</label>
        <input
          id="epf-version"
          className="input"
          placeholder="1.2.0"
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
      </div>
      <button
        className="btn btn-primary btn-sm"
        disabled={busy || !version.trim()}
        onClick={() => run('release')}
      >
        {busy ? 'Выполняем…' : 'Сделать активной'}
      </button>
      <button className="btn btn-outline btn-sm" disabled={busy || !version.trim()} onClick={() => run('rollback')}>
        Откатить на неё
      </button>
      {error && (
        <div className="lk-error" style={{ flexBasis: '100%', margin: 0 }}>
          {error}
        </div>
      )}
    </div>
  );
}
