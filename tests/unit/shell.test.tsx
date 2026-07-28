import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { initialsOf, UserContext, type CurrentUser } from '@/lib/user-context';
import { Sidebar } from '@/components/Sidebar';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

/**
 * Оболочки перенесены из design-source/assets/shell.js, и в макете было три
 * ошибки. Тесты держат исправления: иначе при следующей правке легко вернуть
 * ссылки на .html или потерять подсветку пункта меню.
 */

const user = (over: Partial<CurrentUser> = {}): CurrentUser => ({
  name: 'Дмитрий Королев',
  org: 'Пробный тариф',
  initials: 'ДК',
  role: 'owner',
  email: 'd@corebridge.ru',
  ...over,
});

/** Контекст задаём напрямую: UserProvider ходит в сеть, а проверяем мы разметку */
function withUser(node: ReactElement, u: CurrentUser | null) {
  return render(<UserContext.Provider value={u}>{node}</UserContext.Provider>);
}

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href') ?? '');

describe('initialsOf', () => {
  it('берёт по букве из имени и фамилии', () => {
    expect(initialsOf('Дмитрий Королев')).toBe('ДК');
  });

  it('из одного слова — одну букву', () => {
    expect(initialsOf('Дмитрий')).toBe('Д');
  });

  it('лишние слова не считает', () => {
    expect(initialsOf('Иван Иванович Иванов')).toBe('ИИ');
  });

  it('из адреса почты тоже что-то показывает — имя не обязательно', () => {
    expect(initialsOf('d.korolev@corebridge.ru')).toBe('D');
  });

  it('пусто и null не роняют сайдбар', () => {
    expect(initialsOf(null)).toBe('—');
    expect(initialsOf('   ')).toBe('—');
  });
});

describe('Sidebar', () => {
  it('ведёт на маршруты Next.js, а не на файлы макета', () => {
    withUser(<Sidebar active="dashboard" />, user());
    expect(hrefs()).toEqual(expect.arrayContaining(['/dashboard', '/epf', '/billing', '/settings']));
    expect(hrefs().some((h) => h.endsWith('.html'))).toBe(false);
  });

  it('интеграции и воркфлоу — разведённые маршруты, иначе коллизия с публичными', () => {
    withUser(<Sidebar active="integrations-app" />, user());
    expect(hrefs()).toContain('/my-integrations');
    expect(hrefs()).toContain('/workflows');
  });

  it('подсвечивает пункт интеграций — в макете он не подсвечивался никогда', () => {
    withUser(<Sidebar active="integrations-app" />, user());
    expect(screen.getByRole('link', { name: /Мои интеграции/ })).toHaveClass('active');
  });

  it('подсвечивает ровно один пункт', () => {
    const { container } = withUser(<Sidebar active="billing" />, user());
    expect(container.querySelectorAll('.sidebar-nav a.active')).toHaveLength(1);
  });

  it('админ-панель видна только администратору', () => {
    withUser(<Sidebar active="dashboard" />, user({ role: 'owner' }));
    expect(screen.queryByText('Админ-панель')).toBeNull();
  });

  it('администратору даёт ссылку на субдомен: путь /admin занят API', () => {
    withUser(<Sidebar active="dashboard" />, user({ role: 'admin' }));
    expect(screen.getByRole('link', { name: /Админ-панель/ })).toHaveAttribute(
      'href',
      'https://admin.corebridge.ru/',
    );
  });

  it('без загруженного профиля не падает', () => {
    withUser(<Sidebar active="dashboard" />, null);
    expect(screen.getByText('Загрузка…')).toBeInTheDocument();
  });

  it('сохраняет классы макета — на них держится site.css', () => {
    const { container } = withUser(<Sidebar active="dashboard" />, user());
    expect(container.querySelector('aside.sidebar')).toBeTruthy();
    expect(container.querySelector('.brand .logo')).toBeTruthy();
    expect(container.querySelector('.sidebar-user .avatar')?.textContent).toBe('ДК');
  });
});

describe('Публичные шапка и подвал', () => {
  it('не ссылаются на about.html — такой страницы нет', () => {
    render(
      <>
        <PublicHeader />
        <PublicFooter />
      </>,
    );
    expect(hrefs().some((h) => h.includes('about'))).toBe(false);
    expect(hrefs()).toContain('/for-business');
  });

  it('нигде не осталось ссылок на файлы макета', () => {
    render(
      <>
        <PublicHeader />
        <PublicFooter />
      </>,
    );
    expect(hrefs().filter((h) => h.endsWith('.html'))).toEqual([]);
  });
});
