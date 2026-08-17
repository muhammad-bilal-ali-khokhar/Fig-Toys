"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ActionNotification } from "@/components/ui/action-notification";
import type { ActionNotificationProps } from "@/components/ui/action-notification";

type StoredNotification = ActionNotificationProps & { id: number };

type ActionNotificationContextValue = {
  notify: (n: ActionNotificationProps) => number;
  dismiss: (id: number) => void;
};

const ActionNotificationContext = createContext<ActionNotificationContextValue | null>(null);

let nextId = 1;

export function ActionNotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<StoredNotification[]>([]);
  const itemsRef = useRef<StoredNotification[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => {
      const next = prev.filter((n) => n.id !== id);
      itemsRef.current = next;
      return next;
    });
  }, []);

  const notify = useCallback(
    (n: ActionNotificationProps) => {
      const id = nextId++;
      const stored: StoredNotification = { ...n, id };
      setItems((prev) => {
        const next = [...prev, stored];
        itemsRef.current = next;
        return next;
      });
      return id;
    },
    [],
  );

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ActionNotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[210] flex flex-col items-end gap-2">
        {items.map((n) => (
          <ActionNotification
            key={n.id}
            title={n.title}
            description={n.description}
            actions={n.actions}
            children={n.children}
            onDismiss={() => dismiss(n.id)}
          />
        ))}
      </div>
    </ActionNotificationContext.Provider>
  );
}

export function useActionNotification() {
  const ctx = useContext(ActionNotificationContext);
  if (!ctx) throw new Error("useActionNotification must be used within ActionNotificationProvider");
  return ctx;
}
