"use client";

import { useState, useMemo, useRef, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { Badge, KPICard, EmptyState } from "@/components/ui";
import { formatNumber, dateOnly, getMonthName } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import type { Customer } from "@/types";

const PAGE_SIZE = 25;

type CustomerWithDealer = Customer & { dealerName?: string };

/** The most recent transaction month for this customer, e.g. "July 2026" — or "—" if none. */
function lastDispatchedMonth(txns: { date: string }[]): string {
  if (txns.length === 0) return "—";
  const latest = txns.reduce((max, t) => (dateOnly(t.date) > dateOnly(max.date) ? t : max));
  const [year, month] = dateOnly(latest.date).split("-");
  return `${getMonthName(parseInt(month, 10))} ${year}`;
}

export default function CustomersPage() {
  const { data: session } = useSession();
  const { customers, transactions, importCustomers, addCustomer, deleteCustomer, viewingDealer } = useStore();
  const isAdmin = session?.role === "admin";
  const readOnly = isAdmin;
  const showDealerColumn = isAdmin && !viewingDealer;
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newSrc, setNewSrc] = useState("");
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const customerStats = useMemo(() => {
    return customers.map((c) => {
      const txns = transactions.filter((t) => t.srcNo === c.srcNo);
      const collected = txns.some((t) => t.wheat > 0);
      return {
        ...c,
        collectionStatus: collected ? "Collected" : "Pending",
        txnCount: txns.length,
        totalWheat: txns.reduce((s, t) => s + t.wheat, 0),
        totalRice: txns.reduce((s, t) => s + t.rice, 0),
        lastDispatched: lastDispatchedMonth(txns),
      };
    });
  }, [customers, transactions]);

  const collectedCount = customerStats.filter((c) => c.collectionStatus === "Collected").length;

  const filtered = useMemo(() => {
    if (!search) return customerStats;
    const q = search.toLowerCase();
    return customerStats.filter(
      (c) => c.srcNo.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [customerStats, search]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const toggleExpanded = (srcNo: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(srcNo)) next.delete(srcNo);
      else next.add(srcNo);
      return next;
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await apiFetch("/api/import-customers", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        importCustomers(data.customers);
        setImportResult(`Imported ${data.count} customers from "${data.sheetName}"`);
      } else {
        setImportResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setImportResult(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleAddCustomer = () => {
    if (readOnly || !newSrc || !newName) return;
    addCustomer({ srcNo: newSrc.trim(), name: newName.trim() });
    setNewSrc("");
    setNewName("");
    setShowAdd(false);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold">👥 Customer Master</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage Ration Card / SRC No → Customer mapping — import KGS_Master or the
            FPS Beneficiary Detail Drill-Down file to enrich records
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(!showAdd)} className="btn-secondary text-xs">
              {showAdd ? "Cancel" : "+ Add Customer"}
            </button>
            <label className={`btn-primary text-xs cursor-pointer ${importing ? "opacity-50" : ""}`}>
              {importing ? "Importing..." : "Import Excel"}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={handleImport} disabled={importing} />
            </label>
          </div>
        )}
      </div>

      {readOnly && (
        <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-800">
          {viewingDealer
            ? <>You&apos;re viewing {viewingDealer.displayName}&apos;s data as admin — read only.</>
            : "Collective view across all dealers — read only."}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Registered" value={customers.length} color="blue" icon="👥" />
        <KPICard label="Collected" value={collectedCount} color="green" icon="✅" />
        <KPICard label="Pending" value={customers.length - collectedCount} color="red" icon="⚠️" />
        <KPICard
          label="Coverage"
          value={customers.length > 0 ? `${((collectedCount / customers.length) * 100).toFixed(1)}%` : "—"}
          color="purple" icon="📈"
        />
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          importResult.startsWith("Error") || importResult.startsWith("Import failed")
            ? "bg-red-50 text-red-700"
            : "bg-emerald-50 text-emerald-700"
        }`}>
          {importResult}
        </div>
      )}

      {/* Add customer form */}
      {showAdd && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Add New Customer</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 block mb-1">SRC No</label>
              <input value={newSrc} onChange={(e) => setNewSrc(e.target.value)}
                placeholder="272004850xxx" className="input-field" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 block mb-1">Customer Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="CUSTOMER NAME" className="input-field" />
            </div>
            <button onClick={handleAddCustomer} className="btn-primary" disabled={!newSrc || !newName}>
              Add
            </button>
          </div>
        </div>
      )}

      {/* Customer table */}
      {customers.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No customers registered"
          description="Import your KGS_Master Excel file or add customers manually."
        />
      ) : (
        <div>
          <div className="flex justify-between items-center mb-3">
            <input
              placeholder="Search by Ration Card No. or name..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="input-field w-72"
            />
            <span className="text-xs text-gray-500">{formatNumber(filtered.length)} records</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-700 text-white text-xs font-semibold tracking-wide">
                  <th className="px-2 py-2.5 w-8"></th>
                  {showDealerColumn && <th className="px-3 py-2.5 text-left whitespace-nowrap">Dealer</th>}
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">S.No.</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">Ration Card No.</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">Status</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">Area Type</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">Family Head</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">Last Dispatched</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Txns</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Wheat (Kg)</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">Rice (Kg)</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c, i) => {
                  const dealer = c as CustomerWithDealer;
                  const isOpen = expanded.has(c.srcNo);
                  const hasMembers = (c.members?.length || 0) > 0;
                  return (
                    <Fragment key={`${dealer.dealerName || ""}-${c.srcNo}`}>
                      <tr
                        className={`border-b border-gray-100 hover:bg-blue-50/50 transition-colors ${
                          i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        } ${hasMembers ? "cursor-pointer" : ""}`}
                        onClick={() => hasMembers && toggleExpanded(c.srcNo)}
                      >
                        <td className="px-2 py-2 text-center">
                          {hasMembers && (
                            <span className={`inline-block transition-transform text-gray-400 ${isOpen ? "rotate-90" : ""}`}>
                              ▶
                            </span>
                          )}
                        </td>
                        {showDealerColumn && (
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{dealer.dealerName || "—"}</td>
                        )}
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{c.sNo ?? "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{c.srcNo}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">{c.status || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">{c.areaType || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-800">{c.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">{c.lastDispatched}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{c.txnCount}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(c.totalWheat)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(c.totalRice)}</td>
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {!readOnly && (
                            <button onClick={() => {
                              if (confirm(`Delete ${c.name}?`)) deleteCustomer(c.srcNo);
                            }} className="text-red-500 hover:text-red-700 text-xs font-medium">
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && hasMembers && (
                        <tr key={`${c.srcNo}-members`} className="bg-gray-50">
                          <td colSpan={showDealerColumn ? 12 : 11} className="px-6 py-3">
                            <div className="text-xs font-semibold text-gray-500 mb-2">
                              Family Members ({c.members!.length})
                            </div>
                            <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                              <table className="w-full border-collapse text-xs">
                                <thead>
                                  <tr className="bg-gray-100 text-gray-600">
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">M.S. No.</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Member Name (in Eng)</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Member (in LL)</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">HoFN</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Member ID</th>
                                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Member&apos;s Age*</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">UID No.</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Mobile No.</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Relation with HoF</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Mother Name</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Father Name</th>
                                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Gender</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {c.members!.map((m, mi) => (
                                    <tr key={mi} className={mi % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                                      <td className="px-2 py-1.5 font-mono">{m.msNo}</td>
                                      <td className="px-2 py-1.5">{m.nameEng}</td>
                                      <td className="px-2 py-1.5">{m.nameLL || "—"}</td>
                                      <td className="px-2 py-1.5">{m.hofn || "—"}</td>
                                      <td className="px-2 py-1.5 font-mono">{m.memberId || "—"}</td>
                                      <td className="px-2 py-1.5 text-right font-mono">{m.age || "—"}</td>
                                      <td className="px-2 py-1.5 font-mono">{m.uid || "—"}</td>
                                      <td className="px-2 py-1.5 font-mono">{m.mobile || "—"}</td>
                                      <td className="px-2 py-1.5">
                                        {m.relation ? <Badge text={m.relation} /> : "—"}
                                      </td>
                                      <td className="px-2 py-1.5">{m.motherName || "—"}</td>
                                      <td className="px-2 py-1.5">{m.fatherName || "—"}</td>
                                      <td className="px-2 py-1.5">{m.gender || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={showDealerColumn ? 12 : 11} className="px-4 py-12 text-center text-gray-400">
                      No records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 mt-3">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="btn-secondary text-xs disabled:opacity-40">
                ← Prev
              </button>
              <span className="text-xs text-gray-500">Page {page + 1} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="btn-secondary text-xs disabled:opacity-40">
                Next →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
