"use client";

import { useState, useMemo, useRef, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useStore } from "@/store/useStore";
import { Badge, KPICard, EmptyState } from "@/components/ui";
import { formatNumber, dateOnly, getMonthName } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import { useTranslation } from "@/lib/i18n/useTranslation";
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
  const { t } = useTranslation();
  const { customers: allCustomers, transactions, importCustomers, addCustomer, updateCustomer, deleteCustomer, viewingDealer } = useStore();
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
  const [cardFilter, setCardFilter] = useState<"all" | "active" | "disabled">("all");
  const [disableTarget, setDisableTarget] = useState<Customer | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const customers = useMemo(() => {
    if (cardFilter === "active") return allCustomers.filter((c) => !c.disabled);
    if (cardFilter === "disabled") return allCustomers.filter((c) => c.disabled);
    return allCustomers;
  }, [allCustomers, cardFilter]);
  const disabledCount = useMemo(() => allCustomers.filter((c) => c.disabled).length, [allCustomers]);
  const activeCount = allCustomers.length - disabledCount;
  const activeCollectedCount = useMemo(() => {
    const collected = new Set(transactions.filter((t) => t.wheat > 0).map((t) => t.srcNo));
    return allCustomers.filter((c) => !c.disabled && collected.has(c.srcNo)).length;
  }, [allCustomers, transactions]);

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
        totalSaree: txns.reduce((s, t) => s + t.saree, 0),
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

  const handleConfirmDisable = () => {
    if (!disableTarget || !disableReason.trim()) return;
    updateCustomer(disableTarget.srcNo, {
      disabled: true,
      disabledReason: disableReason.trim(),
      disabledAt: new Date().toISOString(),
    });
    setDisableTarget(null);
    setDisableReason("");
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold">👥 {t("customers.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("customers.subtitle")}
          </p>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(!showAdd)} className="btn-secondary text-xs">
              {showAdd ? t("common.cancel") : t("customers.addCustomer")}
            </button>
            <label className={`btn-primary text-xs cursor-pointer ${importing ? "opacity-50" : ""}`}>
              {importing ? t("customers.importing") : t("customers.importExcel")}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={handleImport} disabled={importing} />
            </label>
          </div>
        )}
      </div>

      {readOnly && (
        <div className="px-4 py-3 rounded-lg text-sm bg-amber-50 text-amber-800">
          {viewingDealer
            ? t("common.readOnlyBanner", { name: viewingDealer.displayName })
            : t("common.readOnlyCollective")}
        </div>
      )}

      {/* KPIs — click a card to filter the list below; Registered (all) is the default */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label={t("customers.registered")}
          value={allCustomers.length}
          color="blue" icon="👥"
          onClick={() => { setCardFilter("all"); setPage(0); }}
          active={cardFilter === "all"}
        />
        <KPICard
          label={t("customers.active")}
          value={activeCount}
          color="green" icon="✅"
          onClick={() => { setCardFilter("active"); setPage(0); }}
          active={cardFilter === "active"}
        />
        <KPICard
          label={t("customers.disabledCustomers")}
          value={disabledCount}
          color="red" icon="🚫"
          onClick={() => { setCardFilter("disabled"); setPage(0); }}
          active={cardFilter === "disabled"}
        />
        <KPICard
          label={t("customers.coverage")}
          value={activeCount > 0 ? `${((activeCollectedCount / activeCount) * 100).toFixed(1)}%` : "—"}
          sub={t("customers.coverageSub")}
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
          <h3 className="text-sm font-semibold mb-3">{t("customers.addNewCustomer")}</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 block mb-1">{t("customers.srcNoLabel")}</label>
              <input value={newSrc} onChange={(e) => setNewSrc(e.target.value)}
                placeholder="272004850xxx" className="input-field" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 block mb-1">{t("customers.customerNameLabel")}</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="CUSTOMER NAME" className="input-field" />
            </div>
            <button onClick={handleAddCustomer} className="btn-primary" disabled={!newSrc || !newName}>
              {t("common.add")}
            </button>
          </div>
        </div>
      )}

      {/* Customer table */}
      {customers.length === 0 ? (
        <EmptyState
          icon="👥"
          title={t("customers.noCustomersTitle")}
          description={t("customers.noCustomersDesc")}
        />
      ) : (
        <div>
          <div className="flex justify-between items-center mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                placeholder={t("customers.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="input-field w-72"
              />
              {cardFilter !== "all" && (
                <span className="flex items-center gap-1.5 text-xs text-gray-600">
                  {t("customers.filteredBy")}: <strong>{cardFilter === "active" ? t("customers.active") : t("customers.disabledCustomers")}</strong>
                  <button onClick={() => { setCardFilter("all"); setPage(0); }} className="text-brand-600 hover:underline">
                    {t("common.clearFilters")}
                  </button>
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">{formatNumber(filtered.length)} {t("customers.records")}</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-700 text-white text-xs font-semibold tracking-wide">
                  <th className="px-2 py-2.5 w-8"></th>
                  {showDealerColumn && <th className="px-3 py-2.5 text-left whitespace-nowrap">{t("customers.dealer")}</th>}
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">{t("customers.sNo")}</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">{t("customers.rationCardNo")}</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">{t("customers.scheme")}</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">{t("customers.status")}</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">{t("customers.areaType")}</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">{t("customers.familyHead")}</th>
                  <th className="px-3 py-2.5 text-left whitespace-nowrap">{t("customers.lastDispatched")}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">{t("customers.txns")}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">{t("customers.wheatKg")}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">{t("customers.riceKg")}</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">{t("customers.sareePkts")}</th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">{t("customers.action")}</th>
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
                        <td className="px-3 py-2 whitespace-nowrap">
                          {c.scheme ? <Badge text={c.scheme} /> : <span className="text-gray-400">{t("customers.otherScheme")}</span>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                          {c.disabled
                            ? <span title={c.disabledReason || ""}><Badge text={t("customers.disabled")} variant="error" /></span>
                            : (c.status || "—")}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">{c.areaType || "—"}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-800">{c.name}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">{c.lastDispatched}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{c.txnCount}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(c.totalWheat)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(c.totalRice)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{formatNumber(c.totalSaree)}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {!readOnly && (
                            <div className="flex items-center justify-center gap-2">
                              {c.disabled ? (
                                <button onClick={() => updateCustomer(c.srcNo, { disabled: false, disabledReason: undefined, disabledAt: undefined })}
                                  className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">
                                  {t("customers.enable")}
                                </button>
                              ) : (
                                <button onClick={() => { setDisableTarget(c); setDisableReason(""); }}
                                  className="text-amber-600 hover:text-amber-800 text-xs font-medium">
                                  {t("customers.disable")}
                                </button>
                              )}
                              <button onClick={() => {
                                if (confirm(`Delete ${c.name}?`)) deleteCustomer(c.srcNo);
                              }} className="text-red-500 hover:text-red-700 text-xs font-medium">
                                {t("common.delete")}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {isOpen && hasMembers && (
                        <tr key={`${c.srcNo}-members`} className="bg-gray-50">
                          <td colSpan={showDealerColumn ? 14 : 13} className="px-6 py-3">
                            <div className="text-xs font-semibold text-gray-500 mb-2">
                              {t("customers.familyMembers")} ({c.members!.length})
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
                    <td colSpan={showDealerColumn ? 14 : 13} className="px-4 py-12 text-center text-gray-400">
                      {t("customers.noRecordsFound")}
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

      {/* Disable customer — reason prompt */}
      {disableTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDisableTarget(null)}>
          <div className="card p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-1">{t("customers.disableCustomer")}</h3>
            <p className="text-xs text-gray-500 mb-3">
              {disableTarget.name} ({disableTarget.srcNo})
            </p>
            <label className="text-xs font-medium text-gray-500 block mb-1">{t("customers.disableReasonLabel")}</label>
            <textarea
              value={disableReason}
              onChange={(e) => setDisableReason(e.target.value)}
              placeholder={t("customers.disableReasonPlaceholder")}
              className="input-field w-full mb-4"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDisableTarget(null)} className="btn-secondary text-xs">
                {t("common.cancel")}
              </button>
              <button onClick={handleConfirmDisable} disabled={!disableReason.trim()}
                className="btn-primary text-xs disabled:opacity-40">
                {t("customers.disable")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
