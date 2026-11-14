import { useMemo, useState } from "react";
import {
  Check,
  FileCheck2,
  FilePlus2,
  FileText,
  Filter,
  History,
  ShieldCheck,
  Trash2,
  Upload,
  X,
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
import { approvalKindLabel, pendingApprovals, type ApprovalKind } from "../lib/approvals";
import { canDeleteRecord } from "../lib/permissions";
import type { CompanyDocument, Role } from "../types";
import { addDays, currency, fmtDate, fmtDateTime, monthLabel, relativeDays, todayISO } from "../lib/format";

const ROLES: Role[] = ["admin", "hr", "finance", "manager", "employee"];

const DOC_CATEGORIES: CompanyDocument["category"][] = [
  "employee",
  "policy",
  "financial",
  "project",
  "asset",
  "sop",
];

const CATEGORY_LABEL: Record<string, string> = {
  employee: "Employee",
  policy: "Policy",
  financial: "Financial",
  project: "Project",
  asset: "Asset",
  sop: "SOP",
};

export default function Approvals() {
  const { db, user, actions } = useStore();
  const [tab, setTab] = useState("inbox");
  const [kindFilter, setKindFilter] = useState<"all" | ApprovalKind>("all");
  const [docSearch, setDocSearch] = useState("");
  const [docCat, setDocCat] = useState("all");
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [accessDraft, setAccessDraft] = useState<Role[] | null>(null);

  const [docForm, setDocForm] = useState({
    name: "",
    category: "policy" as CompanyDocument["category"],
    fileName: "",
    accessRoles: ["admin", "hr"] as Role[],
    expiry: "",
    entityId: "",
  });

  if (!user) return null;

  const canDecide = ["admin", "hr", "finance", "manager"].includes(user.role);
  const canManageDocs = ["admin", "hr", "finance"].includes(user.role);
  const pending = pendingApprovals(db, user);
  const filtered = kindFilter === "all" ? pending : pending.filter((p) => p.kind === kindFilter);
  const totalValue = pending.reduce((s, p) => s + (p.amount ?? 0), 0);

  const highValue = pending.filter((p) => (p.amount ?? 0) > db.settings.approvalThresholds.departmentHead);

  const documents = useMemo(
    () =>
      db.documents
        .filter((d) => d.accessRoles.includes(user.role))
        .filter((d) => (docCat === "all" ? true : d.category === docCat))
        .filter((d) =>
          docSearch ? `${d.name} ${d.category}`.toLowerCase().includes(docSearch.toLowerCase()) : true
        )
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [db.documents, user.role, docCat, docSearch]
  );

  const selectedDoc = db.documents.find((d) => d.id === selectedDocId) ?? null;
  const expiringDocs = db.documents.filter(
    (d) =>
      d.accessRoles.includes(user.role) &&
      d.expiry &&
      d.expiry >= todayISO() &&
      d.expiry <= addDays(todayISO(), 45)
  );

  const empName = (id?: string) => db.employees.find((e) => e.id === id)?.name ?? "—";

  const decide = (key: string, kind: ApprovalKind, approve: boolean) => {
    const id = key.split(":")[1];
    if (kind === "leave") actions.decideLeave(id, approve);
    else if (kind === "timesheet") actions.decideTimesheet(id, approve);
    else if (kind === "correction") actions.decideCorrection(id, approve);
    else if (kind === "expense") actions.decideExpense(id, approve);
    else if (kind === "revision") actions.decideRevision(id, approve);
    else if (kind === "payroll") {
      const run = db.payrollRuns.find((r) => r.id === id);
      if (!run) return;
      const action =
        run.status === "draft"
          ? "hr"
          : run.status === "hr_verified"
          ? "finance"
          : run.status === "finance_verified"
          ? "approve"
          : "pay";
      actions.payrollTransition(run.id, action);
    }
  };

  const amountHint = (amount?: number) => {
    if (amount === undefined) return undefined;
    const t = db.settings.approvalThresholds;
    return amount > t.departmentHead ? "admin approval" : amount > t.teamLead ? "department head" : "team lead";
  };

  const openDoc = (doc: CompanyDocument) => {
    setSelectedDocId(doc.id);
    setVersionName("");
    setAccessDraft(doc.accessRoles);
  };

  return (
    <div className="page">
      <PageHeader
        title="Approvals & Documents"
        subtitle="One inbox for every decision, and one repository for every file that matters."
        actions={
          tab === "documents" && canManageDocs ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddDoc(true)}>
              <FilePlus2 size={14} /> Add document
            </button>
          ) : undefined
        }
      />

      <div className="stat-grid">
        <Stat label="Pending approvals" value={pending.length} sub={pending.length ? "Awaiting a decision" : "All clear"} icon={<FileCheck2 size={15} />} />
        <Stat label="Value in queue" value={currency(totalValue)} sub={`${highValue.length} above escalation limit`} icon={<ShieldCheck size={15} />} />
        <Stat label="Documents" value={documents.length} sub="Visible to your role" icon={<FileText size={15} />} />
        <Stat label="Expiring soon" value={expiringDocs.length} sub="Within 45 days" icon={<History size={15} />} />
      </div>

      {expiringDocs.length > 0 && (
        <div className="notice notice-amber">
          <History size={15} />
          <span>
            Renewal required: {expiringDocs.map((d) => `${d.name} (${relativeDays(d.expiry!)})`).join(" · ")}
          </span>
        </div>
      )}

      <Tabs
        tabs={[
          { id: "inbox", label: "Approval inbox", count: pending.length },
          { id: "documents", label: "Documents", count: documents.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "inbox" && (
        <section className="panel">
          <div className="toolbar">
            <div className="filter-label"><Filter size={13} /> Filter</div>
            <select className="select select-sm" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}>
              <option value="all">Every type</option>
              {(Object.keys(approvalKindLabel) as ApprovalKind[]).map((k) => (
                <option key={k} value={k}>{approvalKindLabel[k]}</option>
              ))}
            </select>
            <span className="toolbar-count">{filtered.length} item{filtered.length === 1 ? "" : "s"}</span>
          </div>

          {filtered.length === 0 ? (
            <Empty
              title="Inbox zero"
              text="No approvals are waiting for your role. New requests will appear here automatically."
              icon={<Check size={22} />}
            />
          ) : (
            <div className="approval-list">
              {filtered.map((item) => {
                const emp = db.employees.find((e) => e.id === item.employeeId);
                const hint = amountHint(item.amount);
                return (
                  <div className="approval-row" key={item.key}>
                    <div className="approval-kind">
                      <Badge tone={item.kind === "payroll" ? "violet" : item.kind === "expense" ? "blue" : "amber"}>
                        {approvalKindLabel[item.kind]}
                      </Badge>
                    </div>
                    <div className="approval-main">
                      <strong>{item.title}</strong>
                      <small>{item.subtitle}</small>
                    </div>
                    {emp && (
                      <div className="approval-user">
                        <Avatar name={emp.name} size={24} />
                        <span>{emp.name}</span>
                      </div>
                    )}
                    <div className="approval-amount">
                      {item.amount !== undefined ? (
                        <>
                          <strong>{currency(item.amount)}</strong>
                          {hint && <small>{hint}</small>}
                        </>
                      ) : (
                        <small>{relativeDays(item.at.slice(0, 10))}</small>
                      )}
                    </div>
                    {canDecide ? (
                      <div className="row-actions">
                        <button className="btn btn-primary btn-xs" onClick={() => decide(item.key, item.kind, true)}>
                          <Check size={12} /> {item.kind === "payroll" ? "Advance" : "Approve"}
                        </button>
                        {item.kind !== "payroll" && (
                          <button className="btn btn-ghost btn-xs" onClick={() => decide(item.key, item.kind, false)}>
                            <X size={12} /> Reject
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="cell-muted">View only</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === "documents" && (
        <section className="panel">
          <div className="toolbar">
            <div className="search">
              <FileText size={14} />
              <input placeholder="Search documents…" value={docSearch} onChange={(e) => setDocSearch(e.target.value)} />
            </div>
            <select className="select select-sm" value={docCat} onChange={(e) => setDocCat(e.target.value)}>
              <option value="all">All categories</option>
              {DOC_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
            <span className="toolbar-count">{documents.length} shown</span>
          </div>

          {documents.length === 0 ? (
            <Empty title="No documents" text="Documents shared with your role will appear here." icon={<FileText size={20} />} />
          ) : (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Category</th>
                    <th>Linked entity</th>
                    <th>Version</th>
                    <th>Uploaded</th>
                    <th>Expiry</th>
                    <th>Access</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => {
                    const expirySoon = d.expiry && d.expiry <= addDays(todayISO(), 45);
                    return (
                      <tr key={d.id} className="clickable" onClick={() => openDoc(d)}>
                        <td>
                          <div className="cell-user">
                            <span className="doc-icon"><FileText size={14} /></span>
                            <span>
                              <strong>{d.name}</strong>
                              <small>{d.versions[0]?.fileName}</small>
                            </span>
                          </div>
                        </td>
                        <td>{CATEGORY_LABEL[d.category]}</td>
                        <td className="cell-muted">
                          {d.entityId
                            ? db.employees.find((e) => e.id === d.entityId)?.name ??
                              db.projects.find((p) => p.id === d.entityId)?.name ??
                              "—"
                            : "—"}
                        </td>
                        <td>v{d.versions[0]?.version ?? 1}</td>
                        <td>{fmtDate(d.uploadedAt.slice(0, 10))}</td>
                        <td>
                          {d.expiry ? (
                            <span className={expirySoon ? "overdue" : ""}>{fmtDate(d.expiry)}</span>
                          ) : (
                            <span className="cell-muted">—</span>
                          )}
                        </td>
                        <td>
                          <div className="role-dots">
                            {d.accessRoles.map((r) => (
                              <span key={r} className={`role-dot role-${r}`} title={r}>{r[0].toUpperCase()}</span>
                            ))}
                          </div>
                        </td>
                        <td className="cell-cta">Open →</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="form-note">
            Access is role-based. Employees only see policies and their own documents; finance sees financial records;
            managers see project documents.
          </p>
        </section>
      )}

      {/* ---------- Document detail ---------- */}
      <Modal
        open={!!selectedDoc}
        onClose={() => setSelectedDocId(null)}
        title={selectedDoc?.name ?? ""}
        subtitle={
          selectedDoc
            ? `${CATEGORY_LABEL[selectedDoc.category]} · uploaded ${fmtDate(selectedDoc.uploadedAt.slice(0, 10))} by ${empName(selectedDoc.uploadedBy)}`
            : ""
        }
        size="lg"
        footer={
          selectedDoc &&
          canManageDocs && (
            <>
              {canDeleteRecord(user.role, "document") && (
                <button
                  className="btn btn-ghost btn-sm link-danger"
                  onClick={() => {
                    if (window.confirm(`Delete document “${selectedDoc.name}”? This can't be undone.`)) {
                      actions.deleteDocument(selectedDoc.id);
                      setSelectedDocId(null);
                    }
                  }}
                >
                  <Trash2 size={13} /> Delete
                </button>
              )}
              <span className="modal-foot-hint">Version history is preserved.</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (!versionName.trim()) return;
                  actions.addDocumentVersion(selectedDoc.id, versionName.trim());
                  setVersionName("");
                }}
              >
                <Upload size={13} /> Upload version
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setSelectedDocId(null)}>Done</button>
            </>
          )
        }
      >
        {selectedDoc && (
          <>
            <div className="kv-grid">
              <div className="kv"><span>Category</span><strong>{CATEGORY_LABEL[selectedDoc.category]}</strong></div>
              <div className="kv">
                <span>Linked entity</span>
                <strong>
                  {selectedDoc.entityId
                    ? db.employees.find((e) => e.id === selectedDoc.entityId)?.name ??
                      db.projects.find((p) => p.id === selectedDoc.entityId)?.name ??
                      "—"
                    : "—"}
                </strong>
              </div>
              <div className="kv"><span>Expiry</span><strong>{selectedDoc.expiry ? fmtDate(selectedDoc.expiry) : "No expiry"}</strong></div>
              <div className="kv"><span>Uploaded</span><strong>{fmtDateTime(selectedDoc.uploadedAt)}</strong></div>
            </div>

            <h4 className="panel-sub">Version history</h4>
            <div className="list">
              {selectedDoc.versions.map((v) => (
                <div className="list-row" key={`${v.version}-${v.at}`}>
                  <div>
                    <strong><FileText size={13} /> v{v.version} · {v.fileName}</strong>
                    <small>{v.size} · {fmtDate(v.at.slice(0, 10))} · {empName(v.by)}</small>
                  </div>
                  {v.version === selectedDoc.versions[0].version && <Badge tone="green">current</Badge>}
                </div>
              ))}
            </div>

            {canManageDocs && (
              <>
                <h4 className="panel-sub">Upload new version</h4>
                <div className="inline-form">
                  <input
                    className="input"
                    placeholder="file-name.pdf"
                    value={versionName}
                    onChange={(e) => setVersionName(e.target.value)}
                  />
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (!versionName.trim()) return;
                      actions.addDocumentVersion(selectedDoc.id, versionName.trim());
                      setVersionName("");
                    }}
                  >
                    Upload
                  </button>
                </div>

                <h4 className="panel-sub">Access control</h4>
                <div className="chips">
                  {ROLES.map((r) => {
                    const on = (accessDraft ?? selectedDoc.accessRoles).includes(r);
                    return (
                      <button
                        key={r}
                        className={`chip chip-toggle${on ? " on" : ""}`}
                        onClick={() => {
                          const base = accessDraft ?? selectedDoc.accessRoles;
                          setAccessDraft(on ? base.filter((x) => x !== r) : [...base, r]);
                        }}
                      >
                        {on ? <Check size={12} /> : <X size={12} />} {r}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const roles = accessDraft ?? selectedDoc.accessRoles;
                    if (!roles.length) return;
                    actions.updateDocumentAccess(selectedDoc.id, roles);
                    setAccessDraft(roles);
                  }}
                >
                  Save access
                </button>
              </>
            )}
          </>
        )}
      </Modal>

      {/* ---------- Add document ---------- */}
      <Modal
        open={showAddDoc}
        onClose={() => setShowAddDoc(false)}
        title="Add document"
        subtitle="Upload a policy, contract or employee document to the shared repository."
        size="lg"
        footer={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddDoc(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!docForm.name.trim() || !docForm.fileName.trim()) return;
                actions.addDocument({
                  name: docForm.name,
                  category: docForm.category,
                  fileName: docForm.fileName,
                  accessRoles: docForm.accessRoles,
                  expiry: docForm.expiry || undefined,
                  entityId: docForm.entityId || undefined,
                });
                setShowAddDoc(false);
                setDocForm({
                  name: "",
                  category: "policy",
                  fileName: "",
                  accessRoles: ["admin", "hr"],
                  expiry: "",
                  entityId: "",
                });
              }}
            >
              Add document
            </button>
          </>
        }
      >
        <div className="form-grid">
          <Field label="Document name" className="span-2">
            <input className="input" value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} placeholder="e.g. Leave & Attendance Policy" />
          </Field>
          <Field label="Category">
            <select className="select" value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value as CompanyDocument["category"] })}>
              {DOC_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="File name">
            <input className="input" value={docForm.fileName} onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })} placeholder="policy-2026.pdf" />
          </Field>
          <Field label="Expiry (optional)">
            <input className="input" type="date" value={docForm.expiry} onChange={(e) => setDocForm({ ...docForm, expiry: e.target.value })} />
          </Field>
          <Field label="Linked employee / project (optional)">
            <select className="select" value={docForm.entityId} onChange={(e) => setDocForm({ ...docForm, entityId: e.target.value })}>
              <option value="">Not linked</option>
              {db.employees.filter((e) => e.status !== "exited").map((e) => (
                <option key={e.id} value={e.id}>{e.name} — employee</option>
              ))}
              {db.projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name} — project</option>
              ))}
            </select>
          </Field>
        </div>
        <h4 className="panel-sub">Who can access this?</h4>
        <div className="chips">
          {ROLES.map((r) => {
            const on = docForm.accessRoles.includes(r);
            return (
              <button
                key={r}
                className={`chip chip-toggle${on ? " on" : ""}`}
                onClick={() =>
                  setDocForm({
                    ...docForm,
                    accessRoles: on
                      ? docForm.accessRoles.filter((x) => x !== r)
                      : [...docForm.accessRoles, r],
                  })
                }
              >
                {on ? <Check size={12} /> : <X size={12} />} {r}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
