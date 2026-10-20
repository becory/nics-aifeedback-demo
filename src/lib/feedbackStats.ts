export const CHART_COLORS = {
  good: '#3367d6',
  normal: '#22b8cf',
  bad: '#ef4444',
  score: '#3367d6',
  primary: '#f6821f',
  primaryLight: '#fff7ed',
}

export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function truncateLabel(label: string, max = 22): string {
  return label.length > max ? `${label.slice(0, max)}…` : label
}
