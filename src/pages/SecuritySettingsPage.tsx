import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { postChangePassword, postResetTwoFactor } from "../api/auth";
import { getApiErrorMessage } from "../api/api";
import { Button, Input, PageHeader } from "../components/ui";

export function SecuritySettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const handleChangePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if (!user) {
      setPasswordError("請先登入");
      return;
    }
    if (!currentPassword) {
      setPasswordError("請輸入目前密碼");
      return;
    }
    if (!newPassword) {
      setPasswordError("請輸入新密碼");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("新密碼與確認密碼不一致");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("新密碼不可與目前密碼相同");
      return;
    }

    setPasswordLoading(true);
    try {
      await postChangePassword(currentPassword, newPassword);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setPasswordError(`更新密碼時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    } finally {
      setPasswordLoading(false);
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSuccess("密碼已更新");
  };

  const handleResetTwoFactor = async () => {
    setResetError("");

    if (!resetPassword) {
      setResetError("請輸入目前密碼");
      return;
    }
    if (
      !confirm(
        "確定要重設二階段驗證？重設後您會立即被登出，下次登入時需要重新綁定。",
      )
    ) {
      return;
    }

    setResetLoading(true);
    try {
      await postResetTwoFactor(resetPassword);
    } catch (error) {
      const detail = getApiErrorMessage(error);
      setResetError(`重設二階段驗證時發生錯誤${detail ? `：${detail}` : ""}`);
      return;
    } finally {
      setResetLoading(false);
    }

    logout();
    navigate("/login");
  };

  return (
    <>
      <PageHeader title="安全性設定" description="管理您的密碼與二階段驗證" />

      <div className="space-y-6">
        <div className="cf-form-card max-w-md">
          <h2 className="cf-section-title mb-4">修改密碼</h2>
          {passwordError && (
            <div className="mb-4 cf-alert cf-alert--error">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="mb-4 cf-alert cf-alert--success">
              {passwordSuccess}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="目前密碼"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
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
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={passwordLoading}
            className="mt-6"
          >
            {passwordLoading ? "更新中..." : "更新密碼"}
          </Button>
        </div>

        <div className="cf-form-card max-w-md">
          <h2 className="cf-section-title mb-4">重設二階段驗證</h2>
          <p className="mb-4 text-sm text-slate-500">
            重設後您會立即被登出，下次登入時需要重新掃描 QR Code 綁定二階段驗證。
          </p>
          {resetError && (
            <div className="mb-4 cf-alert cf-alert--error">{resetError}</div>
          )}

          <Input
            label="目前密碼"
            type="password"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            autoComplete="current-password"
          />

          <Button
            variant="danger"
            onClick={handleResetTwoFactor}
            disabled={resetLoading}
            className="mt-6"
          >
            {resetLoading ? "重設中..." : "重設二階段驗證"}
          </Button>
        </div>
      </div>
    </>
  );
}
