"use client";

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { cn, formatNumber } from "@/lib/utils";

// ─── KPI Card ───
export function KPICard({
  label,
  value,
  sub,
  color = "blue",
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-600",
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
    purple: "bg-violet-500",
    cyan: "bg-cyan-500",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "card p-5",
        onClick && "cursor-pointer transition-shadow hover:shadow-apple-lg",
        active && "ring-2 ring-blue-600"
      )}
    >
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-apple-secondary">
        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", colorMap[color] || "bg-blue-600")} />
        {icon && <span className="mr-1">{icon}</span>}
        {label}
      </div>
      <div className="mt-1.5 text-[28px] leading-tight font-semibold tracking-tight text-apple-label font-mono">
        {typeof value === "number" ? formatNumber(value) : value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-apple-tertiary">{sub}</div>}
    </div>
  );
}

// ─── Badge ───
export function Badge({ text, variant }: { text: string; variant?: string }) {
  const v = variant || text;
  const styles: Record<string, string> = {
    PHH: "bg-blue-100 text-blue-800",
    AAY: "bg-amber-100 text-amber-800",
    Authenticated: "bg-emerald-100 text-emerald-800",
    OTP: "bg-violet-100 text-violet-800",
    IRIS: "bg-pink-100 text-pink-800",
    Self: "bg-gray-100 text-gray-600",
    Collected: "bg-emerald-100 text-emerald-800",
    Pending: "bg-red-100 text-red-800",
    success: "bg-emerald-100 text-emerald-800",
    error: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={cn(
        "inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium",
        styles[v] || "bg-gray-100 text-gray-600"
      )}
    >
      {text}
    </span>
  );
}

// ─── Data Table ───
export interface Column<T> {
  key: keyof T | string;
  label: string;
  align?: "left" | "center" | "right";
  mono?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  maxHeight = 500,
  pageSize = 25,
  searchable = true,
  emptyMessage = "No records found",
}: {
  columns: Column<T>[];
  data: T[];
  maxHeight?: number;
  pageSize?: number;
  searchable?: boolean;
  emptyMessage?: string;
}) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!filter) return data;
    const f = filter.toLowerCase();
    return data.filter((row) =>
      columns.some((c) =>
        String((row as Record<string, unknown>)[c.key as string] ?? "")
          .toLowerCase()
          .includes(f)
      )
    );
  }, [data, filter, columns]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortCol] ?? "";
      const vb = (b as Record<string, unknown>)[sortCol] ?? "";
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(sorted.length / pageSize);

  useEffect(() => setPage(0), [filter]);

  const handleSort = (key: string) => {
    if (sortCol === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(key);
      setSortDir("asc");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        {searchable ? (
          <input
            placeholder="Search..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field w-64"
          />
        ) : (
          <div />
        )}
        <span className="text-xs text-gray-500">
          {formatNumber(sorted.length)} records
        </span>
      </div>

      <div
        className="overflow-x-auto rounded-2xl bg-white shadow-apple"
        style={{ maxHeight, overflowY: "auto" }}
      >
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() =>
                    col.sortable !== false && handleSort(String(col.key))
                  }
                  className={cn(
                    "table-head px-3 py-2.5 sticky top-0 z-10 select-none whitespace-nowrap",
                    col.sortable !== false && "cursor-pointer hover:text-apple-label",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center"
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                  {sortCol === String(col.key) && (
                    <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  "border-b border-black/5 last:border-0 hover:bg-[#f5f5f7] transition-colors",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn(
                      "px-3 py-2 whitespace-nowrap",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.mono && "font-mono text-xs"
                    )}
                  >
                    {col.render
                      ? col.render(
                          (row as Record<string, unknown>)[col.key as string],
                          row
                        )
                      : String(
                          (row as Record<string, unknown>)[col.key as string] ?? ""
                        )}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-3">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="btn-secondary text-xs disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="btn-secondary text-xs disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab Group ───
export function TabGroup({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-0.5 mb-5 p-0.5 rounded-[10px] bg-apple-fill">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-4 py-1.5 rounded-lg text-[13px] font-medium transition-all",
            active === tab.id
              ? "bg-white text-apple-label shadow-sm"
              : "text-apple-secondary hover:text-apple-label"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Column Picker (multi-select dropdown) ───
export function ColumnPicker({
  label,
  options,
  selected,
  onChange,
  selectAllLabel,
  clearLabel,
}: {
  label: string;
  options: { key: string; label: string; locked?: boolean }[];
  selected: string[];
  onChange: (keys: string[]) => void;
  selectAllLabel: string;
  clearLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const locked = options.filter((o) => o.locked).map((o) => o.key);
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="btn-secondary text-xs flex items-center gap-1.5"
      >
        ☰ {label} ({selected.length}/{options.length})
        <span className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-60 rounded-xl border border-black/10 bg-white/90 backdrop-blur-xl shadow-apple-lg">
          <div className="flex justify-between border-b border-black/5 px-3 py-2 text-xs">
            <button type="button" onClick={() => onChange(options.map((o) => o.key))} className="text-blue-600 hover:underline">
              {selectAllLabel}
            </button>
            <button type="button" onClick={() => onChange(locked)} className="text-gray-500 hover:underline">
              {clearLabel}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {options.map((o) => (
              <label
                key={o.key}
                className={cn(
                  "flex items-center gap-2 mx-1 px-2 py-1.5 rounded-md text-[13px]",
                  o.locked ? "text-apple-tertiary" : "cursor-pointer hover:bg-blue-600 hover:text-white"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(o.key)}
                  disabled={o.locked}
                  onChange={() => toggle(o.key)}
                  className="rounded border-gray-300 text-blue-600"
                />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty State ───
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">{description}</p>
      {action}
    </div>
  );
}
