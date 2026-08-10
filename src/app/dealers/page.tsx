"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/apiFetch";
import { useStore } from "@/store/useStore";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface DealerProfile {
  fpsId: string;
  distCode: string;
  username: string;
  displayName: string;
  role: "dealer" | "admin";
  createdAt: string;
  active: boolean;
}

export default function DealersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();
  const setViewingDealer = useStore((s) => s.setViewingDealer);

  const [dealers, setDealers] = useState<DealerProfile[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ fpsId: "", distCode: "", username: "", password: "", displayName: "" });
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

  const [editingFpsId, setEditingFpsId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ distCode: "", username: "", displayName: "", role: "dealer" as "dealer" | "admin", active: true });
  const [saving, setSaving] = useState(false);
  const [rowMessage, setRowMessage] = useState<{ fpsId: string; text: string } | null>(null);
  const [deletingFpsId, setDeletingFpsId] = useState<string | null>(null);

  const isAdmin = session?.role === "admin";

  const loadDealers = async () => {
    setLoadError("");
    try {
      const res = await apiFetch("/api/admin/dealers");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load dealers");
      setDealers(data.users);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load dealers");
    }
  };

  useEffect(() => {
    if (isAdmin) loadDealers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMessage("");
    setCreating(true);
    try {
      const res = await apiFetch("/api/admin/dealers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to create dealer");
      setCreateMessage(`Dealer "${form.username}" created.`);
      setForm({ fpsId: "", distCode: "", username: "", password: "", displayName: "" });
      setShowAdd(false);
      loadDealers();
    } catch (err) {
      setCreateMessage(`Error: ${err instanceof Error ? err.message : "Failed to create dealer"}`);
    } finally {
      setCreating(false);
    }
  };

  const handleView = (dealer: DealerProfile) => {
    setViewingDealer({ fpsId: dealer.fpsId, distCode: dealer.distCode, displayName: dealer.displayName });
    router.push("/dashboard");
  };

  const startEdit = (dealer: DealerProfile) => {
    setEditingFpsId(dealer.fpsId);
    setEditForm({
      distCode: dealer.distCode,
      username: dealer.username,
      displayName: dealer.displayName,
      role: dealer.role,
      active: dealer.active,
    });
    setRowMessage(null);
  };

  const handleSaveEdit = async (fpsId: string) => {
    setSaving(true);
    setRowMessage(null);
    try {
      const res = await apiFetch(`/api/admin/dealers/${encodeURIComponent(fpsId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save changes");
      setEditingFpsId(null);
      loadDealers();
    } catch (err) {
      setRowMessage({ fpsId, text: `Error: ${err instanceof Error ? err.message : "Failed to save changes"}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dealer: DealerProfile) => {
    if (!confirm(`Delete ${dealer.displayName} (${dealer.fpsId})? This also permanently deletes all their customers and transactions. This cannot be undone.`)) {
      return;
    }
    setDeletingFpsId(dealer.fpsId);
    setRowMessage(null);
    try {
      const res = await apiFetch(`/api/admin/dealers/${encodeURIComponent(dealer.fpsId)}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to delete");
      loadDealers();
    } catch (err) {
      setRowMessage({ fpsId: dealer.fpsId, text: `Error: ${err instanceof Error ? err.message : "Failed to delete"}` });
    } finally {
      setDeletingFpsId(null);
    }
  };

  if (status === "loading") return null;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="card p-6 max-w-md text-sm text-gray-600">
          {t("dealers.adminOnly")}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">🏪 {t("dealers.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("dealers.subtitle")}
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs">
          {showAdd ? t("common.cancel") : t("dealers.addDealer")}
        </button>
      </div>

      {showAdd && (
        <div className="card p-6">
          <h3 className="text-base font-semibold mb-4">{t("dealers.addNewDealer")}</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("dealers.fpsId")}</label>
              <input
                required
                value={form.fpsId}
                onChange={(e) => setForm((f) => ({ ...f, fpsId: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("dealers.districtCode")}</label>
              <input
                required
                value={form.distCode}
                onChange={(e) => setForm((f) => ({ ...f, distCode: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("dealers.username")}</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("dealers.displayName")}</label>
              <input
                required
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="input-field"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 block mb-1">{t("dealers.password")}</label>
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="input-field"
              />
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-brand-700 text-white rounded-lg text-sm font-semibold hover:bg-brand-800 disabled:opacity-50"
              >
                {creating ? t("dealers.creating") : t("dealers.createDealer")}
              </button>
            </div>
          </form>
          {createMessage && (
            <div
              className={`mt-4 text-xs px-3 py-2 rounded-lg ${
                createMessage.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {createMessage}
            </div>
          )}
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-4">{t("dealers.allAccounts")}</h3>
        {loadError && <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700 mb-3">{loadError}</div>}
        {!dealers && !loadError && <div className="text-sm text-gray-500">{t("common.loading")}</div>}
        {dealers && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-700 text-white text-xs font-semibold tracking-wide">
                  <th className="px-3 py-2.5 text-left">{t("dealers.fpsId")}</th>
                  <th className="px-3 py-2.5 text-left">District</th>
                  <th className="px-3 py-2.5 text-left">{t("dealers.username")}</th>
                  <th className="px-3 py-2.5 text-left">{t("dealers.displayName")}</th>
                  <th className="px-3 py-2.5 text-left">Role</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((d, i) => {
                  const isSelf = d.fpsId === session?.fpsId;
                  const isEditing = editingFpsId === d.fpsId;
                  return (
                    <Fragment key={d.fpsId}>
                      <tr className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-3 py-2 font-mono text-xs">{d.fpsId}</td>
                        {isEditing ? (
                          <>
                            <td className="px-3 py-2">
                              <input className="input-field text-xs" value={editForm.distCode}
                                onChange={(e) => setEditForm((f) => ({ ...f, distCode: e.target.value }))} />
                            </td>
                            <td className="px-3 py-2">
                              <input className="input-field text-xs" value={editForm.username}
                                onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))} />
                            </td>
                            <td className="px-3 py-2">
                              <input className="input-field text-xs" value={editForm.displayName}
                                onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))} />
                            </td>
                            <td className="px-3 py-2">
                              <select className="input-field text-xs" value={editForm.role}
                                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as "dealer" | "admin" }))}>
                                <option value="dealer">dealer</option>
                                <option value="admin">admin</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <label className="flex items-center gap-1.5 text-xs">
                                <input type="checkbox" checked={editForm.active}
                                  onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))} />
                                {t("common.active")}
                              </label>
                            </td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              <button onClick={() => handleSaveEdit(d.fpsId)} disabled={saving}
                                className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-semibold hover:bg-emerald-100 disabled:opacity-50 mr-1">
                                {saving ? t("dealers.saving") : t("common.save")}
                              </button>
                              <button onClick={() => setEditingFpsId(null)}
                                className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold hover:bg-gray-200">
                                {t("common.cancel")}
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 font-mono text-xs">{d.distCode}</td>
                            <td className="px-3 py-2">{d.username}</td>
                            <td className="px-3 py-2">{d.displayName}</td>
                            <td className="px-3 py-2 capitalize">{d.role}</td>
                            <td className="px-3 py-2">
                              {d.active ? (
                                <span className="text-emerald-600 text-xs font-medium">{t("common.active")}</span>
                              ) : (
                                <span className="text-gray-400 text-xs font-medium">{t("common.inactive")}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              {d.role === "dealer" && (
                                <button
                                  onClick={() => handleView(d)}
                                  className="px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-semibold hover:bg-blue-100 mr-1"
                                >
                                  {t("dealers.viewData")}
                                </button>
                              )}
                              {!isSelf && (
                                <>
                                  <button
                                    onClick={() => startEdit(d)}
                                    className="px-2 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-semibold hover:bg-gray-200 mr-1"
                                  >
                                    {t("common.edit")}
                                  </button>
                                  <button
                                    onClick={() => handleDelete(d)}
                                    disabled={deletingFpsId === d.fpsId}
                                    className="px-2 py-1 bg-red-50 text-red-600 rounded-md text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
                                  >
                                    {deletingFpsId === d.fpsId ? t("dealers.deleting") : t("common.delete")}
                                  </button>
                                </>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                      {rowMessage?.fpsId === d.fpsId && (
                        <tr>
                          <td colSpan={7} className="px-3 py-2 bg-red-50 text-red-700 text-xs">
                            {rowMessage.text}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
