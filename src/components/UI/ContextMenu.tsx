"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  items: ContextMenuItem[];
}

export default function ContextMenu({
  isOpen,
  position,
  onClose,
  items,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClickOutside, handleKeyDown]);

  if (!isOpen) return null;

  if (typeof window === "undefined") return null;

  // Adjust position to stay within viewport
  const adjustedPosition = { ...position };
  const menuWidth = 160;
  const menuHeight = items.length * 36 + 8;

  if (position.x + menuWidth > window.innerWidth) {
    adjustedPosition.x = window.innerWidth - menuWidth - 8;
  }
  if (position.y + menuHeight > window.innerHeight) {
    adjustedPosition.y = window.innerHeight - menuHeight - 8;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-40"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body
  );
}
