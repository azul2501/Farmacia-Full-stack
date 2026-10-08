"use client";

import { SessionProvider } from "@/features/auth/context/session-context";
import { ConfirmProvider } from "@/features/shared/ui/confirm/confirm-provider";
import { LayoutProvider } from "@/features/shared/context/layout-context";
import { ToastProvider } from "@/features/shared/ui/toast/toast-provider";
import { QueryProvider } from "@/features/shared/providers/query-provider";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <SessionProvider>
        <LayoutProvider>
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </LayoutProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
