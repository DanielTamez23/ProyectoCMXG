export type UserRole = "admin" | "user";

export type AuthSession = {
  username: string;
  role: UserRole;
  loggedInAt: number;
};

const AUTH_STORAGE_KEY = "station_flow_session";

export function getAllowedUsers() {
  const loginUser = process.env.NEXT_PUBLIC_LOGIN_USER || "CarrierCMXG";
  const loginPass = process.env.NEXT_PUBLIC_LOGIN_PASS || "CarrierCMXG2026";

  const adminUser = process.env.NEXT_PUBLIC_ADMIN_USER || "CarrierCMXG100";
  const adminPass = process.env.NEXT_PUBLIC_ADMIN_PASS || "CarrierCMXG2026100";

  return [
    { username: loginUser, password: loginPass, role: "user" as const },
    { username: adminUser, password: adminPass, role: "admin" as const },
  ];
}

export function createSession(username: string, role: UserRole): AuthSession {
  return { username, role, loggedInAt: Date.now() };
}

export function saveSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.username || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
}
