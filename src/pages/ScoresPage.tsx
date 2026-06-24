import { useState } from 'react'
import type { FeedbackRating, RatingScoreSetting } from '../types'
import { getData, saveData } from '../lib/storage'
import {
  DEFAULT_RATING_SCORES,
  RATING_KEY_LABELS,
  RATING_KEYS,
} from '../lib/ratingScores'
import { Modal } from '../components/Modal'
import { Button, Input, PageHeader } from '../components/ui'

export function ScoresPage() {
  const [config, setConfig] = useState(() => getData().ratingScores)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<FeedbackRating | null>(null)
  const [form, setForm] = useState<RatingScoreSetting>(DEFAULT_RATING_SCORES.good)
  const [error, setError] = useState('')

  const refresh = () => setConfig(getData().ratingScores)

  const openEdit = (key: FeedbackRating) => {
    setEditingKey(key)
    setForm({ ...config[key] })
    setError('')
    setModalOpen(true)
  }

  const handleSave = () => {
    if (!editingKey) return
    if (!form.labelZh.trim()) {
      setError('請輸入中文名稱')
      return
    }
    if (!form.descriptionZh.trim()) {
      setError('請輸入中文說明')
      return
    }
    const score = Number(form.score)
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      setError('分數須為 0～100 的數字')
      return
    }

    const data = getData()
    data.ratingScores = {
      ...data.ratingScores,
      [editingKey]: {
        labelZh: form.labelZh.trim(),
        descriptionZh: form.descriptionZh.trim(),
        score,
      },
    }
    saveData(data)
    refresh()
    setModalOpen(false)
  }

  const handleReset = () => {
    if (!confirm('確定要還原為預設分數設定嗎？')) return
    const data = getData()
    data.ratingScores = DEFAULT_RATING_SCORES
    saveData(data)
    refresh()
  }

  return (
    <>
      <PageHeader
        title="分數管理"
        description="設定各評價等級的分數與中文說明，總覽的平均分數將依此計算"
        action={
          <Button variant="secondary" onClick={handleReset}>
            還原預設
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-600">評價代碼</th>
              <th className="px-4 py-3 font-medium text-slate-600">中文名稱</th>
              <th className="px-4 py-3 font-medium text-slate-600">中文說明</th>
              <th className="px-4 py-3 font-medium text-slate-600">分數</th>
              <th className="px-4 py-3 font-medium text-slate-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {RATING_KEYS.map((key) => (
              <tr key={key} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-slate-600">{RATING_KEY_LABELS[key]}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{config[key].labelZh}</td>
                <td className="px-4 py-3 text-slate-600">{config[key].descriptionZh}</td>
                <td className="px-4 py-3 tabular-nums text-slate-900">{config[key].score}</td>
                <td className="px-4 py-3">
                  <Button variant="secondary" onClick={() => openEdit(key)}>
                    編輯
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        title={`編輯評價：${editingKey ? RATING_KEY_LABELS[editingKey] : ''}`}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          <Input
            label="中文名稱"
            value={form.labelZh}
            onChange={(e) => setForm((prev) => ({ ...prev, labelZh: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label htmlFor="descriptionZh" className="block text-sm font-medium text-slate-700">
              中文說明
            </label>
            <textarea
              id="descriptionZh"
              value={form.descriptionZh}
              onChange={(e) => setForm((prev) => ({ ...prev, descriptionZh: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <Input
            label="分數（0～100）"
            type="number"
            min={0}
            max={100}
            value={form.score}
            onChange={(e) => setForm((prev) => ({ ...prev, score: Number(e.target.value) }))}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave}>儲存</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
