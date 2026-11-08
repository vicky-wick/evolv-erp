import { useMemo, useState } from "react";
import {
  Laptop,
  Package,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Wrench,
} from "lucide-react";
import { useStore } from "../data/store";
import {
  Avatar,
  Badge,
  Empty,
  Field,
  Modal,
  PageHeader,
  Stat,
  StatusBadge,
  Tabs,
} from "../components/ui";
import type { Asset } from "../types";
import { currency, fmtDate, fmtDateTime, todayISO, addDays } from "../lib/format";

const CATEGORIES = [
  "Laptop",
  "Monitor",
  "Mobile",
  "Tablet",
  "Camera",
  "Printer",
  "Accessory",
  "Furniture",
  "Other",
];

const CONDITIONS: Asset["condition"][] = ["new", "good", "fair", "damaged"];

export default function Assets() {
  const { db, user, actions } = useStore();
  const [tab, setTab] = useState("inventory");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [maintenanceFor, setMaintenanceFor] = useState<string | null>(null);
  const [maintenanceNote, setMaintenanceNote] = useState("");

  const [form, setForm] = useState({
    name: "",
    category: "Laptop",
    serial: "",
    purchaseDate: todayISO(),
    purchasePrice: 0,
    warrantyUntil: addDays(todayISO(), 365),
    condition: "new" as Asset["condition"],
  });

  if (!user) return null;

  const canManage = ["admin", "hr"].includes(user.role);
  const selected = db.assets.find((a) => a.id === selectedId) ?? null;
  const today = todayISO();

  const assets = useMemo(
    () =>
      db.assets.filter((a) => {
        if (statusFilter !== "all" && a.status !== statusFilter) return false;
        if (catFilter !== "all" && a.category !== catFilter) return false;
        if (search && !`${a.name} ${a.code} ${a.serial} ${a.category}`.toLowerCase().includes(search.toLowerCase()))
          return false;
        return true;
      }),
    [db.assets, statusFilter, catFilter, search]
  );

  const assigned = db.assets.filter((a) => a.status === "assigned");
  const available = db.assets.filter((a) => a.status === "available");
  const inMaintenance = db.assets.filter((a) => a.status === "maintenance");
  const totalValue = db.assets.filter((a) => a.status !== "disposed").reduce((s, a) => s + a.purchasePrice, 0);
  const expiringWarranty = db.assets.filter(
    (a) => a.status !== "disposed" && a.warrantyUntil >= today && a.warrantyUntil <= addDays(today, 45)
  );

  const myAssets = db.assets.filter((a) => a.assigneeId === user.id);

  const empName = (id?: string) => db.employees.find((e) => e.id === id)?.name ?? "—";

  const addAsset = () => {
    if (!form.name.trim() || !form.serial.trim()) return;
    actions.addAsset(form);
    setShowAdd(false);
    setForm({
      name: "",
      category: "Laptop",
      serial: "",
      purchaseDate: todayISO(),
      purchasePrice: 0,
      warrantyUntil: addDays(todayISO(), 365),
      condition: "new",
    });
  };

  const renderTable = (rows: Asset[]) => (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Category</th>
            <th>Serial</th>
            <th>Assigned to</th>
            <th>Purchased</th>
            <th>Value</th>
            <th>Warranty</th>
            <th>Condition</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const warrantySoon = a.warrantyUntil >= today && a.warrantyUntil <= addDays(today, 45);
            return (
              <tr key={a.id} className="clickable" onClick={() => setSelectedId(a.id)}>
                <td>
                  <div className="cell-user">
                    <span className="asset-icon"><Laptop size={15} /></span>
                    <span>
                      <strong>{a.name}</strong>
                      <small>{a.code}</small>
                    </span>
                  </div>
                </td>
                <td>{a.category}</td>
                <td className="cell-muted">{a.serial}</td>
                <td>
                  {a.assigneeId ? (
                    <div className="cell-user">
                      <Avatar name={empName(a.assigneeId)} size={22} />
                      <span><strong>{empName(a.assigneeId)}</strong></span>
                    </div>
                  ) : (
                    <span className="cell-muted">Unassigned</span>
                  )}
                </td>
                <td>{fmtDate(a.purchaseDate)}</td>
                <td>{currency(a.purchasePrice)}</td>
                <td>
                  <span className={warrantySoon ? "overdue" : ""}>{fmtDate(a.warrantyUntil)}</span>
                  {warrantySoon && <Badge tone="amber">soon</Badge>}
                </td>
                <td className="capitalize">{a.condition}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="cell-cta">Open →</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <Empty title="No assets match" text="Adjust filters or add a new asset." icon={<Package size={20} />} />
      )}
    </div>
  );

  return (
    <div className="page">
      <PageHeader
        title="Resource & Assets"
        subtitle="Every device tracked from purchase to disposal — with a full assignment trail."
        actions={
          canManage && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add asset
            </button>
          )
        }
      />

      <div className="stat-grid">
        <Stat label="Total assets" value={db.assets.length} sub={`${currency(totalValue)} book value`} icon={<Package size={15} />} />
        <Stat label="Assigned" value={assigned.length} sub={`${myAssets.length} with you`} icon={<UserCheck size={15} />} />
        <Stat label="Available" value={available.length} sub="Ready to assign" icon={<Laptop size={15} />} />
        <Stat label="Maintenance" value={inMaintenance.length} sub={`${expiringWarranty.length} warranties expiring`} icon={<Wrench size={15} />} />
      </div>

      {expiringWarranty.length > 0 && (
        <div className="notice notice-amber">
          <ShieldCheck size={15} />
          <span>
            {expiringWarranty.length} asset{expiringWarranty.length > 1 ? "s" : ""} with warranty expiring within 45 days:{" "}
            {expiringWarranty.map((a) => a.name).join(", ")}.
          </span>
        </div>
      )}

      <Tabs
        tabs={[
          { id: "inventory", label: "Inventory", count: db.assets.length },
          { id: "mine", label: "My assets", count: myAssets.length },
          { id: "maintenance", label: "Maintenance", count: inMaintenance.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "inventory" && (
        <section className="panel">
          <div className="toolbar">
            <div className="search">
              <Search size={14} />
              <input placeholder="Search asset, serial or code…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="select select-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Any status</option>
              {["available", "assigned", "maintenance", "disposed"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select className="select select-sm" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="toolbar-count">{assets.length} shown</span>
          </div>
          {renderTable(assets)}
        </section>
      )}

      {tab === "mine" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Assets in your custody</h2>
            <span className="panel-hint">Return via HR when no longer needed</span>
          </div>
          {myAssets.length === 0 ? (
            <Empty title="No assets assigned" text="Laptops, monitors and field devices assigned to you appear here." icon={<Laptop size={20} />} />
          ) : (
            <div className="asset-cards">
              {myAssets.map((a) => (
                <div className="asset-card" key={a.id}>
                  <span className="asset-card-icon"><Laptop size={18} /></span>
                  <div>
                    <strong>{a.name}</strong>
                    <small>{a.code} · {a.serial}</small>
                    <StatusBadge status={a.condition} />
                  </div>
                  <div className="asset-card-meta">
                    <span>Assigned {a.assignedAt ? fmtDate(a.assignedAt.slice(0, 10)) : "—"}</span>
                    <span>Warranty {fmtDate(a.warrantyUntil)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "maintenance" && (
        <section className="panel">
          <div className="panel-head">
            <h2>Maintenance queue</h2>
            <span className="panel-hint">Assets in service or repair</span>
          </div>
          {inMaintenance.length === 0 ? (
            <Empty title="Nothing in maintenance" text="Send an asset for repair from its detail view." icon={<Wrench size={20} />} />
          ) : (
            <div className="list">
              {inMaintenance.map((a) => (
                <div className="list-row" key={a.id}>
                  <div>
                    <strong>{a.name}</strong>
                    <small>{a.code} · {a.serial} · last event {a.history[a.history.length - 1]?.action}</small>
                  </div>
                  {canManage && (
                    <button className="btn btn-primary btn-xs" onClick={() => actions.finishMaintenance(a.id)}>
                      Mark repaired
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------- Asset detail ---------- */}
      <Modal
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? ""}
        subtitle={selected ? `${selected.code} · ${selected.category} · ${selected.serial}` : ""}
        size="lg"
        footer={
          selected && (
            <>
              <span className="modal-foot-hint">History is append-only for audit.</span>
              {canManage && selected.status !== "disposed" && (
                <>
                  {selected.status === "assigned" ? (
                    <button className="btn btn-ghost btn-sm" onClick={() => actions.returnAsset(selected.id)}>
                      Return to inventory
                    </button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setAssignFor(selected.id); setAssignTo(""); }}>
                      Assign
                    </button>
                  )}
                  {selected.status !== "maintenance" && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setMaintenanceFor(selected.id); setMaintenanceNote(""); }}>
                      <Wrench size={13} /> Maintenance
                    </button>
                  )}
                  <button
                    className="btn btn-ghost btn-sm link-danger"
                    onClick={() => {
                      if (window.confirm(`Dispose ${selected.name}? This removes it from circulation.`)) {
                        actions.disposeAsset(selected.id);
                        setSelectedId(null);
                      }
                    }}
                  >
                    Dispose
                  </button>
                </>
              )}
            </>
          )
        }
      >
        {selected && (
          <>
            <div className="kv-grid">
              <div className="kv"><span>Status</span><strong><StatusBadge status={selected.status} /></strong></div>
              <div className="kv"><span>Condition</span><strong className="capitalize">{selected.condition}</strong></div>
              <div className="kv"><span>Assigned to</span><strong>{selected.assigneeId ? empName(selected.assigneeId) : "—"}</strong></div>
              <div className="kv"><span>Assigned on</span><strong>{selected.assignedAt ? fmtDateTime(selected.assignedAt) : "—"}</strong></div>
              <div className="kv"><span>Purchase date</span><strong>{fmtDate(selected.purchaseDate)}</strong></div>
              <div className="kv"><span>Purchase price</span><strong>{currency(selected.purchasePrice)}</strong></div>
              <div className="kv"><span>Warranty until</span><strong>{fmtDate(selected.warrantyUntil)}</strong></div>
              <div className="kv"><span>Serial</span><strong>{selected.serial}</strong></div>
            </div>

            <h4 className="panel-sub">Assignment & service history</h4>
            <div className="timeline">
              {[...selected.history].reverse().map((h, i) => (
                <div className="timeline-row" key={i}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{h.action}</strong>
                    <small>{empName(h.by)} · {fmtDateTime(h.at)}{h.note ? ` · ${h.note}` : ""}</small>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* ---------- Add asset ---------- */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add asset"
        subtitle="Adds the device to inventory as available."
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={addAsset}>Add to inventory</button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Asset name" className="span-2">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='e.g. MacBook Pro 14" M4' />
          </Field>
          <Field label="Category">
            <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Serial number">
            <input className="input" value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} />
          </Field>
          <Field label="Purchase date">
            <input className="input" type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          </Field>
          <Field label="Purchase price (₹)">
            <input className="input" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
          </Field>
          <Field label="Warranty until">
            <input className="input" type="date" value={form.warrantyUntil} onChange={(e) => setForm({ ...form, warrantyUntil: e.target.value })} />
          </Field>
          <Field label="Condition">
            <select className="select" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as Asset["condition"] })}>
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      </Modal>

      {/* ---------- Assign ---------- */}
      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title="Assign asset"
        subtitle="The asset moves to the employee's custody and is logged in the history."
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setAssignFor(null)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!assignFor || !assignTo) return;
                actions.assignAsset(assignFor, assignTo);
                setAssignFor(null);
              }}
            >
              Assign
            </button>
          </>
        }
      >
        <Field label="Employee">
          <select className="select" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Select employee…</option>
            {db.employees.filter((e) => e.status !== "exited").map((e) => (
              <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>
            ))}
          </select>
        </Field>
      </Modal>

      {/* ---------- Maintenance ---------- */}
      <Modal
        open={!!maintenanceFor}
        onClose={() => setMaintenanceFor(null)}
        title="Send for maintenance"
        subtitle="The asset becomes unavailable until it is marked repaired."
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setMaintenanceFor(null)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!maintenanceFor) return;
                actions.sendAssetToMaintenance(maintenanceFor, maintenanceNote);
                setMaintenanceFor(null);
              }}
            >
              Send to maintenance
            </button>
          </>
        }
      >
        <Field label="Note" hint="Vendor, issue or expected return">
          <input className="input" value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)} placeholder="e.g. Battery service — Apple centre" />
        </Field>
      </Modal>
    </div>
  );
}
