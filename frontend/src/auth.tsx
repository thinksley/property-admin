import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export interface User { id: number; username: string; real_name: string; role: string }

// 与后端 ROLE_PERMS 保持一致，仅用于界面显示控制；真正的校验在后端
const PERMS: Record<string, string[]> = {
  admin: ["*"],
  manager: ["house:read", "house:write", "bill:read", "bill:write",
    "repair:read", "repair:write", "repair:handle", "dashboard:read",
    "archive:read", "archive:write", "fee:read", "fee:write",
    "visitor:read", "visitor:write", "parking:read", "parking:write",
    "complaint:read", "complaint:write", "notice:read", "notice:write",
    "asset:read", "asset:write", "inspection:read", "inspection:write",
    "report:read"],
  cashier: ["house:read", "bill:read", "bill:write", "dashboard:read",
    "archive:read", "fee:read", "fee:write", "visitor:read",
    "parking:read", "parking:write", "complaint:read", "notice:read",
    "report:read"],
  finance: ["house:read", "bill:read", "dashboard:read", "archive:read",
    "fee:read", "report:read"],
  repairman: ["repair:read", "repair:handle", "inspection:read",
    "inspection:write", "asset:read"],
};

interface AuthCtx {
  user: User | null;
  loading: boolean;
  can: (perm: string) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      setLoading(false);
      return;
    }
    api.get<User>("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const { data } = await api.post<{ access_token: string }>(
      "/auth/login", new URLSearchParams({ username, password }));
    localStorage.setItem("token", data.access_token);
    setUser((await api.get<User>("/auth/me")).data);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const can = (perm: string) => {
    if (!user) return false;
    const perms = PERMS[user.role] ?? [];
    return perms.includes("*") || perms.includes(perm);
  };

  return <Ctx.Provider value={{ user, loading, can, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth 必须在 AuthProvider 内使用");
  return ctx;
}
