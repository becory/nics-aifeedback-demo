import {
  CONDITION_FIELD_GROUPS,
  TIME_PRESETS,
  type AppliedFeedbackFilters,
  type ConditionField,
} from "../../lib/feedbackFilters";
import type { FeedbackRating } from "../../types";
import { FilterBar, type FilterFieldGroup } from "../FilterBar";

interface FeedbackFilterBarProps {
  /** The filters the page is showing; every change is applied (queried) right away. */
  value: AppliedFeedbackFilters;
  ratingLabels: Record<FeedbackRating, string>;
  onChange: (filters: AppliedFeedbackFilters) => void;
}

const RATING_VALUES: FeedbackRating[] = ["good", "normal", "bad"];

/** The feedback overview's fields and presets on the shared FilterBar. */
export function FeedbackFilterBar({ value, ratingLabels, onChange }: FeedbackFilterBarProps) {
  const fieldGroups: FilterFieldGroup<ConditionField>[] = CONDITION_FIELD_GROUPS.map((g) => ({
    label: g.label,
    fields: g.fields.map((f) =>
      f.value === "feedbackRating"
        ? { ...f, options: RATING_VALUES.map((r) => ({ value: r, label: ratingLabels[r] })) }
        : f,
    ),
  }));

  return (
    <FilterBar
      value={value}
      onChange={onChange}
      presets={TIME_PRESETS}
      customKey="custom"
      dateOnly
      fieldGroups={fieldGroups}
    />
  );
}
