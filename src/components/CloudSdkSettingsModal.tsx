import { useEffect, useState } from "react";
import { getSdkSettings, updateSdkSettings } from "../api";
import { getApiErrorMessage } from "../api/api";
import { formatDisplayTime } from "../lib/datetime";
import type { SdkSettings } from "../types";
import { Modal } from "./Modal";
import { Button, Input, LoadingState } from "./ui";

// Mirrors the backend's SdkScriptUrlFormat: absolute http/https URL without fragment or
// credentials (a query string is fine — nothing gets appended to it).
function isValidSdkScriptUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    !!url.hostname &&
    !url.hash &&
    !url.username &&
    !url.password
  );
}

interface CloudSdkSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

/** System-wide (not per Agent) SDK script URL every Cloud Agent's services load. */
export function CloudSdkSettingsModal({
  open,
  onClose,
}: CloudSdkSettingsModalProps) {
  return (
    <Modal open={open} title="雲端 SDK 設定" onClose={onClose} wide>
      {/* Mounted only while open, so each opening reloads the current value. */}
      {open && <CloudSdkSettingsForm onClose={onClose} />}
    </Modal>
  );
}

function CloudSdkSettingsForm({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<SdkSettings | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getSdkSettings()
      .then((response) => {
        if (cancelled) return;
        setSettings(response.data);
        setUrl(response.data.cloudSdkScriptUrl);
      })
      .catch((err) => {
        if (cancelled) return;
        const detail = getApiErrorMessage(err);
        setError(`載入雲端 SDK 設定時發生錯誤${detail ? `：${detail}` : ""}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("請輸入 SDK 載入網址");
      return;
    }
    if (!isValidSdkScriptUrl(trimmed)) {
      setError(
        "SDK 載入網址須為 http 或 https 開頭的完整網址，且不可包含 # 片段或帳號密碼",
      );
      return;
    }

    setSaving(true);
    try {
      await updateSdkSettings({ cloudSdkScriptUrl: trimmed });
    } catch (err) {
      const detail = getApiErrorMessage(err);
      setError(`更新雲端 SDK 設定時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    } finally {
      setSaving(false);
    }
    onClose();
  };

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-4">
      {error && <div className="cf-alert cf-alert--error">{error}</div>}
      <Input
        label="SDK 載入網址"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://cdn.jsdelivr.net/gh/nics-tw/aifeedback-sdk@1.0.0/dist/feedback-sdk.min.js"
      />
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
        {"所有雲端服務代理的服務共用這個網址載入 SDK，升版時修改版本號即可；地端服務代理由代理本身提供 SDK（{API URL}/sdk/feedback-sdk.min.js），不受此設定影響。"}
        {settings?.updatedAt
          ? `最後更新：${formatDisplayTime(settings.updatedAt)}`
          : "目前使用系統預設值，尚未儲存過。"}
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onClose}>
          取消
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "儲存中…" : "儲存"}
        </Button>
      </div>
    </div>
  );
}
