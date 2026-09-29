import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { toDataError } from '@/lib/dataError';
import { useSettingsApi } from './api-context';
import { buildExport, exportFileName, saveJson } from './exportFile';

/** Reads everything the person has stored and hands it to the browser as a file. */
export function useDownloadMyData() {
  const api = useSettingsApi();
  const { state } = useAuth();
  const email = state.status === 'signed_in' ? (state.user.email ?? null) : null;
  return useMutation({
    mutationFn: async () => {
      const now = new Date();
      const data = await api.exportData();
      saveJson(exportFileName(now), buildExport({ email, data, now }));
    },
  });
}

/**
 * Deletes the account. Once it has gone, this device forgets the sign-in, which empties every
 * cached list and lands the person on the sign-in page with a note that the account is gone.
 */
export function useDeleteAccount() {
  const api = useSettingsApi();
  const { leaveDeletedAccount } = useAuth();
  return useMutation({
    mutationFn: () => api.deleteAccount(),
    onSuccess: () => leaveDeletedAccount(),
  });
}

/** The message for a failed settings request. */
export function settingsErrorMessage(error: unknown): string {
  return toDataError(error).message;
}
