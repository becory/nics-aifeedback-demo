import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { getDefaultHomePath } from "../lib/routes";

export function ProtectedRoute() {
  const { ready, session } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f2f2]">
        <div className="cf-spinner" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (!session.accessToken) {
    if (session.requiresTwoFactorSetup)
      return <Navigate to="/2fa/setup" replace />;
    if (session.requiresTwoFactor) return <Navigate to="/2fa/verify" replace />;
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f2f2]">
        <div className="cf-spinner" />
      </div>
    );
  }

  if (!user?.isSystemAdmin) return <Navigate to="/my-services" replace />;

  return <Outlet />;
}

export function GuestRoute() {
  const { ready, session, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f2f2]">
        <div className="cf-spinner" />
      </div>
    );
  }

  if (session?.accessToken) {
    return (
      <Navigate to={getDefaultHomePath(user?.isSystemAdmin ?? false)} replace />
    );
  }
  if (session?.requiresTwoFactorSetup)
    return <Navigate to="/2fa/setup" replace />;
  if (session?.requiresTwoFactor) return <Navigate to="/2fa/verify" replace />;

  return <Outlet />;
}

export function TwoFactorRoute({ mode }: { mode: "setup" | "verify" }) {
  const { ready, session, user } = useAuth();

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f2f2f2]">
        <div className="cf-spinner" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  if (session.accessToken) {
    return (
      <Navigate to={getDefaultHomePath(user?.isSystemAdmin ?? false)} replace />
    );
  }
  if (mode === "setup" && !session.requiresTwoFactorSetup)
    return <Navigate to="/2fa/verify" replace />;
  if (mode === "verify" && session.requiresTwoFactorSetup)
    return <Navigate to="/2fa/setup" replace />;

  return <Outlet />;
}
