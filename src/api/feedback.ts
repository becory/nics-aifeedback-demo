import type { DataResponse, Feedback } from "../types";
import { instance } from "./api";

// Multi-value fields accept repeated query params, e.g. ?device=iOS&device=-Windows
// meaning "device is iOS, and is not Windows". A bare value includes it (OR'd with
// other included values); a "-"-prefixed value excludes it. Omitting the param
// entirely means no filter on that field.
export interface FeedbackFilterParams {
  organizationId?: string | string[];
  serviceId?: string | string[];
  feedbackRating?: string | string[];
  device?: string | string[];
  ipCountry?: string | string[];
  ipAsn?: string | string[];
  ipAddress?: string | string[];
  originHost?: string | string[];
  userAgent?: string | string[];
  sessionId?: string;
  from?: string;
  to?: string;
}

export interface GetFeedbacksParams extends FeedbackFilterParams {
  page?: number;
  pageSize?: number;
}

function serializeFeedbackParams(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v !== undefined && v !== null) usp.append(key, String(v));
      }
    } else {
      usp.append(key, String(value));
    }
  }
  return usp.toString();
}

export const getFeedbacks = (params?: GetFeedbacksParams) =>
  instance.get<DataResponse<Feedback[]>>("/feedback", {
    params,
    paramsSerializer: serializeFeedbackParams,
  });

export type FeedbackGroupBy =
  | "service"
  | "org"
  | "rate"
  | "ip_country"
  | "ip_asn"
  | "ip"
  | "origin_host"
  | "user_agent"
  | "device";

export type FeedbackOverviewInterval = "day" | "week" | "month";

export interface GetFeedbackOverviewParams extends FeedbackFilterParams {
  interval?: FeedbackOverviewInterval;
  groupBy?: FeedbackGroupBy;
}

export interface FeedbackOverviewCount {
  date: string;
  group: string | null;
  label: string | null;
  count: number;
}

export interface FeedbackOverview {
  totalCount: number;
  averageScore: number | null;
  counts: FeedbackOverviewCount[];
}

export const getFeedbackOverview = (params?: GetFeedbackOverviewParams) =>
  instance.get<FeedbackOverview>("/feedback/overview", {
    params,
    paramsSerializer: serializeFeedbackParams,
  });

export interface GetFeedbackTopColumnsParams extends FeedbackFilterParams {
  groupBy?: FeedbackGroupBy;
}

export interface FeedbackTopColumnItem {
  value: string;
  label: string;
  count: number;
}

export interface FeedbackTopColumns {
  column: string;
  items: FeedbackTopColumnItem[];
}

export const getFeedbackTopColumns = (params?: GetFeedbackTopColumnsParams) =>
  instance.get<FeedbackTopColumns>("/feedback/top-columns", {
    params,
    paramsSerializer: serializeFeedbackParams,
  });
