import { apiRequest, ApiError } from "../lib/apiClient";

export { ApiError };

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export function signup(input: { email: string; password: string; displayName: string }): Promise<AuthResponse> {
  return apiRequest("/auth/signup", { method: "POST", body: input });
}

export function login(input: { email: string; password: string }): Promise<AuthResponse> {
  return apiRequest("/auth/login", { method: "POST", body: input });
}

export function fetchMe(token: string): Promise<AuthUser> {
  return apiRequest("/auth/me", { token });
}
