import assert from "node:assert/strict";

async function main() {
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.RATE_LIMIT_TEST_MODE = "allow";
  process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
  process.env.APP_ACCESS_PASSWORD = "rahasia-test-tidak-boleh-bocor";
  const [{ POST: login }, { POST: logout }] = await Promise.all([
    import("../app/api/auth/login/route"),
    import("../app/api/auth/logout/route"),
  ]);
  const request = (password: string, origin = "http://localhost") =>
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "X-Forwarded-For": "127.0.0.2" },
      body: JSON.stringify({ password }),
    });

  const wrongOrigin = await login(request("rahasia-test-tidak-boleh-bocor", "https://evil.example"));
  assert.equal(wrongOrigin.status, 403);

  const wrong = await login(request("password-salah"));
  assert.equal(wrong.status, 401);
  assert.ok(!(await wrong.text()).includes("rahasia-test-tidak-boleh-bocor"));

  const success = await login(request("rahasia-test-tidak-boleh-bocor"));
  assert.equal(success.status, 200);
  const cookie = success.headers.get("set-cookie") || "";
  assert.match(cookie, /kemenag_session=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);

  const loggedOut = await logout(new Request("http://localhost/api/auth/logout", {
    method: "POST",
    headers: { Origin: "http://localhost", Cookie: cookie.split(";")[0] },
  }));
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get("set-cookie") || "", /Max-Age=0/i);

  process.env.RATE_LIMIT_TEST_MODE = "unavailable";
  const unavailable = await login(request("rahasia-test-tidak-boleh-bocor"));
  assert.equal(unavailable.status, 503);

  console.log("Login, cookie aman, logout, origin, secret hygiene, dan Redis fail-closed lulus.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
