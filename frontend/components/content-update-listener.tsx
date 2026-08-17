"use client";

import { useEffect, useRef, useState } from "react";
import { useActionNotification } from "@/components/ui/action-notification-provider";
import { useToast } from "@/components/ui/toast";
import { CONTENT_UPDATE } from "@/lib/constants";

type ContentInfo = { available: boolean; contentVersion: string; applied: string };

// Listens for a content (backend/frontend) update being available and offers
// the owner the choice to update now (apply + restart) or later. Uses the
// reusable ActionNotification so it appears bottom-right in the app.
export function ContentUpdateListener() {
  const { notify, dismiss } = useActionNotification();
  const { toast } = useToast();
  const [applying, setApplying] = useState(false);
  const shownIdRef = useRef<number | null>(null);
  const appliedVersionRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined" || !window.fig?.content) return;

    const showIfAvailable = (info: ContentInfo) => {
      if (!info || !info.available) return;
      if (shownIdRef.current !== null) return;
      if (appliedVersionRef.current === info.contentVersion) return;
      appliedVersionRef.current = info.contentVersion;

      const id = notify({
        title: CONTENT_UPDATE.title,
        description: CONTENT_UPDATE.description,
        actions: [
          {
            label: applying ? CONTENT_UPDATE.applying : CONTENT_UPDATE.updateNow,
            variant: "primary",
            loading: applying,
            onClick: async () => {
              setApplying(true);
              try {
                const applied = await window.fig?.content?.apply();
                if (applied) {
                  toast(CONTENT_UPDATE.applied, "success");
                } else {
                  toast(CONTENT_UPDATE.failed, "error");
                  setApplying(false);
                }
              } catch {
                toast(CONTENT_UPDATE.failed, "error");
                setApplying(false);
              }
            },
          },
          {
            label: CONTENT_UPDATE.updateLater,
            variant: "grey",
            onClick: () => {
              dismiss(id);
              shownIdRef.current = null;
            },
          },
        ],
      });
      shownIdRef.current = id;
    };

    window.fig?.content?.check().then((info) => {
      if (info) showIfAvailable(info);
    }).catch(() => {});
    const off = window.fig?.content?.onAvailable?.(showIfAvailable);
    return () => {
      if (off) off();
    };
  }, [notify, dismiss, toast, applying]);

  return null;
}
