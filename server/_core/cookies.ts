// server/_core/cookies.ts
// Helpers mínimos para session cookie usados pelo oauth.ts e pelo restante do backend.
// Ajuste os valores (nome do cookie, maxAge, domain) conforme sua necessidade.

export const COOKIE_NAME = "money_goal_session";

export function getSessionCookieOptions() {
  return {
    // cookie settings básicos — ajuste conforme precisar
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    // maxAge em segundos (ex.: 7 dias)
    maxAge: 60 * 60 * 24 * 7,
  };
}

/**
 * Cria o header Set-Cookie para o token de sessão.
 * @param token string (ex.: JWT)
 * @returns string pronto para usar em `res.setHeader("Set-Cookie", ...)`
 */
export function buildSessionCookieHeader(token: string) {
  const opts = getSessionCookieOptions();
  const parts = [`${opts.name}=${encodeURIComponent(token)}`];

  if (opts.maxAge) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  // Domain não definido por padrão — defina se precisar:
  // if (opts.domain) parts.push(`Domain=${opts.domain}`);

  return parts.join("; ");
}

/**
 * Cria header para limpar o cookie de sessão (logout).
 */
export function buildClearSessionCookieHeader() {
  const opts = getSessionCookieOptions();
  const parts = [`${opts.name}=; Max-Age=0; Path=${opts.path ?? "/"}`];
  // prefixa também HttpOnly/Secure/SameSite para segurança
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.secure) parts.push("Secure");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join("; ");
}
