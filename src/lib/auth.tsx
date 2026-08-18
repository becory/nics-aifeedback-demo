import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "../types";
import {
  getUserInfo,
  post2FA,
  postConfirm2FA,
  postLogin,
  postRefresh,
} from "../api/auth";
import {
  setAccessToken,
  setOnUnauthorized,
  setRefreshHandler,
} from "../api/api";
import axios from "axios";

interface AuthContextValue {
  ready: boolean;
  session: Session | null;
  user: User | null;
  login: (
    username: string,
    password: string,
  ) => Promise<{ error?: string; step?: "2fa_setup" | "2fa_verify" }>;
  verify2FA: (code: string) => Promise<string | null>;
  setup2FA: (code: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const didInit = useRef(false);

  const refreshSession = useCallback(async () => {
    const refreshData = await postRefresh();
    setAccessToken(refreshData.data.accessToken);
    setSession((prev) =>
      prev
        ? { ...prev, accessToken: refreshData.data.accessToken }
        : {
            requiresTwoFactorSetup: false,
            requiresTwoFactor: false,
            accessToken: refreshData.data.accessToken,
          },
    );
    const userInfo = await getUserInfo();
    setUser(userInfo.data);
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    const init = async () => {
      try {
        await refreshSession();
      } catch {
        // 沒有有效的 refresh token，維持未登入狀態
      } finally {
        setReady(true);
      }
    };
    init();
  }, [refreshSession]);

  useEffect(() => {
    setAccessToken(session?.accessToken ?? null);
  }, [session?.accessToken]);

  useEffect(() => {
    setRefreshHandler(refreshSession);
    setOnUnauthorized(() => {
      setAccessToken(null);
      setSession(null);
      setUser(null);
    });
    return () => {
      setRefreshHandler(null);
      setOnUnauthorized(null);
    };
  }, [refreshSession]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const getLoginData = await postLogin(username, password);
      setSession(getLoginData.data);
      if (getLoginData.data.requiresTwoFactorSetup) {
        return { step: "2fa_setup" as const };
      }
      return { step: "2fa_verify" as const };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.log(error.status);
        console.error(error.response);
        return { error: "帳號或密碼錯誤" };
      }
      console.error(error);
      return { error: "登入時發生未知錯誤" };
    }
  }, []);

  const verify2FA = useCallback(
    async (code: string) => {
      if (!session?.pendingToken) return "請先登入";

      if (session?.requiresTwoFactorSetup) return "二階段驗證尚未設定";

      try {
        const check2FA = await post2FA(session.pendingToken, code);
        setAccessToken(check2FA.data.accessToken);
        setSession((prev) =>
          prev ? { ...prev, accessToken: check2FA.data.accessToken } : prev,
        );
        const userInfo = await getUserInfo();
        setUser(userInfo.data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.log(error.status);
          console.error(error.response);
          return "驗證碼錯誤";
        }
        console.error(error);
        return "驗證時發生未知錯誤";
      }

      return null;
    },
    [session],
  );

  const setup2FA = useCallback(
    async (code: string) => {
      if (!session?.pendingToken) return "請先登入";
      try {
        const confirm2FA = await postConfirm2FA(session.pendingToken, code);
        setAccessToken(confirm2FA.data.accessToken);
        setSession((prev) =>
          prev ? { ...prev, accessToken: confirm2FA.data.accessToken } : prev,
        );
        const userInfo = await getUserInfo();
        setUser(userInfo.data);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.log(error.status);
          console.error(error.response);
          return "驗證碼錯誤，請確認已掃描 QR Code";
        }
        console.error(error);
        return "綁定時發生未知錯誤";
      }
      return null;
    },
    [session],
  );

  const logout = useCallback(() => {}, []);

  const value = useMemo(
    () => ({
      ready,
      session,
      user,
      login,
      verify2FA,
      setup2FA,
      logout,
    }),
    [ready, session, user, login, verify2FA, setup2FA, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
