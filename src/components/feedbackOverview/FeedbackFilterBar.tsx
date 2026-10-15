import {
  CONDITION_FIELD_GROUPS,
  SOURCE_LABELS,
  TIME_PRESETS,
  organizationOptions,
  serviceOptions,
  type AppliedFeedbackFilters,
  type ConditionField,
} from "../../lib/feedbackFilters";
import type { FeedbackRating, Service } from "../../types";
import { FilterBar, type FilterFieldGroup } from "../FilterBar";

interface FeedbackFilterBarProps {
  /** The filters the page is showing; every change is applied (queried) right away. */
  value: AppliedFeedbackFilters;
  ratingLabels: Record<FeedbackRating, string>;
  /** Visible services: the 服務 and 組織 dropdown options. */
  services: Service[];
  /** The services are still loading. */
  servicesLoading: boolean;
  onChange: (filters: AppliedFeedbackFilters) => void;
}

const RATING_VALUES: FeedbackRating[] = ["good", "normal", "bad"];

/** The feedback overview's fields and presets on the shared FilterBar. */
export function FeedbackFilterBar({ value, ratingLabels, services, servicesLoading, onChange }: FeedbackFilterBarProps) {
  const optionsFor = (field: ConditionField) => {
    switch (field) {
      case "feedbackRating":
        return { options: RATING_VALUES.map((r) => ({ value: r, label: ratingLabels[r] })) };
      case "source":
        return { options: Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })) };
      case "service":
        return { options: serviceOptions(services), loading: servicesLoading, searchable: true };
      case "organization":
        return { options: organizationOptions(services), loading: servicesLoading, searchable: true };
      default:
        return {};
    }
  };
  const fieldGroups: FilterFieldGroup<ConditionField>[] = CONDITION_FIELD_GROUPS.map((g) => ({
    label: g.label,
    fields: g.fields.map((f) => ({ ...f, ...optionsFor(f.value) })),
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
