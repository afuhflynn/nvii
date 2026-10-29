import { describe, expect, it } from "vitest";
import {
  DEFAULT_LANDING_PATH,
  buildCallbackURL,
  sanitizeRedirectPath,
} from "./redirect";

describe("sanitizeRedirectPath", () => {
  describe("happy path", () => {
    it("preserves valid in app root landing path", () => {
      const result = sanitizeRedirectPath("/app");
      expect(result).toBe("/app");
    });

    it("preserves valid in app nested sub paths", () => {
      const result = sanitizeRedirectPath("/projects/alpha-team/versions");
      expect(result).toBe("/projects/alpha-team/versions");
    });

    it("preserves query strings and search parameters on valid paths", () => {
      const result = sanitizeRedirectPath("/projects/123?tab=history&page=2");
      expect(result).toBe("/projects/123?tab=history&page=2");
    });

    it("preserves hash fragments on valid paths", () => {
      const result = sanitizeRedirectPath("/settings#general");
      expect(result).toBe("/settings#general");
    });

    it("trims surrounding whitespace on valid paths", () => {
      const result = sanitizeRedirectPath("   /dashboard   ");
      expect(result).toBe("/dashboard");
    });
  });

  describe("null and missing value edge cases", () => {
    it("falls back to default landing path when value is null", () => {
      const result = sanitizeRedirectPath(null);
      expect(result).toBe(DEFAULT_LANDING_PATH);
    });

    it("falls back to default landing path when value is undefined", () => {
      const result = sanitizeRedirectPath(undefined);
      expect(result).toBe(DEFAULT_LANDING_PATH);
    });

    it("falls back to default landing path when value is literal string 'null'", () => {
      const result = sanitizeRedirectPath("null");
      expect(result).toBe(DEFAULT_LANDING_PATH);
    });

    it("falls back to default landing path when value is literal string 'undefined'", () => {
      const result = sanitizeRedirectPath("undefined");
      expect(result).toBe(DEFAULT_LANDING_PATH);
    });

    it("falls back to default landing path when value is empty string", () => {
      const result = sanitizeRedirectPath("");
      expect(result).toBe(DEFAULT_LANDING_PATH);
    });

    it("falls back to default landing path when value contains only whitespace", () => {
      const result = sanitizeRedirectPath("     ");
      expect(result).toBe(DEFAULT_LANDING_PATH);
    });

    it("falls back to default landing path when non string types are passed", () => {
      expect(sanitizeRedirectPath(42 as unknown as string)).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath({} as unknown as string)).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath([] as unknown as string)).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath(true as unknown as string)).toBe(DEFAULT_LANDING_PATH);
    });
  });

  describe("security boundaries and open redirect prevention", () => {
    it("rejects protocol relative URLs that start with double slash", () => {
      const result = sanitizeRedirectPath("//evil.example.com/steal-token");
      expect(result).toBe(DEFAULT_LANDING_PATH);
    });

    it("rejects protocol relative URLs with leading whitespace", () => {
      const result = sanitizeRedirectPath("  //attacker.com  ");
      expect(result).toBe(DEFAULT_LANDING_PATH);
    });

    it("rejects backslash paths intended to trick browser URL parsers", () => {
      expect(sanitizeRedirectPath("/\\evil.example.com")).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath("\\\\evil.example.com")).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath("/safe\\unsafe")).toBe(DEFAULT_LANDING_PATH);
    });

    it("rejects absolute external URLs with http or https schemes", () => {
      expect(sanitizeRedirectPath("https://evil.example.com")).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath("http://evil.example.com/app")).toBe(DEFAULT_LANDING_PATH);
    });

    it("rejects script or data schemes", () => {
      expect(sanitizeRedirectPath("javascript:alert(1)")).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath("data:text/html,evil")).toBe(DEFAULT_LANDING_PATH);
    });

    it("rejects relative paths that do not start with forward slash", () => {
      expect(sanitizeRedirectPath("projects/123")).toBe(DEFAULT_LANDING_PATH);
    });

    it("rejects paths containing null bytes or ASCII control characters", () => {
      expect(sanitizeRedirectPath("/app\x00/admin")).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath("/app\r\nHeader-Injection: true")).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath("/app\t/test")).toBe(DEFAULT_LANDING_PATH);
      expect(sanitizeRedirectPath("/app\x7f/delete")).toBe(DEFAULT_LANDING_PATH);
    });
  });
});

describe("buildCallbackURL", () => {
  const origin = "https://nvii.dev";

  it("builds a callback URL pointing to the sanitized valid return path", () => {
    const url = buildCallbackURL("/projects/demo", origin);
    expect(url).toBe("https://nvii.dev/projects/demo");
  });

  it("builds a callback URL falling back to /app when redirect is null", () => {
    const url = buildCallbackURL(null, origin);
    expect(url).toBe("https://nvii.dev/app");
  });

  it("builds a callback URL falling back to /app when redirect is undefined", () => {
    const url = buildCallbackURL(undefined, origin);
    expect(url).toBe("https://nvii.dev/app");
  });

  it("builds a callback URL falling back to /app when redirect is literal string 'null'", () => {
    const url = buildCallbackURL("null", origin);
    expect(url).toBe("https://nvii.dev/app");
  });

  it("safely defuses malicious open redirect attempt into default landing path", () => {
    const url = buildCallbackURL("//evil.example.com/login", origin);
    expect(url).toBe("https://nvii.dev/app");
  });

  it("normalizes origin with trailing slash without producing duplicate slashes", () => {
    const url = buildCallbackURL("/app", "https://nvii.dev/");
    expect(url).toBe("https://nvii.dev/app");
  });
});
