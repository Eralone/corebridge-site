'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api/client';
import { getEpfVersions, getFullToken, refreshToken, requestEpfDownload } from '@/lib/api/lk';
import type { EpfConfig, EpfVersion } from '@/lib/contracts/lk';

/**
 * Файл .epf и JWT-токен. Отличия от design-source/epf.html:
 *
 * · ⚠️ конфигурации взяты у сервера: `ut11 | unf | ka | bp`. Карточки «1С:ERP»
 *   из макета нет такой сборки (`/lk/epf/versions?config=erp` → INVALID_CONFIG),
 *   зато есть «БП 3.0», которой в макете не было;
 * · версии и размер файла — из `GET /lk/epf/versions`, а не зашиты «v3.1.4 · 2.8 МБ»;
 * · ⚠️ из блока «Как это работает» убрано обещание инструкции в PDF: сервер её
 *   не отдаёт и на почту не шлёт. Кнопка «📄 Инструкция (PDF)» по той же причине
 *   заменена ссылкой на документацию;
 * · «Обновить» токен обрабатывает `402 NO_ACTIVE_SUBSCRIPTION` — на сервере
 *   перевыпуск разрешён только при подтверждённой оплате.
 */

const CONFIGS: { code: EpfConfig; name: string; full: string }[] = [
  { code: 'ut11', name: '1С:УТ', full: 'Управление торговлей 11' },
  { code: 'unf', name: '1С:УНФ', full: 'Управление нашей фирмой' },
  { code: 'ka', name: '1С:КА', full: 'Комплексная автоматизация' },
  { code: 'bp', name: '1С:БП', full: 'Бухгалтерия предприятия 3.0' },
];

export function EpfBody() {
  const [config, setConfig] = useState<EpfConfig>('ut11');
  const [versions, setVersions] = useState<Record<string, EpfVersion[]>>({});
  const [token, setToken] = useState<string | null>(null);
  const [validUntil, setValidUntil] = useState<number | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState<string | null>(null);

  useEffect(() => {
    getFullToken()
      .then((r) => {
        setToken(r.token);
        setValidUntil(r.valid_until);
      })
      .catch((e) => {
        // токен целиком видит только владелец — остальным объясняем, а не молчим
        setTokenError(
          e instanceof ApiError && (e.status === 403 || e.code === 'FORBIDDEN')
            ? 'Полный токен доступен только владельцу аккаунта. Попросите его скопировать токен для вас.'
            : // без активной лицензии токена просто нет — это не сбой, а состояние
              // аккаунта, и человеку нужно сказать, что делать (нашёл прогон ролей)
              e instanceof ApiError && e.code === 'TOKEN_NOT_FOUND'
              ? 'Активной лицензии нет, поэтому токен не выдан. Оформите тариф — токен появится здесь сразу после оплаты.'
              : 'Не удалось получить токен. Обновите страницу.',
        );
      });
  }, []);

  useEffect(() => {
    if (versions[config]) return;
    getEpfVersions(config)
      .then((r) => setVersions((v) => ({ ...v, [config]: r.versions })))
      .catch(() => setVersions((v) => ({ ...v, [config]: [] })));
  }, [config, versions]);

  const list = versions[config];
  const active = list?.find((v) => v.is_active) ?? list?.[0] ?? null;
  const previous = list?.filter((v) => v !== active)[0] ?? null;
  const cfg = CONFIGS.find((c) => c.code === config)!;

  return (
    <>
      <div className="row" style={{ gap: 16, marginBottom: 10, fontSize: 13, color: 'var(--text-muted)' }}>
        <Link href="/dashboard" style={{ color: 'inherit', textDecoration: 'none' }}>
          Дашборд
        </Link>{' '}
        / <span>Файл .epf</span>
      </div>

      <div
        className="card mb-20"
        style={{
          background: 'linear-gradient(135deg,rgba(62,146,204,.08),rgba(255,107,53,.04))',
          borderLeft: '4px solid var(--blue-500)',
        }}
      >
        <div className="row gap-16" style={{ alignItems: 'flex-start' }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: 'var(--blue-500)',
              color: '#fff',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
          </div>
          <div>
            <b>Как это работает</b>
            <p className="text-muted mt-8" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              1. Выбираете конфигурацию 1С. 2. Копируете JWT-токен. 3. Скачиваете .epf.
              4. Открываете файл в 1С, вставляете токен и выбираете сервис. 5. Запускаете обмен.
              {/* в макете здесь обещали инструкцию в PDF — сервер её не отдаёт */}{' '}
              Пошаговое описание — в <Link href="/docs">документации</Link>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Шаг 1 ───────────────────────────────────────────────────────── */}
      <div className="step-head">
        <div className="n">1</div>
        <h3>Выберите конфигурацию 1С</h3>
      </div>
      <p className="text-muted mb-16" style={{ fontSize: 13.5 }}>
        Для каждой конфигурации — отдельная сборка .epf. Скачать можно только ту, что подходит вашей 1С.
      </p>
      <div className="cfg-grid">
        {CONFIGS.map((c) => {
          const v = versions[c.code]?.find((x) => x.is_active) ?? versions[c.code]?.[0];
          return (
            <button
              key={c.code}
              type="button"
              className={`cfg${config === c.code ? ' selected' : ''}`}
              onClick={() => setConfig(c.code)}
            >
              <div className="cfg-name">{c.name}</div>
              <div className="cfg-full">{c.full}</div>
              <div className="cfg-v">{v ? `v${v.version} · ${size(v.file_size)}` : 'сборки пока нет'}</div>
            </button>
          );
        })}
      </div>

      {/* ── Шаг 2 ───────────────────────────────────────────────────────── */}
      <div className="step-head">
        <div className="n">2</div>
        <h3>Скопируйте ваш JWT-токен</h3>
      </div>
      <p className="text-muted mb-16" style={{ fontSize: 13.5 }}>
        Токен привязывает .epf к вашему аккаунту. Никому его не передавайте.
      </p>

      {tokenError ? (
        <div className="lk-error">{tokenError}</div>
      ) : (
        <div className="token-box">
          <label>JWT-токен</label>
          <div className="token-line">
            <code>{token ?? 'загружаем…'}</code>
            <button
              type="button"
              disabled={!token}
              onClick={async () => {
                if (!token) return;
                await navigator.clipboard.writeText(token).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? 'Скопировано' : 'Скопировать'}
            </button>
            <button
              type="button"
              title="Перевыпустить токен"
              disabled={!token || busy}
              onClick={async () => {
                setNote(null);
                setBusy(true);
                try {
                  const r = await refreshToken();
                  setToken(r.token);
                  setNote('Токен перевыпущен. Вставьте новый в .epf — старый больше не действует.');
                } catch (e) {
                  setNote(
                    e instanceof ApiError && e.code === 'NO_ACTIVE_SUBSCRIPTION'
                      ? 'Перевыпуск токена доступен на платном тарифе. На пробном токен выдаётся один раз.'
                      : 'Не удалось перевыпустить токен. Попробуйте позже.',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>
          <div className="token-meta">
            <div>
              <b>Действителен до:</b>{' '}
              {/* valid_until: null — бессрочная лицензия пробного тарифа */}
              {validUntil === null ? 'бессрочно' : new Date(validUntil * 1000).toLocaleDateString('ru-RU')}
            </div>
          </div>
        </div>
      )}
      {note && (
        <div className="lk-error" style={{ marginTop: 12, background: 'var(--blue-100)', color: 'var(--navy-700)' }}>
          {note}
        </div>
      )}

      {/* ── Шаг 3 ───────────────────────────────────────────────────────── */}
      <div className="step-head">
        <div className="n">3</div>
        <h3>Скачайте файл .epf</h3>
      </div>
      <div className="row gap-12" style={{ flexWrap: 'wrap' }}>
        {active ? (
          <button
            type="button"
            className="dl-btn"
            style={{ maxWidth: 420 }}
            disabled={downloading}
            onClick={async () => {
              setDlError(null);
              setDownloading(true);
              try {
                // эндпоинт отдаёт не файл, а одноразовый адрес — по нему и уходим
                const r = await requestEpfDownload(config);
                window.location.href = r.downloadUrl;
              } catch (e) {
                setDlError(
                  e instanceof ApiError && e.code === 'EPF_NOT_FOUND'
                    ? 'Сборка для этой конфигурации ещё не опубликована.'
                    : 'Скачивание временно недоступно. Мы уже знаем о проблеме — попробуйте позже.',
                );
              } finally {
                setDownloading(false);
              }
            }}
          >
            <div className="ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <span>{downloading ? 'Готовим файл…' : `CoreBridge_${config.toUpperCase()}_v${active.version}.epf`}</span>
              <div className="meta">
                Для {cfg.full} · {size(active.file_size)}
              </div>
            </div>
          </button>
        ) : (
          <button className="dl-btn" style={{ maxWidth: 420 }} disabled>
            <div className="ic">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <span>Сборка готовится</span>
              <div className="meta">Файл для «{cfg.full}» ещё не опубликован</div>
            </div>
          </button>
        )}
        <Link href="/docs" className="btn btn-outline">
          Инструкция по установке
        </Link>
      </div>

      {dlError && <div className="lk-error" style={{ marginTop: 12 }}>{dlError}</div>}

      {list && list.length > 0 && (
        <div className="version-list">
          {previous && (
            <div className="version">
              <span>Предыдущая версия</span>
              <code>
                v{previous.version} · {date(previous.released_at)}
              </code>
            </div>
          )}
          {active && (
            <div className="version">
              <span>Текущая</span>
              <code>
                v{active.version} · {date(active.released_at)}
              </code>
            </div>
          )}
        </div>
      )}
      {list && list.length === 0 && (
        <div className="lk-empty" style={{ textAlign: 'left', padding: '14px 0' }}>
          Сборки для «{cfg.full}» ещё не публиковались. Как только файл появится, он станет доступен здесь.
        </div>
      )}
    </>
  );
}

/** bigint из Postgres приезжает строкой — приводим явно, иначе NaN */
function size(bytes: number | string): string {
  const mb = Number(bytes) / 1024 / 1024;
  return mb < 0.1 ? `${Math.max(1, Math.round(Number(bytes) / 1024))} КБ` : `${mb.toFixed(1)} МБ`;
}

function date(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
