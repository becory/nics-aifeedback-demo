import { useId, useLayoutEffect, useRef, useState, type Ref } from "react";
import { FieldSpinner } from "./ui";

// Type-to-filter picker (ARIA combobox + listbox) for the filter bar's searchable fields:
// the text only narrows the list, and a value is only taken by picking an option.
// Options are picked on mousedown with preventDefault, so focus stays on the input and the
// surrounding editor's blur handling never sees the list. The list is position: fixed at the
// input's on-screen box, so overflow-hidden ancestors (.cf-panel) can't clip it.

interface ComboboxProps {
  options: { value: string; label: string }[];
  label: string;
  loading?: boolean;
  placeholder?: string;
  inputRef?: Ref<HTMLInputElement>;
  onSelect: (value: string) => void;
}

const MAX_VISIBLE = 50;

export function Combobox({ options, label, loading = false, placeholder, inputRef, onSelect }: ComboboxProps) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (loading) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 4, left: rect.left });
    };
    update();
    // Capture: also follows scrolling inside any scrollable ancestor.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [loading]);

  const q = query.trim().toLowerCase();
  const matches = (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, MAX_VISIBLE);
  const activeIndex = Math.min(active, matches.length - 1);
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <span ref={anchorRef} className="inline-flex items-center">
      <input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-expanded={!loading}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-busy={loading || undefined}
        disabled={loading}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (matches.length === 0) return;
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((activeIndex + step + matches.length) % matches.length);
          } else if (e.key === "Enter" && activeIndex >= 0) {
            // Handled here so the editor doesn't also commit the (empty) typed value.
            e.preventDefault();
            e.stopPropagation();
            onSelect(matches[activeIndex].value);
          }
        }}
        placeholder={loading ? "載入中…" : placeholder ?? `搜尋${label}`}
        className="w-56 border-0 px-2 py-1 text-sm outline-none"
      />
      {loading && <FieldSpinner className="mr-2" />}
      {!loading && position && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="fixed z-20 max-h-64 w-72 overflow-y-auto rounded border border-slate-200 bg-white py-1 text-sm shadow-lg"
          style={{ top: position.top, left: position.left }}
        >
          {matches.length === 0 ? (
            <li className="px-3 py-1.5 text-slate-400">沒有符合的{label}</li>
          ) : (
            matches.map((o, i) => (
              <li
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(o.value);
                }}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer truncate px-3 py-1.5 ${i === activeIndex ? "bg-[#e8f0fe] text-[#0055dc]" : "text-[#1d1d1d]"}`}
                title={o.label}
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </span>
  );
}
