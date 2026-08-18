import { useEffect, useState } from "react";
import type { OfflineKey, Organization } from "../types";
import {
  createOfflineKey,
  deleteOfflineKey,
  getOfflineKeys,
  getOrganizations,
  updateOfflineKey,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { formatDisplayTime } from "../lib/datetime";
import { Modal } from "../components/Modal";
import {
  Button,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from "../components/ui";

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultExpiresAt(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toDatetimeLocal(d.toISOString());
}

function formatDateTime(iso: string): string {
  return formatDisplayTime(iso);
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function OfflineKeysPage() {
  const [items, setItems] = useState<OfflineKey[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OfflineKey | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const [keys, orgs] = await Promise.all([
      getOfflineKeys(),
      getOrganizations(),
    ]);
    setItems(keys.data.data);
    setOrganizations(orgs.data.data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const getOrgName = (orgId: string) =>
    organizations.find((o) => o.id === orgId)?.name ?? "—";

  const openCreate = () => {
    setEditing(null);
    setOrganizationId(organizations[0]?.id ?? "");
    setDescription("");
    setExpiresAt(defaultExpiresAt());
    setError("");
    setModalOpen(true);
  };

  const openEdit = (key: OfflineKey) => {
    setEditing(key);
    setOrganizationId(key.organizationId);
    setDescription(key.description);
    setExpiresAt(toDatetimeLocal(key.expiresAt));
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!organizationId) {
      setError("請選擇所屬組織");
      return;
    }
    if (!expiresAt) {
      setError("請設定到期時間");
      return;
    }

    const expiresAtIso = new Date(expiresAt).toISOString();
    if (new Date(expiresAtIso).getTime() <= Date.now()) {
      setError("到期時間必須晚於現在");
      return;
    }

    try {
      if (editing) {
        await updateOfflineKey(editing.id, {
          description: description.trim(),
          expiresAt: expiresAtIso,
        });
      } else {
        await createOfflineKey({
          organizationId,
          description: description.trim(),
          expiresAt: expiresAtIso,
        });
      }
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setError(
        `${editing ? "更新" : "新增"}離線金鑰時發生錯誤${detail ? `：${detail}` : ""}`,
      );
      return;
    }

    refresh();
    setModalOpen(false);
  };

  const handleDelete = async (key: OfflineKey) => {
    if (!confirm(`確定要刪除此離線金鑰？`)) return;

    try {
      await deleteOfflineKey(key.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`刪除離線金鑰時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    refresh();
  };

  const handleCopy = async (aesKey: string) => {
    try {
      await navigator.clipboard.writeText(aesKey);
    } catch {
      // ignore
    }
  };

  return (
    <>
      <PageHeader
        title="離線金鑰"
        description="管理各組織的 AES 離線金鑰，一個組織可擁有多把金鑰"
        action={
          <Button onClick={openCreate} disabled={organizations.length === 0}>
            新增離線金鑰
          </Button>
        }
      />

      {organizations.length === 0 ? (
        <EmptyState message="請先建立組織，才能新增離線金鑰" />
      ) : items.length === 0 ? (
        <EmptyState message="尚無離線金鑰，點擊「新增離線金鑰」開始建立" />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">
                  所屬組織
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">說明</th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  AES KEY
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  到期時間
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">狀態</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((key) => (
                <tr key={key.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {getOrgName(key.organizationId)}
                  </td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-slate-600">
                    {key.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="max-w-[200px] truncate font-mono text-xs text-slate-600">
                        {key.aesKey}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(key.aesKey)}
                        className="cf-link shrink-0 text-xs"
                      >
                        複製
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDateTime(key.expiresAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        isExpired(key.expiresAt)
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isExpired(key.expiresAt) ? "已過期" : "有效"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(key)}
                      className="cf-link mr-3"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(key)}
                      className="text-red-600 hover:text-red-800"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editing ? "編輯離線金鑰" : "新增離線金鑰"}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {error && <div className="cf-alert cf-alert--error">{error}</div>}
          <Select
            label="所屬組織"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            disabled={!!editing}
            options={organizations.map((o) => ({
              value: o.id,
              label: `${o.name} (${o.code})`,
            }))}
          />
          <Input
            label="說明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="選填，例如：備援節點用金鑰"
          />
          <div className="space-y-1.5">
            <label
              htmlFor="expiresAt"
              className="block text-sm font-medium text-slate-700"
            >
              到期時間
            </label>
            <input
              id="expiresAt"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="cf-input"
            />
          </div>
          {!editing && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
              儲存後將自動產生一組 256-bit AES KEY（Base64 編碼）。
            </p>
          )}
          {editing && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">AES KEY</p>
              <p className="mt-1 break-all font-mono text-sm text-slate-700">
                {editing.aesKey}
              </p>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
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
