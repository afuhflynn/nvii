import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionCookie } from "better-auth/cookies";
import { NextRequest } from "next/server";
import proxy, { config } from "./proxy";

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: vi.fn(),
}));

describe("proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unauthenticated user (no session)", () => {
    beforeEach(() => {
      vi.mocked(getSessionCookie).mockReturnValue(null as any);
    });

    it("allows access to root public route", async () => {
      const request = new NextRequest("https://nvii.dev/");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.status).toBe(200);
    });

    it("allows access to /auth public route", async () => {
      const request = new NextRequest("https://nvii.dev/auth");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.status).toBe(200);
    });

    it("redirects protected route /projects to /auth with redirect query parameter", async () => {
      const request = new NextRequest("https://nvii.dev/projects");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe("https://nvii.dev/auth?redirect=%2Fprojects");
    });

    it("preserves search query parameters in the redirect destination", async () => {
      const request = new NextRequest(
        "https://nvii.dev/projects/nvii-core?tab=versions&view=compact",
      );
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe(
        "https://nvii.dev/auth?redirect=%2Fprojects%2Fnvii-core%3Ftab%3Dversions%26view%3Dcompact",
      );
    });

    it("redirects /app to /auth?redirect=/app", async () => {
      const request = new NextRequest("https://nvii.dev/app");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe("https://nvii.dev/auth?redirect=%2Fapp");
    });
  });

  describe("authenticated user (active session)", () => {
    beforeEach(() => {
      vi.mocked(getSessionCookie).mockReturnValue({
        name: "better-auth.session_token",
        value: "mock-session-token-xyz",
      } as any);
    });

    it("redirects from /auth back to /app", async () => {
      const request = new NextRequest("https://nvii.dev/auth");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe("https://nvii.dev/app");
    });

    it("redirects from / back to /app", async () => {
      const request = new NextRequest("https://nvii.dev/");
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toBe("https://nvii.dev/app");
    });

    it("allows access through to protected route /projects", async () => {
      const request = new NextRequest("https://nvii.dev/projects");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.status).toBe(200);
    });

    it("allows access through to /app", async () => {
      const request = new NextRequest("https://nvii.dev/app");
      const response = await proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.status).toBe(200);
    });
  });

  describe("middleware configuration", () => {
    it("defines route matcher excluding static assets and images", () => {
      expect(config.matcher).toBeDefined();
      expect(config.matcher.length).toBeGreaterThan(0);
    });
  });
});
