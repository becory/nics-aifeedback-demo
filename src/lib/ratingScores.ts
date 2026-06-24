import type { FeedbackRating, RatingScoresConfig } from '../types'

export const DEFAULT_RATING_SCORES: RatingScoresConfig = {
  good: {
    score: 100,
    labelZh: '良好',
    descriptionZh: '使用者對 AI 回覆感到滿意，品質符合預期。',
  },
  normal: {
    score: 50,
    labelZh: '普通',
    descriptionZh: '使用者認為回覆尚可，但仍有改善空間。',
  },
  bad: {
    score: 20,
    labelZh: '不佳',
    descriptionZh: '使用者對回覆不滿意，品質未達預期。',
  },
}

export const RATING_KEYS: FeedbackRating[] = ['good', 'normal', 'bad']

export const RATING_KEY_LABELS: Record<FeedbackRating, string> = {
  good: 'good',
  normal: 'normal',
  bad: 'bad',
}

export function getScoreMap(config: RatingScoresConfig): Record<FeedbackRating, number> {
  return {
    good: config.good.score,
    normal: config.normal.score,
    bad: config.bad.score,
  }
}

export function getRatingLabelMap(config: RatingScoresConfig): Record<FeedbackRating, string> {
  return {
    good: config.good.labelZh,
    normal: config.normal.labelZh,
    bad: config.bad.labelZh,
  }
}

export function normalizeRatingScores(config?: Partial<RatingScoresConfig>): RatingScoresConfig {
  const base = DEFAULT_RATING_SCORES
  return {
    good: { ...base.good, ...config?.good },
    normal: { ...base.normal, ...config?.normal },
    bad: { ...base.bad, ...config?.bad },
  }
}
