import { useEffect, useState } from "react";
import axios from "axios";
import {
  createOrganizationKey,
  generateOrganizationKeyEnv,
  getOrganizationKeys,
  getServices,
  revokeOrganizationKey,
  updateOrganizationKey,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { formatDisplayDate, formatDisplayTime } from "../lib/datetime";
import { toDatetimeLocal } from "../lib/feedbackStats";
import { useSubmitGuard } from "../lib/useSubmitGuard";
import type {
  CreatedOrganizationKey,
  Organization,
  OrganizationKey,
  Service,
} from "../types";
import { DateTimeInput } from "./DateTimeInput";
import { Modal } from "./Modal";
import { Button, Input, LoadingState } from "./ui";

const DESCRIPTION_MAX_LENGTH = 200;

// thead's own border doesn't travel with sticky cells (border-collapse), so draw it as a shadow.
const STICKY_TH =
  "sticky top-0 z-10 bg-[#fafafa] shadow-[inset_0_-1px_0_#ebebeb]";

function defaultExpiresAt(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return toDatetimeLocal(d.toISOString());
}

function isExpired(key: OrganizationKey): boolean {
  return new Date(key.expiresAt).getTime() <= Date.now();
}

// The .env endpoint is requested as a blob, so its error bodies arrive as a Blob too.
async function getBlobApiErrorMessage(
  error: unknown,
): Promise<string | undefined> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    return (await error.response.data.text()) || undefined;
  }
  return getApiErrorMessage(error);
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore
        }
      }}
      className="cf-link shrink-0 text-xs"
    >
      {copied ? "已複製" : "複製"}
    </button>
  );
}

function KeyStatusBadge({ keyItem }: { keyItem: OrganizationKey }) {
  const [label, className] = keyItem.isRevoked
    ? ["已撤銷", "bg-slate-100 text-slate-600"]
    : isExpired(keyItem)
      ? ["已過期", "bg-red-100 text-red-700"]
      : ["有效", "bg-green-100 text-green-700"];
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

interface OrganizationKeysModalProps {
  /** The organization whose keys are shown; null = closed. */
  organization: Organization | null;
  onClose: () => void;
}

/** Admin: one organization's offline-import keys — list, create, edit description, revoke, .env. */
export function OrganizationKeysModal({
  organization,
  onClose,
}: OrganizationKeysModalProps) {
  return (
    <Modal
      open={!!organization}
      title={organization ? `離線金鑰 — ${organization.name}` : ""}
      onClose={onClose}
      wide="xl"
      fillHeight
    >
      {/* Keyed so reopening (or switching org) starts from a fresh load. */}
      {organization && (
        <OrganizationKeysPanel
          key={organization.id}
          organization={organization}
        />
      )}
    </Modal>
  );
}

function OrganizationKeysPanel({
  organization,
}: {
  organization: Organization;
}) {
  const [keys, setKeys] = useState<OrganizationKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedOrganizationKey | null>(
    null,
  );
  const [editingKey, setEditingKey] = useState<OrganizationKey | null>(null);
  const [envKey, setEnvKey] = useState<OrganizationKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOrganizationKeys(organization.id)
      .then((res) => {
        if (cancelled) return;
        setKeys(res.data.data);
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;
        const detail = getApiErrorMessage(error);
        setLoadError(`載入離線金鑰時發生錯誤${detail ? `：${detail}` : ""}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organization.id, reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const handleRevoke = async (key: OrganizationKey) => {
    if (
      !confirm(
        `確定要撤銷金鑰 ${key.keyPreview}？撤銷後無法復原，使用此金鑰的地端部署將無法再匯入資料。`,
      )
    )
      return;
    try {
      await revokeOrganizationKey(organization.id, key.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`撤銷金鑰時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }
    reload();
  };

  return (
    <>
      {/* Fills the modal's height: the toolbar stays put and only the table scrolls. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            地端部署以金鑰加密匯出檔。下載 .env 時勾選此組織中要連入該地端
            endpoint 的服務。
          </p>
          <Button
            onClick={() => setCreating(true)}
            disabled={!organization.isActive}
            className="shrink-0"
          >
            新增金鑰
          </Button>
        </div>

        {loadError && (
          <div className="cf-alert cf-alert--error mb-4 flex shrink-0 items-center justify-between gap-4">
            <span>{loadError}</span>
            <button type="button" onClick={reload} className="cf-link shrink-0">
              重試
            </button>
          </div>
        )}

        {loading ? (
          <LoadingState />
        ) : keys.length === 0 ? (
          !loadError && (
            <p className="py-6 text-center text-sm text-slate-400">
              此組織尚無離線金鑰
            </p>
          )
        ) : (
          // Fixed column widths so the table fits the modal's width (it scrolls sideways only on
          // screens too narrow for the minimum widths below); its height is whatever the modal
          // has left, scrolling vertically under a sticky header.
          <div className="cf-table-scroll min-h-0 flex-1 overflow-auto rounded border border-slate-200">
            <table className="cf-table min-w-[56rem] table-fixed">
              <colgroup>
                <col className="w-[12rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[5rem]" />
                <col />
                <col className="w-[11rem]" />
              </colgroup>
              <thead>
                <tr>
                  <th
                    className={`${STICKY_TH} px-3 py-2 font-medium text-slate-600`}
                  >
                    UUID
                  </th>
                  <th
                    className={`${STICKY_TH} px-3 py-2 font-medium text-slate-600`}
                  >
                    金鑰預覽
                  </th>
                  <th
                    className={`${STICKY_TH} px-3 py-2 font-medium text-slate-600`}
                  >
                    建立日期
                  </th>
                  <th
                    className={`${STICKY_TH} px-3 py-2 font-medium text-slate-600`}
                  >
                    到期日期
                  </th>
                  <th
                    className={`${STICKY_TH} px-3 py-2 font-medium text-slate-600`}
                  >
                    狀態
                  </th>
                  <th
                    className={`${STICKY_TH} px-3 py-2 font-medium text-slate-600`}
                  >
                    金鑰說明
                  </th>
                  <th
                    className={`${STICKY_TH} px-3 py-2 text-right font-medium text-slate-600`}
                  >
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-3 py-2">
                      {/* One line, cut off with … when the column is too narrow; full value on hover and via 複製. */}
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 truncate font-mono text-xs text-slate-600" title={key.id}>
                          {key.id}
                        </span>
                        <CopyButton value={key.id} />
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {key.keyPreview}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2 text-xs text-slate-600"
                      title={formatDisplayTime(key.createdAt)}
                    >
                      {formatDisplayDate(key.createdAt)}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-2 text-xs text-slate-600"
                      title={formatDisplayTime(key.expiresAt)}
                    >
                      {formatDisplayDate(key.expiresAt)}
                    </td>
                    <td className="px-3 py-2">
                      <KeyStatusBadge keyItem={key} />
                    </td>
                    <td className="break-words px-3 py-2 text-slate-700">
                      {key.description || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setEnvKey(key)}
                        // Revoked or expired keys shouldn't be deployed again.
                        disabled={key.isRevoked || isExpired(key)}
                        title={
                          key.isRevoked
                            ? "已撤銷的金鑰無法下載 .env"
                            : isExpired(key)
                              ? "已過期的金鑰無法下載 .env"
                              : undefined
                        }
                        className="cf-link mr-3 disabled:opacity-40"
                      >
                        下載 .env
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingKey(key)}
                        className="cf-link mr-3"
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRevoke(key)}
                        disabled={key.isRevoked}
                        className="text-red-600 hover:text-red-800 disabled:opacity-40"
                      >
                        撤銷
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateKeyModal
        open={creating}
        organization={organization}
        onClose={() => setCreating(false)}
        onCreated={(created) => {
          setCreating(false);
          setCreatedKey(created);
          reload();
        }}
      />

      <Modal
        open={!!createdKey}
        title="金鑰已建立"
        onClose={() => setCreatedKey(null)}
      >
        {createdKey && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              關閉後畫面上無法再次檢視完整金鑰，之後請透過「下載 .env」取得。
            </p>
            {[
              { label: "金鑰 UUID（key_id）", value: createdKey.id },
              { label: "完整金鑰（AES KEY）", value: createdKey.aesKey },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="mb-1 text-xs font-medium text-slate-500">
                  {label}
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="flex-1 break-all font-mono text-sm text-slate-700">
                    {value}
                  </span>
                  <CopyButton value={value} />
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <Button onClick={() => setCreatedKey(null)}>關閉</Button>
            </div>
          </div>
        )}
      </Modal>

      <EditKeyModal
        organization={organization}
        keyItem={editingKey}
        onClose={() => setEditingKey(null)}
        onSaved={() => {
          setEditingKey(null);
          reload();
        }}
      />

      <EnvDownloadModal
        organization={organization}
        keyItem={envKey}
        onClose={() => setEnvKey(null)}
      />
    </>
  );
}

function CreateKeyModal({
  open,
  organization,
  onClose,
  onCreated,
}: {
  open: boolean;
  organization: Organization;
  onClose: () => void;
  onCreated: (key: CreatedOrganizationKey) => void;
}) {
  return (
    <Modal open={open} title="新增離線金鑰" onClose={onClose}>
      {/* Mounted only while open, so every open starts from an empty form. */}
      {open && (
        <CreateKeyForm
          organization={organization}
          onClose={onClose}
          onCreated={onCreated}
        />
      )}
    </Modal>
  );
}

function CreateKeyForm({
  organization,
  onClose,
  onCreated,
}: {
  organization: Organization;
  onClose: () => void;
  onCreated: (key: CreatedOrganizationKey) => void;
}) {
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt);
  const [error, setError] = useState("");
  const [saving, guardSave] = useSubmitGuard();

  const handleSave = async () => {
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
      const res = await createOrganizationKey(organization.id, {
        description: description.trim() || undefined,
        expiresAt: expiresAtIso,
      });
      onCreated(res.data);
    } catch (err) {
      const detail = getApiErrorMessage(err);
      setError(`新增金鑰時發生錯誤${detail ? `：${detail}` : ""}`);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="cf-alert cf-alert--error">{error}</div>}
      <p className="text-sm text-slate-600">所屬組織：{organization.name}</p>
      <Input
        label="金鑰說明"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={DESCRIPTION_MAX_LENGTH}
        placeholder="選填，例如：部署機關、主機、負責人"
      />
      <div className="space-y-1.5">
        <label
          htmlFor="orgKeyExpiresAt"
          className="block text-sm font-medium text-slate-700"
        >
          到期時間
        </label>
        <DateTimeInput
          id="orgKeyExpiresAt"
          aria-label="到期時間"
          value={expiresAt}
          onChange={setExpiresAt}
          className="w-full"
          inputClassName="cf-input"
        />
      </div>
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        儲存後將自動產生一組 256-bit AES KEY（Base64
        編碼），完整金鑰僅在建立後顯示一次。
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button onClick={() => guardSave(handleSave)} disabled={saving}>
          {saving ? "儲存中…" : "儲存"}
        </Button>
      </div>
    </div>
  );
}

function EditKeyModal({
  organization,
  keyItem,
  onClose,
  onSaved,
}: {
  organization: Organization;
  keyItem: OrganizationKey | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal open={!!keyItem} title="編輯金鑰說明" onClose={onClose}>
      {keyItem && (
        <EditKeyForm
          key={keyItem.id}
          organization={organization}
          keyItem={keyItem}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function EditKeyForm({
  organization,
  keyItem,
  onClose,
  onSaved,
}: {
  organization: Organization;
  keyItem: OrganizationKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [description, setDescription] = useState(keyItem.description ?? "");
  const [error, setError] = useState("");
  const [saving, guardSave] = useSubmitGuard();

  const handleSave = async () => {
    try {
      await updateOrganizationKey(organization.id, keyItem.id, {
        description: description.trim() || null,
      });
      onSaved();
    } catch (err) {
      const detail = getApiErrorMessage(err);
      setError(`更新金鑰說明時發生錯誤${detail ? `：${detail}` : ""}`);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="cf-alert cf-alert--error">{error}</div>}
      <p className="text-xs text-slate-500">
        金鑰 <span className="font-mono">{keyItem.id}</span>（
        {keyItem.keyPreview}）僅能修改說明。
      </p>
      <Input
        label="金鑰說明"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={DESCRIPTION_MAX_LENGTH}
        placeholder="留空即清除說明"
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button onClick={() => guardSave(handleSave)} disabled={saving}>
          {saving ? "儲存中…" : "儲存"}
        </Button>
      </div>
    </div>
  );
}

/** Picks which of the org's active services this on-prem endpoint accepts; not remembered between downloads. */
function EnvDownloadModal({
  organization,
  keyItem,
  onClose,
}: {
  organization: Organization;
  keyItem: OrganizationKey | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!keyItem}
      title="下載 .env — 選擇可連入的服務"
      onClose={onClose}
    >
      {/* Remounted per open, so the selection is never remembered from the last download. */}
      {keyItem && (
        <EnvDownloadForm
          organization={organization}
          keyItem={keyItem}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function EnvDownloadForm({
  organization,
  keyItem,
  onClose,
}: {
  organization: Organization;
  keyItem: OrganizationKey;
  onClose: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, guardDownload] = useSubmitGuard();

  useEffect(() => {
    let cancelled = false;
    getServices({ organizationId: organization.id, isActive: true })
      .then((res) => {
        if (!cancelled) setServices(res.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = getApiErrorMessage(err);
        setError(`載入服務清單時發生錯誤${detail ? `：${detail}` : ""}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organization.id]);

  const allSelected =
    services.length > 0 && selected.length === services.length;
  const toggle = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );

  const handleDownload = async () => {
    if (selected.length === 0) {
      setError("請至少勾選一個服務");
      return;
    }
    try {
      const res = await generateOrganizationKeyEnv(
        organization.id,
        keyItem.id,
        selected,
      );
      saveBlob(res.data, `${keyItem.id.slice(0, 5)}.env`);
      onClose();
    } catch (err) {
      const detail = await getBlobApiErrorMessage(err);
      setError(`下載 .env 時發生錯誤${detail ? `：${detail}` : ""}`);
    }
  };

  return (
    <div className="space-y-4">
      {error && <div className="cf-alert cf-alert--error">{error}</div>}
      <p className="text-xs text-slate-500">
        金鑰 <span className="font-mono">{keyItem.keyPreview}</span>
        {keyItem.description ? `（${keyItem.description}）` : ""}
        。勾選的服務會寫入 .env 的
        ALLOWED_SERVICES，只有這些服務可以連入這個地端
        endpoint。每次下載都需重新勾選。
      </p>

      {loading ? (
        <LoadingState />
      ) : services.length === 0 ? (
        <p className="py-3 text-sm text-slate-400">
          此組織沒有啟用中的服務，無法產生 .env
        </p>
      ) : (
        <div className="rounded border border-[#d9d9d9]">
          <label className="flex cursor-pointer items-center gap-2 border-b border-[#d9d9d9] bg-slate-50 px-3 py-2 text-sm font-medium text-[#1d1d1d]">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(allSelected ? [] : services.map((s) => s.id))
              }
              className="h-4 w-4 rounded border-[#d9d9d9] text-[#0055dc] focus:ring-[#0055dc]"
            />
            全選（{selected.length}/{services.length}）
          </label>
          <div className="max-h-64 space-y-2 overflow-y-auto p-3">
            {services.map((svc) => (
              <label
                key={svc.id}
                className="flex cursor-pointer items-center gap-2 text-sm text-[#1d1d1d]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(svc.id)}
                  onChange={() => toggle(svc.id)}
                  className="h-4 w-4 rounded border-[#d9d9d9] text-[#0055dc] focus:ring-[#0055dc]"
                />
                <span>{svc.name}</span>
                <span className="font-mono text-xs text-slate-500">
                  {svc.code} · {svc.host}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
        .env 內含完整金鑰，每次下載都會記錄於稽核日誌，請妥善保管。
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button
          onClick={() => guardDownload(handleDownload)}
          disabled={downloading || loading || selected.length === 0}
        >
          {downloading ? "產生中…" : "下載 .env"}
        </Button>
      </div>
    </div>
  );
}
