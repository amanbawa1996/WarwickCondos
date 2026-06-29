"use client";

import { useState } from "react";
import { AlertCircle, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function UnifiedLoginPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loginMode, setLoginMode] = useState<"login" | "forgot">("login");

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [forgotEmail, setForgotEmail] = useState("");

  const [registerData, setRegisterData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    unitNumber: "",
    password: "",
    confirmPassword: "",
  });

  const fieldLabelClass ="font-paragraph text-base !text-secondary-foreground opacity-100";

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginData.email.trim().toLowerCase(),
          password: loginData.password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        const message =
          data?.error === "pending_approval"
            ? "Your registration is still pending administrator approval."
            : data?.error === "account_inactive"
              ? "This account is inactive."
              : "Incorrect email address or password.";

        toast({
          title: "Unable to Sign In",
          description: message,
          variant: "destructive",
        });

        return;
      }

      toast({
        title: "Login Successful",
        description: "Redirecting to your portal...",
      });

      window.location.href = data.redirectTo || "/";
    } catch (error) {
      console.error("[password login]", error);

      toast({
        title: "Login Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
        }),
      });

      toast({
        title: "Check Your Email",
        description:
          "If an active account matches that email address, a password reset link has been sent.",
      });

      setLoginMode("login");
      setLoginData((current) => ({
        ...current,
        email: forgotEmail.trim().toLowerCase(),
      }));
      setForgotEmail("");
    } catch (error) {
      console.error("[forgot password]", error);

      toast({
        title: "Password Reset Error",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerData.password !== registerData.confirmPassword) {
      toast({
        title: "Passwords Do Not Match",
        description: "Please enter the same password in both fields.",
        variant: "destructive",
      });

      return;
    }

    if (registerData.password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });

      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/resident/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.error === "email_exists"
            ? "This email is already registered."
            : data?.error === "duplicate_record"
              ? "A resident account with these details may already exist."
              : data?.error === "weak_password"
                ? "Password must be at least 8 characters."
                : "Registration failed. Please try again.";

        toast({
          title: "Registration Error",
          description: msg,
          variant: "destructive",
        });

        return;
      }

      toast({
        title: "Registration Submitted",
        description:
          "Your account is pending approval. You may sign in with your password after approval.",
      });

      setLoginData({
        email: registerData.email.trim().toLowerCase(),
        password: "",
      });

      setRegisterData({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        unitNumber: "",
        password: "",
        confirmPassword: "",
      });

      setActiveTab("login");
      setLoginMode("login");
    } catch (error) {
      console.error("[registration]", error);

      toast({
        title: "Registration Error",
        description: "An error occurred during registration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="font-heading text-6xl md:text-7xl text-white mb-2">
            Warwick Condo
          </h1>
          <div className="h-px w-16 bg-white/30 mx-auto" />
        </div>

        <div className="bg-secondary text-secondary-foreground rounded-3xl p-8 lg:p-12">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <LogIn size={32} className="text-secondary" />
            </div>
          </div>

          <h2 className="font-heading text-4xl text-secondary-foreground mb-2 text-center">
            {activeTab === "register"
              ? "Create Account"
              : loginMode === "forgot"
                ? "Reset Password"
                : "Access Portal"}
          </h2>

          <p className="font-paragraph text-center text-secondary-foreground/70 mb-8">
            {activeTab === "register"
              ? "Register as a resident"
              : loginMode === "forgot"
                ? "Enter your account email address"
                : "Sign in with your email address and password"}
          </p>

          <div className="flex gap-4 mb-8 border-b border-secondary-foreground/20">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setLoginMode("login");
              }}
              className={`flex-1 py-3 font-paragraph text-base transition-colors ${
                activeTab === "login"
                  ? "text-secondary-foreground border-b-2 border-secondary-foreground"
                  : "text-secondary-foreground/60 hover:text-secondary-foreground"
              }`}
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setLoginMode("login");
              }}
              className={`flex-1 py-3 font-paragraph text-base transition-colors ${
                activeTab === "register"
                  ? "text-secondary-foreground border-b-2 border-secondary-foreground"
                  : "text-secondary-foreground/60 hover:text-secondary-foreground"
              }`}
            >
              Register
            </button>
          </div>

          {activeTab === "login" && loginMode === "login" && (
            <form onSubmit={handlePasswordLogin} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
                <AlertCircle
                  size={20}
                  className="text-blue-600 flex-shrink-0 mt-0.5"
                />
                <div className="font-paragraph text-sm text-blue-800">
                  <p className="font-semibold mb-1">Resident Login Instructions</p>
                  <p>Residents must register and be approved before signing in.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-email" className={fieldLabelClass}>Email Address</Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  value={loginData.email}
                  onChange={(e) =>
                    setLoginData((current) => ({
                      ...current,
                      email: e.target.value,
                    }))
                  }
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="your@email.com"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className={fieldLabelClass}>Password</Label>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginData.email);
                      setLoginMode("forgot");
                    }}
                    className="font-paragraph text-sm text-secondary-foreground hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <Input
                  id="login-password"
                  type="password"
                  required
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData((current) => ({
                      ...current,
                      password: e.target.value,
                    }))
                  }
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="Enter your password"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>

              <p className="text-center font-paragraph text-sm text-secondary-foreground/70">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("register")}
                  className="text-secondary-foreground hover:underline font-semibold"
                >
                  Register here
                </button>
              </p>
            </form>
          )}

          {activeTab === "login" && loginMode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
                <AlertCircle
                  size={20}
                  className="text-blue-600 flex-shrink-0 mt-0.5"
                />
                <div className="font-paragraph text-sm text-blue-800">
                  <p className="font-semibold mb-1">Password Reset</p>
                  <p>
                    We will email a one-time password reset link to your active
                    account email address.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="forgot-email" >Email Address</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="your@email.com"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
              >
                {isLoading ? "Sending..." : "Email Reset Link"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => setLoginMode("login")}
                className="w-full"
              >
                Back to Login
              </Button>
            </form>
          )}

          {activeTab === "register" && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="bg-primary/20 border border-primary/30 rounded-2xl p-4 flex gap-3">
                <AlertCircle
                  size={20}
                  className="text-secondary-foreground flex-shrink-0 mt-0.5"
                />
                <p className="font-paragraph text-sm text-secondary-foreground/80">
                  Register as a resident. Your account will remain pending until
                  an administrator approves it.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name" className={fieldLabelClass}>First Name</Label>
                  <Input
                    id="first-name"
                    required
                    value={registerData.firstName}
                    onChange={(e) =>
                      setRegisterData((current) => ({
                        ...current,
                        firstName: e.target.value,
                      }))
                    }
                    className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                    placeholder="John"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last-name" className={fieldLabelClass}>Last Name</Label>
                  <Input
                    id="last-name"
                    required
                    value={registerData.lastName}
                    onChange={(e) =>
                      setRegisterData((current) => ({
                        ...current,
                        lastName: e.target.value,
                      }))
                    }
                    className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email" className={fieldLabelClass}>Email Address</Label>
                <Input
                  id="register-email"
                  type="email"
                  required
                  value={registerData.email}
                  onChange={(e) =>
                    setRegisterData((current) => ({
                      ...current,
                      email: e.target.value,
                    }))
                  }
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="your@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className={fieldLabelClass}>Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={registerData.phoneNumber}
                  onChange={(e) =>
                    setRegisterData((current) => ({
                      ...current,
                      phoneNumber: e.target.value,
                    }))
                  }
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit-number" className={fieldLabelClass}>Unit Number</Label>
                <Input
                  id="unit-number"
                  required
                  value={registerData.unitNumber}
                  onChange={(e) =>
                    setRegisterData((current) => ({
                      ...current,
                      unitNumber: e.target.value,
                    }))
                  }
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="e.g., 12A"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password" className={fieldLabelClass}>Create Password</Label>
                <Input
                  id="register-password"
                  type="password"
                  required
                  minLength={8}
                  value={registerData.password}
                  onChange={(e) =>
                    setRegisterData((current) => ({
                      ...current,
                      password: e.target.value,
                    }))
                  }
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="At least 8 characters"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className={fieldLabelClass}>Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  minLength={8}
                  value={registerData.confirmPassword}
                  onChange={(e) =>
                    setRegisterData((current) => ({
                      ...current,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="Re-enter your password"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>

              <p className="text-center font-paragraph text-sm text-secondary-foreground/70">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("login");
                    setLoginMode("login");
                  }}
                  className="text-secondary-foreground hover:underline font-semibold"
                >
                  Login here
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}