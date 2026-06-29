"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

function ResetPasswordForm() {
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";

  const [isLoading, setIsLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fieldLabelClass ="font-paragraph text-base !text-secondary-foreground opacity-100";

  const [showPassword, setShowPassword] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: "Invalid Reset Link",
        description: "This password reset link is missing or invalid.",
        variant: "destructive",
      });

      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Do Not Match",
        description: "Please enter the same password in both fields.",
        variant: "destructive",
      });

      return;
    }

    if (password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });

      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        toast({
          title: "Unable to Reset Password",
          description:
            data?.error === "invalid_or_expired_link"
              ? "This password reset link is invalid or has expired."
              : "Please request a new password reset link.",
          variant: "destructive",
        });

        return;
      }

      setCompleted(true);

      toast({
        title: "Password Updated",
        description: "You may now sign in with your new password.",
      });
    } catch (error) {
      console.error("[reset password]", error);

      toast({
        title: "Password Reset Error",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-secondary rounded-3xl p-8 lg:p-12">
        <h1 className="font-heading text-4xl text-secondary-foreground text-center mb-2">
          Reset Password
        </h1>

        <p className="font-paragraph text-center text-secondary-foreground/70 mb-8">
          Create a new password for your Warwick Condo account.
        </p>

        {completed ? (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex gap-3">
              <CheckCircle2
                size={20}
                className="text-green-600 flex-shrink-0 mt-0.5"
              />
              <p className="font-paragraph text-sm text-green-800">
                Your password has been updated. Please sign in with your new password.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="w-full bg-secondary-foreground text-secondary"
            >
              Go to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-6">
            {!token && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                <AlertCircle
                  size={20}
                  className="text-red-600 flex-shrink-0 mt-0.5"
                />
                <p className="font-paragraph text-sm text-red-800">
                  This password reset link is invalid or incomplete.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="new-password" className={fieldLabelClass}>New Password</Label>
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="bg-white !text-black caret-black placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password" className={fieldLabelClass}>Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                className="bg-white !text-black caret-black placeholder:text-gray-400"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer font-paragraph text-sm !text-black">
                <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-primary"
                />
                Show passwords
            </label>

            <Button
              type="submit"
              disabled={isLoading || !token}
              className="w-full bg-secondary-foreground text-secondary"
            >
              {isLoading ? "Updating Password..." : "Update Password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-primary flex items-center justify-center px-6">
          <div className="w-full max-w-md bg-secondary rounded-3xl p-8 text-center text-secondary-foreground">
            Loading password reset page...
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}