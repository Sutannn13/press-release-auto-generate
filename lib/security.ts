export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  if (!origin) {
    return process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(requestUrl.hostname);
  }
  try {
    const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host") || requestUrl.host;
    const forwardedProto = request.headers.get("x-forwarded-proto") || requestUrl.protocol.replace(":", "");
    return new URL(origin).origin === `${forwardedProto}://${forwardedHost}`;
  } catch {
    return false;
  }
}

export function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
}

export function safeLog(
  id: string,
  route: string,
  status: number,
  startedAt: number,
  category: string,
) {
  console.info(
    JSON.stringify({
      requestId: id,
      route,
      status,
      durationMs: Date.now() - startedAt,
      category,
    }),
  );
}
