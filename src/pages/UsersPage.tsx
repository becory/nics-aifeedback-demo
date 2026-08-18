import { useEffect, useState } from "react";
import type { CreateUser, Organization, User } from "../types";
import { Modal } from "../components/Modal";
import {
  Button,
  CheckboxGroup,
  EmptyState,
  Input,
  PageHeader,
} from "../components/ui";
import {
  changeUserPassword,
  createUser,
  deleteUser,
  getOrganizations,
  getUserById,
  getUsers,
  resetUser2FA,
  updateUser,
} from "../api";
import { getApiErrorMessage } from "../api/api";

function generateId() {
  return crypto.randomUUID();
}

export function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mfaExempt, setMfaExempt] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    const users = await getUsers();
    const orgs = await getOrganizations({ IsActive: true });
    setItems(users.data.data);
    setOrganizations(orgs.data.data);
  };

  useEffect(() => {
    refresh();
  }, []);

  const getOrgNames = (ids: string[]) =>
    ids
      .map((id) => organizations.find((o) => o.id === id)?.name)
      .filter(Boolean)
      .join("、") || "—";

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setPassword("");
    setOrganizationIds([]);
    setIsAdmin(false);
    setError("");
    setModalOpen(true);
    setMfaExempt(false);
  };

  const openEdit = async (user: User) => {
    try {
      const getUser = await getUserById(user.id);
      console.log("Fetched user:", getUser.data);
      if (!getUser.data) {
        alert("使用者不存在");
        return;
      }
      setEditing(getUser.data);
      setName(getUser.data.name);
      setEmail(getUser.data.email);
      setOrganizationIds([...getUser.data.organizationIds]);
      setIsAdmin(getUser.data.isSystemAdmin);
      setError("");
      setModalOpen(true);
      setMfaExempt(getUser.data.mfaExempt);
    } catch (error) {
      console.error("Error fetching user:", error);
      const detail = getApiErrorMessage(error);
      alert(`取得使用者資料時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }
  };

  const openChangePassword = (user: User) => {
    setPasswordTarget(user);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("請輸入中文名稱");
      return;
    }
    if (!email.trim()) {
      setError("請輸入信箱");
      return;
    }
    if (!editing && !password) {
      setError("請輸入密碼");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    try {
      if (editing) {
        const updateUserData: Partial<User> = {
          name: name.trim(),
          email: normalizedEmail,
          organizationIds,
          isSystemAdmin: isAdmin,
          mfaExempt: mfaExempt,
        };
        await updateUser(editing.id, updateUserData);
      } else {
        const newUser: CreateUser = {
          id: generateId(),
          name: name.trim(),
          email: normalizedEmail,
          initialPassword: password,
          organizationIds,
          isSystemAdmin: isAdmin,
          mfaExempt: mfaExempt,
        };
        await createUser(newUser);
      }
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setError(
        `${editing ? "更新" : "新增"}使用者時發生錯誤${detail ? `：${detail}` : ""}`,
      );
      return;
    }

    refresh();
    setModalOpen(false);
  };

  const handleChangePassword = async () => {
    if (!passwordTarget) return;

    setPasswordError("");
    if (!newPassword) {
      setPasswordError("請輸入新密碼");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("新密碼與確認密碼不一致");
      return;
    }

    try {
      await changeUserPassword(passwordTarget.id, newPassword);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setPasswordError(`更新密碼時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    setPasswordModalOpen(false);
    setPasswordTarget(null);
  };

  const handleReset2FA = async (user: User) => {
    if (
      !confirm(
        `確定要重設「${user.name}」的二階段驗證？該使用者下次登入時需重新綁定。`,
      )
    ) {
      return;
    }

    try {
      await resetUser2FA(user.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`重設二階段驗證時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    refresh();
  };

  const handleDelete = async (user: User) => {
    const adminCount = items.filter((u) => u.isSystemAdmin).length;
    if (user.isSystemAdmin && adminCount <= 1) {
      alert("系統至少需要一位管理員，無法刪除");
      return;
    }
    if (!confirm(`確定要刪除使用者「${user.name}」？`)) return;

    try {
      await deleteUser(user.id);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      alert(`刪除使用者時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    }

    refresh();
  };

  const orgOptions = organizations.map((o) => ({
    value: o.id,
    label: `${o.name} (${o.code})`,
  }));

  return (
    <>
      <PageHeader
        title="使用者管理"
        description="管理系統使用者帳號與權限（所有使用者均須綁定二階段驗證）"
        action={<Button onClick={openCreate}>新增使用者</Button>}
      />

      {items.length === 0 ? (
        <EmptyState message="尚無使用者資料" />
      ) : (
        <div className="cf-card">
          <table className="cf-table">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium text-slate-600">
                  中文名稱
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">信箱</th>
                <th className="px-4 py-3 font-medium text-slate-600">組織</th>
                <th className="px-4 py-3 font-medium text-slate-600">
                  二階段驗證
                </th>
                <th className="px-4 py-3 font-medium text-slate-600">管理員</th>
                <th className="px-4 py-3 font-medium text-slate-600 text-right">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {user.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {getOrgNames(user.organizationIds)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.mfaExempt
                          ? "bg-blue-100 text-blue-700"
                          : user.twoFactorEnabled
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {user.mfaExempt
                        ? "免綁"
                        : user.twoFactorEnabled
                          ? "已綁定"
                          : "待綁定"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.isSystemAdmin ? (
                      <span className="cf-badge cf-badge--blue">是</span>
                    ) : (
                      <span className="text-slate-400">否</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="cf-link mr-3"
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => openChangePassword(user)}
                      className="cf-link mr-3"
                    >
                      修改密碼
                    </button>
                    {user.twoFactorEnabled && (
                      <button
                        type="button"
                        onClick={() => handleReset2FA(user)}
                        className="mr-2 text-amber-600 hover:text-amber-800"
                      >
                        重設二階段驗證
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(user)}
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
        title={editing ? "編輯使用者" : "新增使用者"}
        onClose={() => setModalOpen(false)}
        wide
      >
        <div className="space-y-4">
          {error && <div className="cf-alert cf-alert--error">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="中文名稱"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="信箱"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {!editing && (
            <Input
              label="密碼"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <CheckboxGroup
            label="所屬組織（可多選）"
            options={orgOptions}
            values={organizationIds}
            onChange={setOrganizationIds}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="h-4 w-4 rounded border-[#d9d9d9] text-[#0055dc] focus:ring-[#0055dc]"
            />
            管理員
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={mfaExempt}
              onChange={(e) => setMfaExempt(e.target.checked)}
              className="h-4 w-4 rounded border-[#d9d9d9] text-[#0055dc] focus:ring-[#0055dc]"
            />
            免用二階段驗證
          </label>

          {!editing && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
              二階段驗證為強制要求，使用者首次登入時須自行完成綁定。
            </p>
          )}

          {editing && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-700">
                二階段驗證狀態：
                <span className="ml-1 font-medium">
                  {editing.twoFactorEnabled ? "已綁定" : "待綁定"}
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  openChangePassword(editing);
                  setModalOpen(false);
                }}
                className="cf-link mt-2 text-sm"
              >
                修改密碼
              </button>
              {editing.twoFactorEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    handleReset2FA(editing);
                    setModalOpen(false);
                  }}
                  className="mt-2 ml-4 text-sm text-amber-600 hover:text-amber-800"
                >
                  重設二階段驗證
                </button>
              )}
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

      <Modal
        open={passwordModalOpen}
        title={`修改密碼 — ${passwordTarget?.name ?? ""}`}
        onClose={() => setPasswordModalOpen(false)}
      >
        <div className="space-y-4">
          {passwordError && (
            <div className="cf-alert cf-alert--error">{passwordError}</div>
          )}
          <Input
            label="新密碼"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="確認新密碼"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setPasswordModalOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleChangePassword}>更新密碼</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
