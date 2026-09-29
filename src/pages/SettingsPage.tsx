import { PageHeader } from '@/components/ui';
import { AccountCard } from '@/features/settings/AccountCard';
import { AppearanceCard } from '@/features/settings/AppearanceCard';
import { DeleteAccountCard } from '@/features/settings/DeleteAccountCard';
import { DownloadDataCard } from '@/features/settings/DownloadDataCard';
import { PasswordCard } from '@/features/settings/PasswordCard';

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your account, how the app looks, and your data." />
      {/* grid-cols-1: without it the implicit column is as wide as its widest word. */}
      <div className="grid max-w-2xl grid-cols-1 gap-4">
        <AccountCard />
        <PasswordCard />
        <AppearanceCard />
        <DownloadDataCard />
        <DeleteAccountCard />
      </div>
    </>
  );
}
