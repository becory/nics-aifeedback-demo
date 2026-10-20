import { describe, expect, it } from 'vitest'
import {
  AUDIT_EVENT_CATEGORIES,
  AUDIT_EVENT_LABELS,
  AUDIT_PROPERTY_LABELS,
  AUDIT_QUERY_EVENT_TYPE,
  auditEventLabel,
  formatAuditValue,
  isWarningOrAbove,
  severityBadgeClass,
} from './auditLog'

describe('auditEventLabel', () => {
  it('returns the Chinese label of a known event type', () => {
    expect(auditEventLabel('auth.login_succeeded')).toBe('登入成功')
    expect(auditEventLabel('service.created')).toBe('新增服務')
    expect(auditEventLabel('organizationKey.revoked')).toBe('撤銷離線金鑰')
  })

  it('still labels retired agent.* events kept for older entries', () => {
    expect(auditEventLabel('agent.key_rotated')).toBe('輪替金鑰')
  })

  it('returns the raw event type when it has no label', () => {
    expect(auditEventLabel('something.new')).toBe('something.new')
  })

  it('returns a dash for a missing event type', () => {
    expect(auditEventLabel(null)).toBe('—')
    expect(auditEventLabel(undefined)).toBe('—')
    expect(auditEventLabel('')).toBe('—')
  })
})

describe('AUDIT_QUERY_EVENT_TYPE', () => {
  it('is the labelled 查詢稽核日誌 event', () => {
    expect(AUDIT_EVENT_LABELS[AUDIT_QUERY_EVENT_TYPE]).toBe('查詢稽核日誌')
  })
})

describe('AUDIT_EVENT_CATEGORIES', () => {
  it('has unique values and wildcard prefixes only', () => {
    const values = AUDIT_EVENT_CATEGORIES.map((c) => c.value)
    expect(new Set(values).size).toBe(values.length)
    for (const c of AUDIT_EVENT_CATEGORIES) {
      for (const p of c.prefixes) expect(p).toMatch(/^[A-Za-z]+\.\*$/)
    }
  })

  it('covers every labelled event family except retired and query events', () => {
    const covered = AUDIT_EVENT_CATEGORIES.flatMap((c) => c.prefixes.map((p) => p.slice(0, -1)))
    const uncovered = Object.keys(AUDIT_EVENT_LABELS).filter((type) => !covered.some((prefix) => type.startsWith(prefix)))
    expect(uncovered.sort()).toEqual(
      [
        'agent.created',
        'agent.deactivated',
        'agent.env_downloaded',
        'agent.key_revoked',
        'agent.key_rotated',
        'agent.updated',
        'auditLogs.queried',
        'sdkSettings.updated',
      ].sort(),
    )
  })
})

describe('AUDIT_PROPERTY_LABELS', () => {
  it('maps property keys to Chinese labels', () => {
    expect(AUDIT_PROPERTY_LABELS.targetUserId).toBe('對象使用者 ID')
    expect(AUDIT_PROPERTY_LABELS.changedFields).toBe('變更欄位')
    expect(AUDIT_PROPERTY_LABELS.failedRecordCount).toBe('失敗筆數')
  })

  it('labels both spellings of the trace id', () => {
    expect(AUDIT_PROPERTY_LABELS.traceId).toBe('Trace ID')
    expect(AUDIT_PROPERTY_LABELS.TraceId).toBe('Trace ID')
  })

  it('has no label for unknown keys, so callers show the raw key', () => {
    expect(AUDIT_PROPERTY_LABELS.someNewKey).toBeUndefined()
  })
})

describe('isWarningOrAbove', () => {
  it('is true for WARNING and more severe levels', () => {
    for (const s of ['WARNING', 'ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY']) expect(isWarningOrAbove(s)).toBe(true)
  })

  it('is false for less severe and unknown levels', () => {
    for (const s of ['DEFAULT', 'DEBUG', 'INFO', 'NOTICE', 'bogus', '']) expect(isWarningOrAbove(s)).toBe(false)
  })
})

describe('severityBadgeClass', () => {
  it('is red for ERROR and above', () => {
    expect(severityBadgeClass('ERROR')).toBe('bg-red-100 text-red-700')
    expect(severityBadgeClass('EMERGENCY')).toBe('bg-red-100 text-red-700')
  })

  it('is amber for WARNING', () => {
    expect(severityBadgeClass('WARNING')).toBe('bg-amber-100 text-amber-700')
  })

  it('is neutral for lower and unknown levels', () => {
    expect(severityBadgeClass('INFO')).toBe('bg-slate-100 text-slate-600')
    expect(severityBadgeClass('NOTICE')).toBe('bg-slate-100 text-slate-600')
    expect(severityBadgeClass('whatever')).toBe('bg-slate-100 text-slate-600')
  })
})

describe('formatAuditValue', () => {
  it('shows a dash for null, undefined and empty string', () => {
    expect(formatAuditValue(null)).toBe('—')
    expect(formatAuditValue(undefined)).toBe('—')
    expect(formatAuditValue('')).toBe('—')
  })

  it('shows booleans as 是 / 否', () => {
    expect(formatAuditValue(true)).toBe('是')
    expect(formatAuditValue(false)).toBe('否')
  })

  it('pretty-prints objects and arrays as JSON', () => {
    expect(formatAuditValue({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(formatAuditValue(['x', 'y'])).toBe('[\n  "x",\n  "y"\n]')
  })

  it('stringifies other values, keeping zero', () => {
    expect(formatAuditValue(0)).toBe('0')
    expect(formatAuditValue(42)).toBe('42')
    expect(formatAuditValue('abc')).toBe('abc')
  })
})
