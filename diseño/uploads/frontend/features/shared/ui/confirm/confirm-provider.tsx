"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import { Modal } from "@/features/shared/ui/modal/modal";

type ConfirmTone = "danger" | "warning" | "primary";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((result: boolean) => void) | null>(null);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }

  const value = useMemo<ConfirmContextValue>(
    () => ({
      confirm: (nextOptions) =>
        new Promise<boolean>((resolve) => {
          resolver.current?.(false);
          resolver.current = resolve;
          setOptions(nextOptions);
        }),
    }),
    [],
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(options)}
        title={options?.title ?? "Confirmar accion"}
        size="sm"
        onClose={() => close(false)}
        footer={
          <>
            <button type="button" className="ghost-button" onClick={() => close(false)}>
              {options?.cancelLabel ?? "Cancelar"}
            </button>
            <button type="button" className={`app-button ${options?.tone ?? "danger"}`} onClick={() => close(true)}>
              {options?.confirmLabel ?? "Confirmar"}
            </button>
          </>
        }
      >
        <div className={`confirmation-message confirmation-${options?.tone ?? "danger"}`}>
          <i className="fas fa-exclamation-triangle" aria-hidden="true" />
          <p>{options?.description}</p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm debe usarse dentro de ConfirmProvider");
  return context;
}
