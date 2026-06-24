const TAIPEI_TZ = 'Asia/Taipei'

function getTaipeiParts(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
}

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

/** e.g. 2026-06-24 16:49:39 GMT+8 */
export function formatDisplayTime(iso: string): string {
  const parts = getTaipeiParts(new Date(iso))
  return `${partValue(parts, 'year')}-${partValue(parts, 'month')}-${partValue(parts, 'day')} ${partValue(parts, 'hour')}:${partValue(parts, 'minute')}:${partValue(parts, 'second')} GMT+8`
}
