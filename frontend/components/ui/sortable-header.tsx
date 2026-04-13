"use client";

import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export interface SortConfig {
  key: string;
  dir: "asc" | "desc";
}

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSort: SortConfig | null;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  className = "",
}: SortableHeaderProps) {
  const isActive = currentSort?.key === sortKey;
  const dir = isActive ? currentSort.dir : null;

  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <th
      className={`px-5 py-3 text-left font-medium cursor-pointer select-none transition-colors hover:text-[#C4704A] ${
        isActive ? "text-[#C4704A]" : "text-[#4A3628]"
      } ${className}`}
      style={{
        fontFamily: "Lato, sans-serif",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        fontSize: "0.75rem",
      }}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1.5">
        {label}
        <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      </span>
    </th>
  );
}

/** Toggle sort: null → asc → desc → null */
export function toggleSort(
  currentSort: SortConfig | null,
  key: string,
): SortConfig | null {
  if (currentSort?.key !== key) return { key, dir: "asc" };
  if (currentSort.dir === "asc") return { key, dir: "desc" };
  return null;
}
