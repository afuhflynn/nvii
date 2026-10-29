import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthButton } from "./auth-button";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

let mockQueryParams: { redirect: string | null } = { redirect: null };

vi.mock("nuqs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("nuqs")>();
  return {
    ...actual,
    useQueryStates: () => [mockQueryParams],
  };
});

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AuthButton component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryParams = { redirect: null };
  });

  describe("rendering and accessibility", () => {
    it("renders the sign in button with accessible name", () => {
      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      expect(button).toBeInTheDocument();
      expect(button).toBeEnabled();
    });

    it("is keyboard focusable via tab navigation", async () => {
      const user = userEvent.setup();
      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      await user.tab();
      expect(button).toHaveFocus();
    });
  });

  describe("login redirect resolution (null redirect bug prevention)", () => {
    it("redirects to /app when query param redirect is null", async () => {
      const user = userEvent.setup();
      mockQueryParams = { redirect: null };

      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      await user.click(button);

      expect(authClient.signIn.social).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(authClient.signIn.social).mock.calls[0][0];
      expect(callArgs.provider).toBe("github");
      expect(callArgs.callbackURL).toBe(`${window.location.origin}/app`);
      expect(callArgs.callbackURL).not.toContain("null");
    });

    it("redirects to requested target path when valid redirect query param is present", async () => {
      const user = userEvent.setup();
      mockQueryParams = { redirect: "/projects/sample-team" };

      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      await user.click(button);

      expect(authClient.signIn.social).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(authClient.signIn.social).mock.calls[0][0];
      expect(callArgs.callbackURL).toBe(
        `${window.location.origin}/projects/sample-team`,
      );
    });

    it("safely falls back to /app when redirect query param contains open redirect payload", async () => {
      const user = userEvent.setup();
      mockQueryParams = { redirect: "//evil.attacker.com" };

      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      await user.click(button);

      expect(authClient.signIn.social).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(authClient.signIn.social).mock.calls[0][0];
      expect(callArgs.callbackURL).toBe(`${window.location.origin}/app`);
      expect(callArgs.callbackURL).not.toContain("evil.attacker.com");
    });
  });

  describe("state transitions and notifications", () => {
    it("triggers success toast on successful authentication", async () => {
      const user = userEvent.setup();
      const reloadMock = vi.fn();
      Object.defineProperty(window, "location", {
        writable: true,
        value: {
          origin: "https://nvii.dev",
          reload: reloadMock,
        },
      });

      vi.mocked(authClient.signIn.social).mockImplementation(
        async (_params: any, options?: any) => {
          options?.onRequest?.();
          await options?.onSuccess?.();
          return {} as any;
        },
      );

      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      await user.click(button);

      expect(toast.success).toHaveBeenCalledWith("Signed in successfully");
      expect(reloadMock).toHaveBeenCalled();
    });

    it("triggers error toast with error message when authentication fails", async () => {
      const user = userEvent.setup();

      vi.mocked(authClient.signIn.social).mockImplementation(
        async (_params: any, options?: any) => {
          options?.onRequest?.();
          options?.onError?.({
            error: { message: "Account linking failed" },
          });
          return {} as any;
        },
      );

      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      await user.click(button);

      expect(toast.error).toHaveBeenCalledWith("Account linking failed", {
        description: "GitHub sign-in failed",
      });
    });

    it("handles unexpected thrown exceptions and resets loading state", async () => {
      const user = userEvent.setup();

      vi.mocked(authClient.signIn.social).mockRejectedValueOnce(
        new Error("Network connection dropped"),
      );

      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      await user.click(button);

      expect(toast.error).toHaveBeenCalledWith(
        "An unexpected error occurred during sign in.",
        {
          description: "GitHub sign-in failed",
        },
      );
      expect(button).toBeEnabled();
    });

    it("falls back to default message when error context has no message", async () => {
      const user = userEvent.setup();

      vi.mocked(authClient.signIn.social).mockImplementation(
        async (_params: any, options?: any) => {
          options?.onRequest?.();
          options?.onError?.({});
          return {} as any;
        },
      );

      render(<AuthButton />);
      const button = screen.getByRole("button", {
        name: /sign in with github/i,
      });

      await user.click(button);

      expect(toast.error).toHaveBeenCalledWith("Unknown error.", {
        description: "GitHub sign-in failed",
      });
    });
  });
});
