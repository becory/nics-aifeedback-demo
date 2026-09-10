import { useEffect, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui";
import { useAuth } from "../lib/auth";
import { getDefaultHomePath } from "../lib/routes";
import { postEnable2FA } from "../api/auth";

export function Setup2FAPage() {
  const { user, setup2FA, session } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [uri, setUri] = useState("");

  useEffect(() => {
    if (session?.accessToken) {
      navigate(getDefaultHomePath(user?.isSystemAdmin ?? false), {
        replace: true,
      });
      return;
    }
    if (!session?.pendingToken) {
      navigate("/login", { replace: true });
    }
  }, [session?.accessToken, session?.pendingToken, user, navigate]);

  useEffect(() => {
    if (!session?.pendingToken) return;
    const initializeQRCode = async () => {
      try {
        const get2FAResponse = await postEnable2FA(session.pendingToken || "");
        setUri(get2FAResponse.data.qrCodeUri);
      } catch (error) {
        console.error("Error enabling 2FA:", error);
      }
    };
    initializeQRCode();
  }, [session?.pendingToken]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const err = await setup2FA(code);
    setLoading(false);

    if (err) {
      setError(err);
    }
  };

  return (
    <AuthLayout
      wide
      title="綁定二階段驗證"
      description="使用 Google Authenticator 或其他驗證器 App 掃描 QR Code"
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="cf-alert cf-alert--error">{error}</div>}

        <div className="cf-auth__qr">
          <div className="cf-auth__qr-box">
            {uri && <QRCodeSVG value={uri} size={180} />}
          </div>
        </div>

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
            className="cf-input cf-input--center text-lg tracking-widest"
            placeholder="000000"
            autoComplete="one-time-code"
            required
          />
        </div>

        <Button
          type="submit"
          disabled={loading || code.length !== 6}
          className="cf-btn--block mt-6"
        >
          {loading ? "驗證中..." : "完成綁定"}
        </Button>
      </form>
    </AuthLayout>
  );
}
