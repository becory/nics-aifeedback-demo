import { useState, type FormEvent } from "react";
import { AuthLayout } from "../components/AuthLayout";
import { Button, Input } from "../components/ui";
import { postChangePassword } from "../api/auth";
import { getApiErrorMessage } from "../api/api";
import { useAuth } from "../lib/auth";
import { PASSWORD_RULE_HINT } from "../lib/passwordRules";

export function ForcePasswordChangePage() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("新密碼與確認密碼不一致");
      return;
    }

    setLoading(true);
    try {
      await postChangePassword(currentPassword, newPassword);
    } catch (err) {
      setError(getApiErrorMessage(err) ?? "變更密碼時發生錯誤");
      setLoading(false);
      return;
    }

    // The server revoked every session of this account; sign in again with the new password.
    logout("密碼已更新，請以新密碼重新登入");
  };

  return (
    <AuthLayout title="請變更密碼" description="為了帳號安全，請先設定新密碼">
      <form onSubmit={handleSubmit}>
        {error && <div className="cf-alert cf-alert--error">{error}</div>}
        <Input label="目前密碼" type="password" value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
        <Input label="新密碼" type="password" value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required
          hint={PASSWORD_RULE_HINT} />
        <Input label="確認新密碼" type="password" value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
        <Button type="submit" disabled={loading} className="cf-btn--block mt-6">
          {loading ? "更新中..." : "更新密碼"}
        </Button>
        <Button variant="secondary" className="cf-btn--block mt-2" onClick={() => logout()}>
          登出
        </Button>
      </form>
    </AuthLayout>
  );
}
