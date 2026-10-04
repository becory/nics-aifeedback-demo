import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { addCondition, conditionKey, type Condition, type TimeSelectionOf } from "../lib/filterConditions";
import { DateTimeInput, FieldSpinner } from "./ui";

// Generic two-row filter bar (feedback overview, audit logs):
//   ⏲ 時間區間：[preset] [preset] … [自訂｜開始 - 結束]
//   ⏷ 篩選器：[欄位 | 值 ×] … [＋新增] / [欄位 ▾ | 值]          [extra] [× 清除]
// Controlled: every change is reported through onChange and is meant to be queried right away.

export interface FilterFieldDef<F extends string> {
  value: F;
  label: string;
  /** Dropdown values; omit for free text. */
  options?: { value: string; label: string }[];
  /** The options are still being fetched: the dropdown shows 「載入中…」 with a spinner. */
  loading?: boolean;
  placeholder?: string;
  /** Only one condition of this field at a time; adding another replaces it. */
  single?: boolean;
}

export interface FilterFieldGroup<F extends string> {
  label: string;
  fields: FilterFieldDef<F>[];
}

export interface FilterBarValue<P extends string, F extends string> {
  time: TimeSelectionOf<P>;
  conditions: Condition<F>[];
}

interface FilterBarProps<P extends string, F extends string> {
  value: FilterBarValue<P, F>;
  onChange: (next: FilterBarValue<P, F>) => void;
  /** Time preset buttons; the one whose key is `customKey` becomes the inline custom range. */
  presets: { key: P; label: string }[];
  customKey: P;
  fieldGroups: FilterFieldGroup<F>[];
  /** Placeholder option shown in the field dropdown before one is picked. */
  fieldPlaceholder?: string;
  /** Extra control on the right of the filter row, before 清除. */
  extra?: ReactNode;
}

// Both rows share one control height (the filter row's), so 時間區間 and 篩選器 line up.
const ROW_CLASS = "flex min-h-8 flex-wrap items-center gap-2";
const PRESET_CLASS = "cf-btn-outline h-8";
const PRESET_ACTIVE_CLASS = "cf-btn-outline h-8 border-[#0055dc]! bg-[#0055dc]! text-white!";

function FunnelIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M2.75 4.5h14.5l-5.2 6.3v4.2l-4.1 2.1v-6.3L2.75 4.5Z" />
    </svg>
  );
}

function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function FilterBar<P extends string, F extends string>({
  value,
  onChange,
  presets,
  customKey,
  fieldGroups,
  fieldPlaceholder,
  extra,
}: FilterBarProps<P, F>) {
  const { time, conditions } = value;
  const hintId = useId();

  const fields = fieldGroups.flatMap((g) => g.fields);
  const fieldDef = (f: F) => fields.find((d) => d.value === f);
  const defaultField = fields[0]?.value;

  // Custom range is edited locally and only applied once it is valid.
  const [customFrom, setCustomFrom] = useState(time.customFrom);
  const [customTo, setCustomTo] = useState(time.customTo);
  // 自訂 opens the date inputs without touching the applied range until it is valid.
  const [customOpen, setCustomOpen] = useState(time.preset === customKey);
  // Custom range problems are flagged on the start field (red) with a small hint under 自訂.
  const [customError, setCustomError] = useState("");
  const customRef = useRef<HTMLDivElement>(null);
  const activePreset = customOpen ? customKey : time.preset;

  // Inline condition editor: [field ▾ | value] replaces [+新增] while open.
  const [editing, setEditing] = useState(false);
  const [field, setField] = useState<F | undefined>(defaultField);
  const [keyword, setKeyword] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const keywordRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) keywordRef.current?.focus();
  }, [editing, field]);

  const applyTime = (next: TimeSelectionOf<P>) => onChange({ time: next, conditions });

  const applyCustom = (from: string, to: string) => {
    // Invalid ranges keep the current range and flag the start field.
    if (!from) {
      setCustomError("請設定起始時間");
      return;
    }
    if (to && new Date(from) > new Date(to)) {
      setCustomError("起始時間不可晚於結束時間");
      return;
    }
    setCustomError("");
    applyTime({ preset: customKey, customFrom: from, customTo: to });
  };

  const selectPreset = (preset: P) => {
    setCustomError("");
    if (preset === customKey) {
      setCustomOpen(true);
      if (customFrom) applyCustom(customFrom, customTo);
      return;
    }
    setCustomOpen(false);
    applyTime({ preset, customFrom, customTo });
  };

  const closeEditor = () => {
    setEditing(false);
    setField(defaultField);
    setKeyword("");
  };

  const commitEditor = () => {
    if (!field) return closeEditor();
    const next = addCondition(conditions, { field, value: keyword }, fieldDef(field)?.single);
    closeEditor();
    if (next !== conditions) onChange({ time, conditions: next });
  };

  const removeCondition = (c: Condition<F>) =>
    onChange({ time, conditions: conditions.filter((x) => conditionKey(x) !== conditionKey(c)) });

  const conditionLabel = (c: Condition<F>) =>
    fieldDef(c.field)?.options?.find((o) => o.value === c.value)?.label ?? c.value;

  const currentDef = field ? fieldDef(field) : undefined;

  return (
    <div>
      {/* Extra bottom room while the hint under 自訂 is shown, so it doesn't touch the divider. */}
      <div className={`px-4 pt-3 sm:px-5 ${customOpen && customError ? "pb-6" : "pb-3"}`}>
        <div className={ROW_CLASS}>
          <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
            <CalendarIcon className="h-4 w-4 text-slate-500" />
            時間區間：
          </span>
          {presets.map((p) =>
            p.key === customKey && customOpen ? (
              // [自訂｜開始時間 - 結束時間]: applied once focus leaves the whole group, so
              // moving from start to end doesn't query an open-ended range first.
              <span key={p.key} className="relative inline-flex">
                <div
                  ref={customRef}
                  className="inline-flex h-8 items-stretch overflow-hidden rounded border border-[#0055dc] bg-white"
                  onBlur={(e) => {
                    if (!customRef.current?.contains(e.relatedTarget as Node | null)) {
                      applyCustom(customFrom, customTo);
                    }
                  }}
                >
                  <span className="flex items-center bg-[#0055dc] px-3 text-sm font-medium text-white">
                    {p.label}
                  </span>
                  <DateTimeInput
                    aria-label="開始時間"
                    autoFocus
                    value={customFrom}
                    onChange={(v) => {
                      setCustomFrom(v);
                      // Editing either end drops a stale hint; it is re-checked when focus leaves.
                      if (v) setCustomError("");
                    }}
                    max={customTo || undefined}
                    aria-invalid={!!customError}
                    aria-describedby={customError ? hintId : undefined}
                    className={`pr-1 ${customError ? "bg-red-50 ring-1 ring-inset ring-[#d93025]" : ""}`}
                    inputClassName={`border-0 bg-transparent px-2 py-1 text-sm outline-none ${customError ? "text-[#b42318]" : ""}`}
                  />
                  <span className="flex items-center px-1 text-slate-400">-</span>
                  <DateTimeInput
                    aria-label="結束時間"
                    title="留空表示至今"
                    value={customTo}
                    onChange={(v) => {
                      setCustomTo(v);
                      if (customError === "起始時間不可晚於結束時間") setCustomError("");
                    }}
                    min={customFrom || undefined}
                    className="pr-1"
                    inputClassName="border-0 px-2 py-1 text-sm outline-none"
                  />
                </div>
                {customError && (
                  <span
                    id={hintId}
                    className="absolute left-0 top-full mt-0.5 whitespace-nowrap text-xs text-[#b42318]"
                  >
                    {customError}
                  </span>
                )}
              </span>
            ) : (
              <button
                key={p.key}
                type="button"
                onClick={() => selectPreset(p.key)}
                className={activePreset === p.key ? PRESET_ACTIVE_CLASS : PRESET_CLASS}
                aria-pressed={activePreset === p.key}
              >
                {p.label}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="cf-divider grid grid-cols-[1fr_auto] items-start gap-3 px-4 py-3 sm:px-5">
        <div className={ROW_CLASS}>
          <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
            <FunnelIcon className="h-4 w-4 text-slate-500" />
            篩選器：
          </span>

          {conditions.map((c) => (
            <span key={conditionKey(c)} className="cf-filter-chip h-8">
              <span className="cf-filter-chip__field">{fieldDef(c.field)?.label ?? c.field}</span>
              <span className="cf-filter-chip__value" title={conditionLabel(c)}>
                {conditionLabel(c)}
              </span>
              <button
                type="button"
                onClick={() => removeCondition(c)}
                className="cf-filter-chip__remove"
                aria-label={`移除 ${fieldDef(c.field)?.label ?? c.field} 篩選`}
              >
                ×
              </button>
            </span>
          ))}

          {editing ? (
            <div
              ref={editorRef}
              className="inline-flex h-8 items-stretch overflow-hidden rounded border border-[#0055dc] bg-white"
              // Commit once focus leaves the whole [field | value] pair, not when it moves
              // between the two halves.
              onBlur={(e) => {
                if (!editorRef.current?.contains(e.relatedTarget as Node | null)) commitEditor();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEditor();
                } else if (e.key === "Escape") {
                  closeEditor();
                }
              }}
            >
              <select
                aria-label="篩選欄位"
                value={field ?? ""}
                onChange={(e) => {
                  setField((e.target.value || undefined) as F | undefined);
                  setKeyword("");
                }}
                className="border-0 border-r border-slate-200 bg-slate-50 px-2 py-1 text-sm outline-none"
              >
                {fieldPlaceholder && <option value="">{fieldPlaceholder}</option>}
                {fieldGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.fields.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {currentDef?.options ? (
                <span className="inline-flex items-center">
                  <select
                    ref={keywordRef as React.RefObject<HTMLSelectElement>}
                    aria-label={currentDef.label}
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    disabled={currentDef.loading}
                    aria-busy={currentDef.loading || undefined}
                    className="max-w-64 border-0 px-2 py-1 text-sm outline-none"
                  >
                    <option value="">
                      {currentDef.loading ? "載入中…" : `請選擇${currentDef.label}`}
                    </option>
                    {!currentDef.loading &&
                      currentDef.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                  </select>
                  {currentDef.loading && <FieldSpinner className="mr-2" />}
                </span>
              ) : (
                <input
                  ref={keywordRef as React.RefObject<HTMLInputElement>}
                  aria-label="關鍵字"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  disabled={!currentDef}
                  placeholder={
                    currentDef ? currentDef.placeholder ?? `搜尋${currentDef.label}` : "先選擇欄位"
                  }
                  className="w-48 border-0 px-2 py-1 text-sm outline-none"
                />
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="cf-link text-sm">
              ＋新增
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {extra}
          {conditions.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ time, conditions: [] })}
              className="cf-btn-outline h-8 whitespace-nowrap"
            >
              × 清除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
