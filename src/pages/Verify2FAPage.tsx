import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui";
import { useAuth } from "../lib/auth";
import { getDefaultHomePath } from "../lib/routes";

export function Verify2FAPage() {
  const { verify2FA, session, user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.accessToken) {
      navigate(getDefaultHomePath(user?.isSystemAdmin ?? false), {
        replace: true,
      });
    }
  }, [session?.accessToken, user, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const err = await verify2FA(code);
    setLoading(false);

    if (err) {
      setError(err);
    }
  };

  return (
    <AuthLayout
      title="二階段驗證"
      description="請輸入驗證器 App 上的 6 位數驗證碼"
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="cf-alert cf-alert--error">{error}</div>}

        <div className="cf-field">
          <label htmlFor="code" className="cf-label">
            驗證碼
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="cf-input cf-input--center text-2xl tracking-[0.5em]"
            placeholder="000000"
            autoFocus
            autoComplete="one-time-code"
            required
          />
        </div>

        <Button
          type="submit"
          disabled={loading || code.length !== 6}
          className="cf-btn--block mt-6"
        >
          {loading ? "驗證中..." : "驗證"}
        </Button>
      </form>
    </AuthLayout>
  );
}
