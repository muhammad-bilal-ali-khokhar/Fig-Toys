"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CameraIcon } from "@/components/icons";

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImagePicker({
  value,
  onChange,
  shape = "rounded",
}: {
  value: string;
  onChange: (value: string) => void;
  shape?: "square" | "rounded";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isSquare = shape === "square";
  const previewClasses = isSquare
    ? "h-20 w-20 shrink-0 rounded-2xl object-cover"
    : "h-16 w-16 shrink-0 rounded-xl object-cover";

  async function onFile(file: File) {
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      onChange(dataUrl);
    } finally {
      setBusy(false);
    }
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void onFile(file);
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {value ? (
        <div
          className={`flex items-center gap-3 rounded-2xl p-3 transition ${
            dragging ? "border-2 border-dashed border-brand-500 bg-brand-50" : "border-2 border-transparent bg-ink-50"
          }`}
        >
          <img src={value} alt="" className={previewClasses} />
          <div className="flex flex-col items-start gap-1.5">
            <Button
              variant="grey"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              Change image
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange("")}
              className="text-error hover:text-red-700"
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          className={`flex w-full flex-col items-center justify-center gap-2 border border-dashed bg-ink-50 transition ${
            isSquare ? "h-28 rounded-2xl" : "h-28 rounded-2xl"
          } ${
            dragging
              ? "border-brand-500 bg-brand-50 text-brand-600"
              : "border-ink-200 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
          }`}
          onClick={() => fileRef.current?.click()}
        >
          <CameraIcon className="h-6 w-6" />
          <span className="text-xs font-semibold">
            {busy ? "Processing…" : dragging ? "Drop to upload" : "Click or drag to add image"}
          </span>
        </Button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
