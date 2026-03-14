"use client"

import { useState } from 'react';
import { useRouter } from "next/navigation";

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, LogIn, CheckCircle2 } from 'lucide-react';
import { notificationService } from '@/utils/notificationService';


export default function UnifiedLoginPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const router = useRouter();
  const [loginStep, setLoginStep] = useState<"email" | "otp">("email");
  const [loginEmail, setLoginEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const [registerData, setRegisterData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    unitNumber: '',
  });

  // const handleRequestMagicLink = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setIsLoading(true);

  //   try {
  //     const email = loginEmail.trim().toLowerCase();

  //     await fetch("/api/auth/start", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ email }),
  //     });

  //     toast({
  //       title: 'Magic Link Sent',
  //       description: 'If your email is registered, you will receive a magic link shortly.',
  //     });
      
  //     setEmailSent(true);
  //     setLoginEmail('');
  //   } catch (error) {
  //     console.error('❌ Error requesting magic link:', error);
  //     toast({
  //       title: 'Error',
  //       description: 'An error occurred. Please try again.',
  //       variant: 'destructive',
  //     });
  //     setEmailSent(true)
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const email = loginEmail.trim().toLowerCase();

      await fetch("/api/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      toast({
        title: "Verification Code Sent",
        description: "If your email is registered, you will receive a 6-digit code shortly.",
      });

      setLoginEmail(email);
      setLoginStep("otp");
    } catch (error) {
      console.error("❌ Error requesting OTP:", error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          otp: otpCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        toast({
          title: "Invalid Code",
          description: "The code is invalid or expired. Please try again.",
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
      console.error("❌ Error verifying OTP:", error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/resident/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData), // {firstName,lastName,email,phoneNumber}
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.error === "email_exists"
            ? "This email is already registered."
            : "Registration failed. Please try again.";
        toast({ title: "Registration Error", description: msg, variant: "destructive" });
        return;
      }

      toast({
        title: "Registration Submitted",
        description: "Your account is pending approval. You’ll be able to login once approved.",
      });

      setRegisterData({ firstName: "", lastName: "", email: "", phoneNumber: "", unitNumber: "" });
      setActiveTab("login");
    } catch (err) {
      console.error("Registration error:", err);
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
      {/* Minimal Access Portal */}
      <div className="w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="font-heading text-6xl md:text-7xl text-white mb-2">
            Warwick Condo
          </h1>
          <div className="h-px w-16 bg-white/30 mx-auto" />
        </div>

        {/* Login/Register Form Card */}
        <div className="bg-secondary rounded-3xl p-8 lg:p-12">
          {/* Header */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center">
              <LogIn size={32} className="text-secondary" />
            </div>
          </div>
          <h2 className="font-heading text-4xl text-secondary-foreground mb-2 text-center">
            {activeTab === 'login' ? 'Access Portal' : 'Create Account'}
          </h2>
          <p className="font-paragraph text-center text-secondary-foreground/70 mb-8">
            {activeTab === 'login' 
              ? loginStep === "email"
                ? 'Enter your email to receive a verification code'
                : 'Enter the 6-digit code sent to your email' 
              : 'Register as a resident'}
          </p>

          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-secondary-foreground/20">
            <button
              onClick={() => {
                setActiveTab('login');
                setLoginStep("email");
                setOtpCode("");
              }}
              className={`flex-1 py-3 font-paragraph text-base transition-colors ${
                activeTab === 'login'
                  ? 'text-secondary-foreground border-b-2 border-secondary-foreground'
                  : 'text-secondary-foreground/60 hover:text-secondary-foreground'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setActiveTab('register')}
              className={`flex-1 py-3 font-paragraph text-base transition-colors ${
                activeTab === 'register'
                  ? 'text-secondary-foreground border-b-2 border-secondary-foreground'
                  : 'text-secondary-foreground/60 hover:text-secondary-foreground'
              }`}
            >
              Register
            </button>
          </div>

          {/* Login Form */}
          {activeTab === 'login' && loginStep === 'email' && (
  <form onSubmit={handleRequestCode} className="space-y-6">
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
      <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
      <div className="font-paragraph text-sm text-blue-800">
        <p className="font-semibold mb-1">Email Code Login</p>
        <p>We'll send you a secure 6-digit verification code.</p>
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="login-email" className="font-paragraph text-base text-secondary-foreground">
        Email Address
      </Label>
      <Input
        id="login-email"
        type="email"
        required
        value={loginEmail}
        onChange={(e) => setLoginEmail(e.target.value)}
        className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
        placeholder="your@email.com"
      />
    </div>

    <Button
      type="submit"
      disabled={isLoading}
      className="w-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
    >
      {isLoading ? 'Sending...' : 'Send Verification Code'}
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

          {activeTab === 'login' && loginStep === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex gap-3">
                <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                <div className="font-paragraph text-sm text-green-800">
                  <p className="font-semibold mb-1">Check Your Email</p>
                  <p>Enter the 6-digit code sent to {loginEmail}.</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp-code" className="font-paragraph text-base text-secondary-foreground">
                  Verification Code
                </Label>
                <Input
                  id="otp-code"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground tracking-[0.35em] text-center text-xl"
                  placeholder="123456"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || otpCode.length !== 6}
                className="w-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
              >
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setLoginStep("email");
                  setOtpCode("");
                }}
                className="w-full"
              >
                Use Another Email
              </Button>
            </form>
          )}

          {/* Register Form */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="bg-primary/20 border border-primary/30 rounded-2xl p-4 flex gap-3">
                <AlertCircle size={20} className="text-secondary-foreground flex-shrink-0 mt-0.5" />
                <p className="font-paragraph text-sm text-secondary-foreground/80">
                  Register as a resident. Your account will be pending approval from an administrator.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name" className="font-paragraph text-base text-secondary-foreground">
                    First Name
                  </Label>
                  <Input
                    id="first-name"
                    required
                    value={registerData.firstName}
                    onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                    className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name" className="font-paragraph text-base text-secondary-foreground">
                    Last Name
                  </Label>
                  <Input
                    id="last-name"
                    required
                    value={registerData.lastName}
                    onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                    className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email" className="font-paragraph text-base text-secondary-foreground">
                  Email Address
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  required
                  value={registerData.email}
                  onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="your@email.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="font-paragraph text-base text-secondary-foreground">
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={registerData.phoneNumber}
                  onChange={(e) => setRegisterData({ ...registerData, phoneNumber: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit-number" className="font-paragraph text-base text-secondary-foreground">
                  Unit Number
                </Label>
                <Input
                  id="unit-number"
                  required
                  value={(registerData as any).unitNumber || ""}
                  onChange={(e) => setRegisterData({ ...(registerData as any), unitNumber: e.target.value })}
                  className="bg-secondary border-secondary-foreground/20 text-secondary-foreground"
                  placeholder="e.g., 12A"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-secondary-foreground text-secondary hover:bg-secondary-foreground/90 font-paragraph text-lg py-6"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>

              <p className="text-center font-paragraph text-sm text-secondary-foreground/70">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('login')}
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
