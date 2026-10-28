"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoadingStore } from "@/store/useLoadingStore";
import { useStore } from "@/store/useStore";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { LANGUAGES } from "@/lib/i18n/translations";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const { t, language, setLanguage } = useTranslation();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    useLoadingStore.getState().start();

    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
    });

    useLoadingStore.getState().stop();
    setLoading(false);

    if (!result || result.error) {
      setError(t("login.invalidCredentials"));
      return;
    }

    // Every login starts from a clean slate — any data cached in this
    // browser from a previous session (possibly stale, e.g. another device
    // synced new records since) is wiped so the destination page always
    // re-reads fresh data from the DB instead of showing leftovers.
    useStore.getState().resetSessionCache();

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-apple-bg px-4">
      <div className="w-full max-w-sm space-y-3">
        <div className="mx-auto flex w-fit gap-0.5 p-0.5 rounded-lg bg-apple-fill">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                language === lang.code
                  ? "bg-white text-apple-label shadow-sm"
                  : "text-apple-secondary hover:text-apple-label"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full bg-white rounded-3xl shadow-apple-lg p-8 space-y-5"
        >
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-apple-label">{t("login.title")}</h1>
            <p className="text-sm text-apple-secondary">{t("login.subtitle")}</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[13px] font-medium text-apple-secondary mb-1">
              {t("login.loginId")}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              className="input-field py-2.5"
              placeholder="FPS ID"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-apple-secondary mb-1">
              {t("login.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field py-2.5"
              placeholder={t("login.password")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5"
          >
            {loading ? t("login.signingIn") : t("login.signIn")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
