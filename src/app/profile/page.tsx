"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface UserProfile {
  fpsId: string;
  distCode: string;
  username: string;
  displayName: string;
  role: "dealer" | "admin";
  createdAt: string;
  active: boolean;
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changeMessage, setChangeMessage] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/profile");
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Failed to load profile");
        setProfile(data.profile);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load profile");
      }
    })();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeMessage("");

    if (newPassword.length < 6) {
      setChangeMessage("Error: New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangeMessage("Error: New password and confirmation don't match.");
      return;
    }

    setChanging(true);
    try {
      const res = await apiFetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to change password");
      setChangeMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setChangeMessage(`Error: ${err instanceof Error ? err.message : "Failed to change password"}`);
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold">👤 {t("profile.title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("profile.subtitle")}</p>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold mb-4">{t("profile.accountDetails")}</h3>
        {loadError && <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700">{loadError}</div>}
        {!profile && !loadError && <div className="text-sm text-gray-500">{t("common.loading")}</div>}
        {profile && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.fpsId")}</label>
              <div className="text-sm font-mono">{profile.fpsId}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.districtCode")}</label>
              <div className="text-sm font-mono">{profile.distCode}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.username")}</label>
              <div className="text-sm">{profile.username}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.displayName")}</label>
              <div className="text-sm">{profile.displayName}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.role")}</label>
              <div className="text-sm capitalize">{profile.role}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.accountCreated")}</label>
              <div className="text-sm">
                {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-IN") : "—"}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold mb-4">{t("profile.changePassword")}</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.currentPassword")}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.newPassword")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input-field"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">{t("profile.confirmNewPassword")}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input-field"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={changing}
            className="px-4 py-2 bg-brand-700 text-white rounded-lg text-sm font-semibold hover:bg-brand-800 disabled:opacity-50"
          >
            {changing ? t("profile.changing") : t("profile.changePassword")}
          </button>
          {changeMessage && (
            <div
              className={`text-xs px-3 py-2 rounded-lg ${
                changeMessage.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {changeMessage}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
