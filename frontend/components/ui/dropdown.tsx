"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDownIcon } from "@/components/icons";

export type DropdownOption<T extends string = string> = {
  value: T;
  label: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  disabled?: boolean;
};

function matchOptions<T extends string>(options: DropdownOption<T>[], query: string) {
  const q = query.toLowerCase();
  if (!q) return options;
  return options.filter((o) => o.label.toLowerCase().startsWith(q));
}

type MenuPos = { top: number; left: number; width: number } | null;

export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  trigger,
  placeholder = "Select…",
  triggerClassName,
  label,
  direction = "auto",
  align = "left",
  searchable = false,
  allowCustom = false,
  defaultFilter = "",
  searchPrefix = "",
  className = "",
  menuClassName = "",
}: {
  value: T | null;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  trigger?: ReactNode | ((open: boolean) => ReactNode);
  placeholder?: string;
  triggerClassName?: string;
  label?: string;
  direction?: "up" | "down" | "auto";
  align?: "left" | "right";
  searchable?: boolean;
  allowCustom?: boolean;
  defaultFilter?: string;
  searchPrefix?: string;
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const [pos, setPos] = useState<MenuPos>(null);
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = `dropdown-list-${useId().replace(/:/g, "")}`;

  const measure = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = menuRef.current?.offsetHeight ?? Math.min(options.length * 46 + 16, 256);
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const shouldOpenUp =
      direction === "up"
        ? true
        : direction === "down"
          ? false
          : below < menuHeight && above > below;
    const width = rect.width;
    const left = align === "right" ? rect.right - width : rect.left;
    let top = shouldOpenUp ? rect.top - menuHeight : rect.bottom + 8;
    top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));
    const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setOpenUp(shouldOpenUp);
    setPos({ top, left: clampedLeft, width });
  }, [align, direction, options.length]);

  useEffect(() => {
    if (!open) setActiveIndex(-1);
    if (open && searchable) {
      const input = menuRef.current?.querySelector<HTMLInputElement>("input");
      input?.focus();
    }
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    measure();
    function onResize() {
      measure();
    }
    function onScroll() {
      measure();
    }
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, measure]);

  useLayoutEffect(() => {
    if (open && menuRef.current) measure();
  }, [open, filter, measure]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setFilter(defaultFilter);
    setOpen(true);
  }

  const visible = searchable && filter
    ? matchOptions(options, searchPrefix + filter)
    : options;

  const exactMatch = allowCustom && (searchPrefix + filter)
    ? options.some((o) => o.label.toLowerCase() === (searchPrefix + filter).toLowerCase())
    : true;

  function chooseCustom() {
    if (!filter.trim()) return;
    onChange((searchPrefix + filter).trim() as T);
    setOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (!open) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex((i) => Math.min(Math.max(i + step, 0), visible.length - 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(visible.length - 1);
      } else if (event.key === "Enter") {
        const target = activeIndex >= 0 ? visible[activeIndex] : visible[0];
        if (target) {
          event.preventDefault();
          onChange(target.value);
          setOpen(false);
        } else if (allowCustom) {
          event.preventDefault();
          chooseCustom();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, visible, activeIndex, allowCustom, onChange]);

  const selectedLabel = label ?? options.find((o) => o.value === value)?.label ?? placeholder;

  const menu = open && pos ? (
    <div
      ref={menuRef}
      id={listId}
      role="listbox"
      aria-label="Options"
      aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const step = e.key === "ArrowDown" ? 1 : -1;
          setActiveIndex((i) => Math.min(Math.max(i + step, 0), visible.length - 1));
        } else if (e.key === "Home") {
          e.preventDefault();
          setActiveIndex(0);
        } else if (e.key === "End") {
          e.preventDefault();
          setActiveIndex(visible.length - 1);
        } else if (e.key === "Enter") {
          const target = activeIndex >= 0 ? visible[activeIndex] : visible[0];
          if (target) {
            e.preventDefault();
            onChange(target.value);
            setOpen(false);
          } else if (allowCustom) {
            e.preventDefault();
            chooseCustom();
          }
        }
      }}
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      className={`fixed z-50 rounded-2xl bg-white p-1.5 shadow-lg shadow-ink-900/5 ${menuClassName}`}
    >
      {searchable && (
        <div className="p-1.5 pb-2.5">
          <div className="relative">
            {searchPrefix && (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-brand-600 select-none">
                {searchPrefix}
              </span>
            )}
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Search options"
              placeholder={searchPrefix ? "0001…" : "Search…"}
              autoFocus
              style={searchPrefix ? { paddingLeft: "3.6rem" } : undefined}
              className="bg-ink-50"
            />
          </div>
        </div>
      )}
      <div className="max-h-56 space-y-1 overflow-y-auto overscroll-none">
        {visible.length === 0 ? (
          <p className="px-4 py-3 text-sm text-ink-400">No matches</p>
        ) : (
          visible.map((option, i) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                id={`${listId}-option-${i}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition ${
                  activeIndex === i ? "bg-brand-50" : isSelected ? "bg-brand-50/50" : "hover:bg-ink-50"
                } ${option.disabled ? "opacity-40" : ""}`}
              >
                {option.leading}
                <span className="min-w-0 flex-1 truncate text-sm text-ink-900">
                  {option.label}
                </span>
                {isSelected ? (
                  <span className="shrink-0 text-sm font-bold text-brand-600">
                    ✓
                  </span>
                ) : (
                  option.trailing
                )}
              </button>
            );
          }              )
        )}
        {allowCustom && filter.trim() && !exactMatch && (
          <button
            type="button"
            onClick={chooseCustom}
            className="flex w-full items-center gap-3 rounded-[14px] bg-brand-50 px-3 py-2 text-left font-semibold text-brand-700 transition hover:bg-brand-100"
          >
            <span className="min-w-0 flex-1 truncate text-sm">
              + Use “{filter.trim()}”
            </span>
          </button>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        className="relative block w-full"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
      >
        {trigger !== undefined ? (
          typeof trigger === "function" ? trigger(open) : trigger
        ) : (
          <div
            className={`flex h-9 items-center justify-between rounded-2xl bg-ink-100 px-3.5 text-sm ${triggerClassName ?? ""}`}
          >
            <span className="truncate text-ink-900">{selectedLabel}</span>
          </div>
        )}
        <ChevronDownIcon
          className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {menu && createPortal(menu, document.body)}
    </div>
  );
}
