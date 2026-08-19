import { apiRequest } from "@/lib/apiClient";
import type { Role } from "@/lib/constants/users";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  permissions: string[];
};

type AuthResponse = { user: AuthUser };

export function getCurrentUser() {
  return apiRequest<AuthResponse>("/auth/me");
}

export function login(username: string, pin: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { username, pin },
  });
}

export function logout() {
  return apiRequest("/auth/logout", { method: "POST" });
}