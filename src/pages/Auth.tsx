import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import logoAsset from "@/assets/gooodboys-logo.png.asset.json";

function GooodboysWordmark() {
  return (
    <div className="flex flex-col items-center select-none">
      <span
        className="font-brand font-black text-[2.6rem] text-primary leading-none"
        style={{ letterSpacing: "-0.03em", fontVariationSettings: '"SOFT" 50, "WONK" 1' }}
      >
        Gooodboys
      </span>
      <span className="text-[9px] text-primary/50 tracking-[0.32em] uppercase font-medium mt-1">
        Three O's Goood
      </span>
    </div>
  );
}

type Step = "credentials" | "mfa-setup" | "mfa-verify";

function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-6">
      <span className={`block h-1.5 rounded-full transition-all duration-300 ${current === 1 ? "w-5 bg-primary" : "w-1.5 bg-primary/30"}`} />
      <span className={`block h-1.5 rounded-full transition-all duration-300 ${current === 2 ? "w-5 bg-primary" : "w-1.5 bg-primary/30"}`} />
    </div>
  );
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";

  const [step, setStep] = useState<Step>("credentials");
  const [logoError, setLogoError] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [emailError, setEmailError] = useState(false);

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [factorId, setFactorId] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { navigate(returnTo, { replace: true }); return; }
      if (aal?.nextLevel === "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totp = factors?.totp?.[0];
        if (totp?.status === "verified") {
          setFactorId(totp.id);
          const { data: ch } = await supabase.auth.mfa.challenge({ factorId: totp.id });
          if (ch) setChallengeId(ch.id);
          advanceTo("mfa-verify");
        }
      }
    })();
  }, [navigate, returnTo]);

  function advanceTo(next: Step) {
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setErrorMsg("");
      setAnimating(false);
    }, 180);
  }

  function shakeError(msg: string) {
    setErrorMsg(msg);
    setEmailError(true);
    formRef.current?.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(0)" }],
      { duration: 300, easing: "ease-out" }
    );
    setTimeout(() => setEmailError(false), 600);
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!email.toLowerCase().endsWith("@gooodboys.com")) {
      shakeError("Alleen @gooodboys.com e-mailadressen zijn toegestaan.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (!totp || totp.status !== "verified") {
        await startMFASetup(email);
      } else {
        setFactorId(totp.id);
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (chErr) throw chErr;
        setChallengeId(ch.id);
        advanceTo("mfa-verify");
      }
    } catch (err: any) {
      shakeError(err.message || "Inloggen mislukt");
      toast.error(err.message || "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function startMFASetup(userEmail: string) {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Gooodboys",
      friendlyName: `${userEmail}-totp`,
    });
    if (error) throw error;
    setFactorId(data.id);
    setTotpSecret(data.totp.secret);
    const QRCode = (await import("qrcode")).default;
    const url = await QRCode.toDataURL(data.totp.uri, { width: 192, margin: 1, color: { dark: "#490303", light: "#ffffff" } });
    setQrDataUrl(url);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: data.id });
    if (chErr) throw chErr;
    setChallengeId(ch.id);
    advanceTo("mfa-setup");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: otpCode });
      if (error) throw error;
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      shakeError(err.message || "Ongeldige code");
      toast.error(err.message || "Ongeldige code");
      setOtpCode("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center px-4 overflow-hidden">
      {/* Warm ambient wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(90% 60% at 50% -10%, hsl(var(--primary) / 0.08), transparent 60%)" }}
      />
      <div
        ref={formRef}
        className={`relative w-full max-w-sm transition-opacity duration-180 ${animating ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}
        style={{ transition: "opacity 0.18s ease, transform 0.18s ease" }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          {logoError ? (
            <GooodboysWordmark />
          ) : (
            <img
              src={logoAsset.url}
              alt="Gooodboys"
              className="h-12 w-auto select-none"
              draggable={false}
              onError={() => setLogoError(true)}
            />
          )}
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
          <div className="px-8 pt-8 pb-7">

            {/* ── Step 1: Credentials ── */}
            {step === "credentials" && (
              <>
                <h1 className="font-display text-2xl font-semibold text-foreground mb-1 tracking-tight">
                  Welkom terug.
                </h1>
                <p className="text-sm text-muted-foreground mb-6">
                  Meld je aan bij je werkruimte.
                </p>
                <form onSubmit={handleCredentials} className="space-y-3">
                  <div className="space-y-2">
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="naam@gooodboys.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setErrorMsg(""); }}
                      className={`w-full h-11 px-4 rounded-xl border text-sm bg-background/60 placeholder:text-muted-foreground/60 outline-none transition-all duration-200
                        focus:bg-card focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]
                        ${emailError ? "border-red-400 bg-red-50/40" : "border-border focus:border-primary"}`}
                    />
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="Wachtwoord"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErrorMsg(""); }}
                      className="w-full h-11 px-4 rounded-xl border border-border text-sm bg-background/60 placeholder:text-muted-foreground/60 outline-none transition-all duration-200 focus:bg-card focus:border-primary focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.12)]"
                    />
                  </div>
                  {errorMsg && (
                    <p className="text-xs text-red-500 pl-1 animate-fade-in">{errorMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 mt-1 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 transition-all duration-150 shadow-sm"
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <>Inloggen <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
                <StepDots current={1} />
                <p className="text-[11px] text-muted-foreground/60 text-center mt-3">
                  Alleen @gooodboys.com · Stap 1 van 2
                </p>
              </>
            )}

            {/* ── Step 2a: MFA Setup ── */}
            {step === "mfa-setup" && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  <h1 className="font-display text-xl font-semibold text-foreground tracking-tight">
                    Beveiliging instellen
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Scan de QR-code met Google Authenticator, Authy of een andere TOTP-app.
                </p>
                {qrDataUrl && (
                  <div className="flex justify-center mb-4">
                    <div className="rounded-xl border border-border p-3 bg-card shadow-sm">
                      <img src={qrDataUrl} alt="TOTP QR code" className="rounded-lg w-44 h-44" />
                    </div>
                  </div>
                )}
                {totpSecret && (
                  <details className="mb-4 group">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground text-center list-none flex items-center justify-center gap-1">
                      <span className="border-b border-dashed border-muted-foreground/40">Handmatige sleutel</span>
                    </summary>
                    <code className="block text-[11px] bg-muted px-3 py-2 rounded-lg mt-2 tracking-widest break-all text-center font-mono text-muted-foreground">
                      {totpSecret}
                    </code>
                  </details>
                )}
                <p className="text-xs text-muted-foreground text-center mb-3">
                  Voer daarna de 6-cijferige code in om te bevestigen.
                </p>
                <form onSubmit={handleVerify} className="space-y-3">
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {errorMsg && (
                    <p className="text-xs text-red-500 text-center animate-fade-in">{errorMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 transition-all duration-150 shadow-sm"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Bevestigen & inloggen <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
                <StepDots current={2} />
                <p className="text-[11px] text-muted-foreground/60 text-center mt-3">Stap 2 van 2 · Eenmalige instelling</p>
              </>
            )}

            {/* ── Step 2b: MFA Verify ── */}
            {step === "mfa-verify" && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.75} />
                  <h1 className="font-display text-xl font-semibold text-foreground tracking-tight">
                    Verificatiecode
                  </h1>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Open je authenticator-app en voer de 6-cijferige code in.
                </p>
                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} autoFocus>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {errorMsg && (
                    <p className="text-xs text-red-500 text-center animate-fade-in">{errorMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 transition-all duration-150 shadow-sm"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Inloggen <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
                <StepDots current={2} />
                <p className="text-[11px] text-muted-foreground/60 text-center mt-3">Stap 2 van 2</p>
              </>
            )}

          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/50 text-center mt-5">
          Intern systeem · Gooodboys © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
