export function setToken(token: string) {
  document.cookie = `access_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60}; SameSite=Lax`;
}

export function clearToken() {
  document.cookie = "access_token=; path=/; max-age=0";
}

export function isAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("access_token=");
}
