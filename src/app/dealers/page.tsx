"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/apiFetch";
import { useStore } from "@/store/useStore";

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
  const setViewingDealer = useStore((s) => s.setViewingDealer);

  const [dealers, setDealers] = useState<DealerProfile[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ fpsId: "", distCode: "", username: "", password: "", displayName: "" });
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");

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

  if (status === "loading") return null;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="card p-6 max-w-md text-sm text-gray-600">
          Dealer management is only available to admin accounts.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">🏪 Dealers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every ration dealer (FPS) account. Click &quot;View Data&quot; to browse a dealer&apos;s data read-only.
          </p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-xs">
          {showAdd ? "Cancel" : "+ Add Dealer"}
        </button>
      </div>

      {showAdd && (
        <div className="card p-6">
          <h3 className="text-base font-semibold mb-4">Add New Dealer</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">FPS ID</label>
              <input
                required
                value={form.fpsId}
                onChange={(e) => setForm((f) => ({ ...f, fpsId: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">District Code</label>
              <input
                required
                value={form.distCode}
                onChange={(e) => setForm((f) => ({ ...f, distCode: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Username</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Display Name</label>
              <input
                required
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                className="input-field"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 block mb-1">Password</label>
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
                {creating ? "Creating…" : "Create Dealer"}
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
        <h3 className="text-sm font-semibold mb-4">All Accounts</h3>
        {loadError && <div className="text-xs px-3 py-2 rounded-lg bg-red-50 text-red-700 mb-3">{loadError}</div>}
        {!dealers && !loadError && <div className="text-sm text-gray-500">Loading…</div>}
        {dealers && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-700 text-white text-xs font-semibold tracking-wide">
                  <th className="px-3 py-2.5 text-left">FPS ID</th>
                  <th className="px-3 py-2.5 text-left">District</th>
                  <th className="px-3 py-2.5 text-left">Username</th>
                  <th className="px-3 py-2.5 text-left">Display Name</th>
                  <th className="px-3 py-2.5 text-left">Role</th>
                  <th className="px-3 py-2.5 text-left">Status</th>
                  <th className="px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((d, i) => (
                  <tr key={d.fpsId} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="px-3 py-2 font-mono text-xs">{d.fpsId}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.distCode}</td>
                    <td className="px-3 py-2">{d.username}</td>
                    <td className="px-3 py-2">{d.displayName}</td>
                    <td className="px-3 py-2 capitalize">{d.role}</td>
                    <td className="px-3 py-2">
                      {d.active ? (
                        <span className="text-emerald-600 text-xs font-medium">Active</span>
                      ) : (
                        <span className="text-gray-400 text-xs font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {d.role === "dealer" && (
                        <button
                          onClick={() => handleView(d)}
                          className="px-3 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-semibold hover:bg-blue-100"
                        >
                          View Data
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
