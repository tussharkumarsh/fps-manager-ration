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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm space-y-3">
        <div className="flex justify-center gap-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                language === lang.code
                  ? "bg-brand-700 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full bg-white rounded-lg shadow-md p-8 space-y-5"
        >
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-brand-700">{t("login.title")}</h1>
            <p className="text-sm text-slate-500">{t("login.subtitle")}</p>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("login.loginId")}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="FPS ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("login.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder={t("login.password")}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-700 hover:bg-brand-800 text-white text-sm font-medium py-2 rounded-md transition-colors disabled:opacity-60"
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
