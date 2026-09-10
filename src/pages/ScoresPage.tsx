import { useEffect, useState } from "react";
import type { FeedbackRating, ScoreConfig } from "../types";
import { getScoreConfigs, updateScoreConfig } from "../api";
import { getApiErrorMessage } from "../api/api";
import { RATING_KEY_LABELS, RATING_KEYS } from "../lib/ratingScores";
import { Modal } from "../components/Modal";
import { Button, Input, LoadingState, PageHeader } from "../components/ui";

interface ScoreForm {
  name: string;
  description: string;
  scoreValue: number;
}

export function ScoresPage() {
  const [configs, setConfigs] = useState<
    Partial<Record<FeedbackRating, ScoreConfig>>
  >({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<FeedbackRating | null>(null);
  const [form, setForm] = useState<ScoreForm>({
    name: "",
    description: "",
    scoreValue: 0,
  });
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await getScoreConfigs();
      const sorted = [...res.data.data].sort(
        (a, b) => b.scoreValue - a.scoreValue,
      );
      const next: Partial<Record<FeedbackRating, ScoreConfig>> = {};
      RATING_KEYS.forEach((key, index) => {
        if (sorted[index]) next[key] = sorted[index];
      });
      setConfigs(next);
      setLoadError("");
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setLoadError(`載入分數設定時發生錯誤${detail ? `：${detail}` : ""}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const openEdit = (key: FeedbackRating) => {
    const current = configs[key];
    if (!current) return;
    setEditingKey(key);
    setForm({
      name: current.name,
      description: current.description,
      scoreValue: current.scoreValue,
    });
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingKey) return;
    const current = configs[editingKey];
    if (!current) return;

    if (!form.name.trim()) {
      setError("請輸入中文名稱");
      return;
    }
    if (!form.description.trim()) {
      setError("請輸入中文說明");
      return;
    }
    if (
      !Number.isFinite(form.scoreValue) ||
      form.scoreValue < 0 ||
      form.scoreValue > 100
    ) {
      setError("分數須為 0～100 的數字");
      return;
    }

    try {
      await updateScoreConfig(current.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        scoreValue: form.scoreValue,
      });
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setError(`更新分數設定時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    refresh();
    setModalOpen(false);
  };

  return (
    <>
      <PageHeader
        title="分數管理"
        description="設定各評價等級的分數與中文說明，總覽的平均分數將依此計算"
      />

      {loadError && (
        <div className="cf-alert cf-alert--error mb-4 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <button type="button" onClick={refresh} className="cf-link shrink-0">
            重試
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">
                  評價代碼
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  中文名稱
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  中文說明
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">分數</th>
                <th className="px-4 py-3 font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {RATING_KEYS.map((key) => {
                const cfg = configs[key];
                return (
                  <tr key={key}>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {RATING_KEY_LABELS[key]}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {cfg?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {cfg?.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">
                      {cfg?.scoreValue ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="secondary"
                        onClick={() => openEdit(key)}
                        disabled={!cfg}
                      >
                        編輯
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={`編輯評價：${editingKey ? RATING_KEY_LABELS[editingKey] : ""}`}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          <Input
            label="中文名稱"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <div className="space-y-1.5">
            <label htmlFor="description" className="cf-label">
              中文說明
            </label>
            <textarea
              id="description"
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
              className="cf-input"
            />
          </div>
          <Input
            label="分數（0～100）"
            type="number"
            min={0}
            max={100}
            value={form.scoreValue}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                scoreValue: Number(e.target.value),
              }))
            }
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
  );
}
