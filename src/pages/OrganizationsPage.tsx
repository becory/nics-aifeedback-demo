import { useEffect, useState } from "react";
import type { Organization } from "../types";
import {
  createOrganization,
  deleteOrganization,
  getOrganizations,
  updateOrganization,
} from "../api";
import { getApiErrorMessage } from "../api/api";
import { Modal } from "../components/Modal";
import { Button, EmptyState, Input, PageHeader } from "../components/ui";

export function OrganizationsPage() {
  const [items, setItems] = useState<Organization[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    const orgs = await getOrganizations({ IsActive: true });
    setItems(orgs.data.data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setCode("");
    setError("");
    setModalOpen(true);
  };

  const openEdit = (org: Organization) => {
    setEditing(org);
    setName(org.name);
    setCode(org.code);
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("請輸入組織名稱");
      return;
    }
    if (!code.trim()) {
      setError("請輸入組織代碼");
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    try {
      if (editing) {
        await updateOrganization(editing.id, {
          name: name.trim(),
          code: normalizedCode,
        });
      } else {
        await createOrganization({ name: name.trim(), code: normalizedCode });
      }
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setError(
        `${editing ? "更新" : "新增"}組織時發生錯誤${detail ? `：${detail}` : ""}`,
      );
      return;
    }

    refresh();
    setModalOpen(false);
  };

  const handleDelete = async (org: Organization) => {
    if (!confirm(`確定要刪除組織「${org.name}」？`)) return;

    try {
      await deleteOrganization(org.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`刪除組織時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    refresh();
  };

  return (
    <>
      <PageHeader
        title="組織管理"
        description="管理系統中的組織單位"
        action={<Button onClick={openCreate}>新增組織</Button>}
      />

      {items.length === 0 ? (
        <EmptyState message="尚無組織資料，點擊「新增組織」開始建立" />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">
                  組織名稱
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  組織代碼
                </th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((org) => (
                <tr key={org.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {org.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {org.code}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(org)}
                      className="cf-link mr-3"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(org)}
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
        title={editing ? "編輯組織" : "新增組織"}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {error && <div className="cf-alert cf-alert--error">{error}</div>}
          <Input
            label="組織名稱"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="組織代碼"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="例如：NICS"
          />
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
