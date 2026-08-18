"use client";

import { useState } from "react";

export function useClipboardPaste() {
  const [reading, setReading] = useState(false);

  async function paste(onPaste: (text: string) => void, onError?: (message: string) => void) {
    setReading(true);
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onPaste(text);
      } else if (onError) {
        onError("Clipboard is empty.");
      }
    } catch {
      if (onError) {
        onError("Could not read the clipboard. Press Ctrl/Cmd + V instead.");
      }
    } finally {
      setReading(false);
    }
  }

  return { reading, paste };
}