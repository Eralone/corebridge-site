import type { Metadata } from 'next';
import { LkShell } from '@/components/LkShell';
import { SettingsBody } from './SettingsBody';

export const metadata: Metadata = { title: 'Настройки — CoreBridge', robots: { index: false } };

export default function Page() {
  return (
    <LkShell active="settings" title="Настройки">
      <SettingsBody />
    </LkShell>
  );
}
