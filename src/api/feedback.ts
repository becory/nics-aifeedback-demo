import type { DataResponse, Feedback } from "../types";
import { instance, serializeRepeatedParams } from "./api";

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

export const getFeedbacks = (params?: GetFeedbacksParams) =>
  instance.get<DataResponse<Feedback[]>>("/feedback", {
    params,
    paramsSerializer: serializeRepeatedParams,
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
    paramsSerializer: serializeRepeatedParams,
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
    paramsSerializer: serializeRepeatedParams,
  });
