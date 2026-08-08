"use client";

import { useState, useMemo, useRef } from "react";
import { useStore } from "@/store/useStore";
import { DataTable, Badge, KPICard, EmptyState } from "@/components/ui";
import { formatNumber } from "@/lib/utils";
import { apiFetch } from "@/lib/apiFetch";
import type { Customer } from "@/types";

export default function CustomersPage() {
  const { customers, transactions, importCustomers, addCustomer, deleteCustomer } = useStore();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newSrc, setNewSrc] = useState("");
  const [newName, setNewName] = useState("");
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
      };
    });
  }, [customers, transactions]);

  const collectedCount = customerStats.filter((c) => c.collectionStatus === "Collected").length;

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!newSrc || !newName) return;
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
      </div>

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
        <DataTable<Customer & { collectionStatus: string; txnCount: number; totalWheat: number; totalRice: number }>
          columns={[
            { key: "srcNo", label: "Ration Card / SRC No", mono: true },
            { key: "name", label: "Customer Name" },
            { key: "scheme", label: "Scheme",
              render: (v) => (v ? <Badge text={String(v)} /> : <span className="text-gray-300">—</span>) },
            { key: "areaType", label: "Area",
              render: (v) => <span className="text-gray-500">{String(v) || "—"}</span> },
            { key: "memberCount", label: "Members", align: "right", mono: true,
              render: (v) => <span>{v ? String(v) : "—"}</span> },
            { key: "status", label: "Verification",
              render: (v) => <span className="text-xs text-gray-500">{String(v) || "—"}</span> },
            { key: "collectionStatus", label: "This Month",
              render: (v) => <Badge text={String(v)} /> },
            { key: "lastDispatched", label: "Last Dispatched",
              render: (v) => <span className="text-gray-500">{String(v) || "—"}</span> },
            { key: "txnCount", label: "Txns", align: "right", mono: true },
            { key: "totalWheat", label: "Wheat (Kg)", align: "right", mono: true,
              render: (v) => <span>{formatNumber(Number(v))}</span> },
            { key: "totalRice", label: "Rice (Kg)", align: "right", mono: true,
              render: (v) => <span>{formatNumber(Number(v))}</span> },
            { key: "srcNo" as const, label: "Action", align: "center",
              sortable: false,
              render: (_, row) => (
                <button onClick={() => {
                  if (confirm(`Delete ${row.name}?`)) deleteCustomer(row.srcNo);
                }} className="text-red-500 hover:text-red-700 text-xs font-medium">
                  Delete
                </button>
              ),
            },
          ]}
          data={customerStats}
          maxHeight={550}
        />
      )}
    </div>
  );
}
