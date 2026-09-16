import { useEffect, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Award,
  Bell,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  Filter,
  Gauge,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { getSessionHeaders } from "../lib/authClientDb";

/* ── tiny helpers (same design tokens as Home.tsx) ─────────────────────── */
function cn(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(" ");
}

function Avatar({ initials, tone = "bg-[#e7f2cc] text-[#2c4a15]" }: { initials: string; tone?: string }) {
  return <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-2 ring-white dark:ring-[#18231a]", tone)}>{initials}</div>;
}

function StatusPill({ children, tone = "lime" }: { children: React.ReactNode; tone?: "lime" | "blue" | "amber" | "slate" | "rose" }) {
  const tones = {
    lime:  "border-[#cfe9a5] bg-[#f2fbdc] text-[#466d19] dark:border-[#44642f] dark:bg-[#20301b] dark:text-[#b8ef82]",
    blue:  "border-[#bdd9ff] bg-[#edf5ff] text-[#1d5c9f] dark:border-[#315376] dark:bg-[#162a3d] dark:text-[#9dc9ff]",
    amber: "border-[#f6d79b] bg-[#fff7e5] text-[#9b6511] dark:border-[#735426] dark:bg-[#362713] dark:text-[#f2c76d]",
    slate: "border-[#d8d7d2] bg-[#f4f4f0] text-[#65635e] dark:border-[#3b4b3d] dark:bg-[#202b21] dark:text-[#c2d0c2]",
    rose:  "border-[#f3c6c7] bg-[#fff0f0] text-[#af4143] dark:border-[#733638] dark:bg-[#371b1d] dark:text-[#ffabab]",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]", tones[tone])}>{children}</span>;
}

function Surface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[#e1e0da] bg-white shadow-[0_12px_30px_rgba(34,39,25,.045)] dark:border-[#2d3d2e] dark:bg-[#18231a] dark:shadow-[0_12px_30px_rgba(0,0,0,.28)]", className)}>{children}</section>;
}

function Button({ children, variant = "dark", onClick, className = "" }: { children: React.ReactNode; variant?: "dark" | "lime" | "outline" | "ghost"; onClick?: () => void; className?: string }) {
  const styles = {
    dark:    "bg-[#172017] text-white shadow-[0_5px_0_#0c110c] hover:-translate-y-0.5 hover:shadow-[0_7px_0_#0c110c] dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_5px_0_#6f9829]",
    lime:    "bg-[#b8f34a] text-[#172017] shadow-[0_5px_0_#7eaa2a] hover:-translate-y-0.5 hover:shadow-[0_7px_0_#7eaa2a]",
    outline: "border border-[#d8d7d2] bg-white text-[#2e342e] hover:border-[#a5a39a] hover:bg-[#fafaf7] dark:border-[#405341] dark:bg-[#1d2b1e] dark:text-[#e5efe2] dark:hover:border-[#68806a] dark:hover:bg-[#273829]",
    ghost:   "bg-transparent text-[#5b605a] hover:bg-[#f2f1ec] hover:text-[#172017] dark:text-[#b5c2b3] dark:hover:bg-[#233124] dark:hover:text-white",
  };
  return (
    <button onClick={onClick} className={cn("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:translate-y-0.5 active:shadow-none", styles[variant], className)}>
      {children}
    </button>
  );
}

function StatCard({ label, value, meta, icon: Icon, tone = "lime", trend }: { label: string; value: string; meta: string; icon: any; tone?: "lime" | "blue" | "amber" | "rose"; trend?: string }) {
  const colors = { lime: "bg-[#f2fbdc] text-[#68952a] dark:bg-[#2b411f] dark:text-[#b8f34a]", blue: "bg-[#eaf3ff] text-[#3977bb] dark:bg-[#1b324b] dark:text-[#91c5ff]", amber: "bg-[#fff3d8] text-[#bd7b1e] dark:bg-[#3a2b15] dark:text-[#ffcd6f]", rose: "bg-[#fff0ef] text-[#be5a5d] dark:bg-[#3d2022] dark:text-[#ff9da0]" };
  const [spring, api] = useSpring(() => ({ transform: "translateY(0px) scale(1)", boxShadow: "0 12px 30px rgba(34,39,25,.045)", config: { tension: 300, friction: 22 } }));
  return (
    <animated.div style={spring} onMouseEnter={() => api.start({ transform: "translateY(-4px) scale(1.008)", boxShadow: "0 20px 42px rgba(34,39,25,.09)" })} onMouseLeave={() => api.start({ transform: "translateY(0px) scale(1)", boxShadow: "0 12px 30px rgba(34,39,25,.045)" })}>
      <Surface className="relative overflow-hidden p-4 sm:p-5">
        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full border-[12px] border-[#b8f34a]/10" />
        <div className="relative flex items-start justify-between">
          <div className={cn("grid h-9 w-9 place-items-center rounded-xl", colors[tone])}><Icon size={17} /></div>
          {trend && <span className="flex items-center gap-1 text-[10px] font-bold text-[#6c9d31]"><ArrowUpRight size={12} />{trend}</span>}
        </div>
        <div className="relative mt-4 font-display text-[29px] font-extrabold tracking-[-0.06em] text-[#1b271d] dark:text-[#f0f7ed]">{value}</div>
        <div className="relative mt-1 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#7d847b] dark:text-[#bdcbb9]">{label}</span>
          <span className="text-[10px] text-[#a2a59e] dark:text-[#849683]">{meta}</span>
        </div>
      </Surface>
    </animated.div>
  );
}

/* ── Dispute resolution modal ───────────────────────────────────────────── */
function DisputeModal({ dispute, onClose, onResolve }: { dispute: any; onClose: () => void; onResolve: (id: string, resolution: string) => void }) {
  const [resolution, setResolution] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!resolution.trim()) { toast.error("Please enter a resolution note."); return; }
    setSubmitting(true);
    await onResolve(dispute.id, resolution);
    setSubmitting(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-3xl border border-white/50 bg-[#fbfcf7] shadow-2xl dark:border-[#3c4c3d] dark:bg-[#172217]">
        <div className="flex items-start justify-between border-b border-[#e9ece2] p-5 sm:p-6 dark:border-[#314033]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c05a5a]">Admin · Dispute resolution</div>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.05em] text-[#263126] dark:text-[#eff7ec]">Resolve dispute</h2>
            <p className="mt-1 text-xs text-[#8e968b] dark:text-[#aab8a8]">Your decision is permanent and logged in the immutable audit trail.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-[#929a91] hover:bg-[#eef0e9] dark:text-[#acbaaa] dark:hover:bg-[#253427]"><X size={18} /></button>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <div className="rounded-xl border border-[#e9ece2] bg-[#f7f8f4] p-4 dark:border-[#354536] dark:bg-[#1e2b1f]">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9a9e96] dark:text-[#9dad9b]">Dispute details</div>
            <div className="mt-2 text-sm font-extrabold text-[#374536] dark:text-[#e5efe2]">{dispute.type?.replace(/_/g, " ") || "Member removal"}</div>
            <div className="mt-1 text-xs text-[#7d867c] dark:text-[#b1c1af]">Raised by: {dispute.raisedBy || "Team leader"}</div>
            <div className="mt-1 text-xs text-[#7d867c] dark:text-[#b1c1af]">Against: {dispute.against || "Member"}</div>
            {dispute.reason && <div className="mt-3 text-xs leading-5 text-[#5e6b5c] dark:text-[#c1d0bf]">"{dispute.reason}"</div>}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#c1d0bf]">Resolution note <span className="font-normal text-[#adb3aa] dark:text-[#849683]">(required)</span></span>
            <textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="min-h-[100px] w-full resize-none rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] transition focus:ring-2 dark:border-[#3a4a3b] dark:bg-[#101a11] dark:text-[#e8f5e0]"
              placeholder="Describe your decision and reasoning…"
            />
          </label>
          <div className="rounded-xl bg-[#fff7e5] p-3.5 text-[11px] leading-5 text-[#846c3d] dark:bg-[#362914] dark:text-[#f2ce80]">
            <AlertTriangle size={13} className="mb-1 inline-block" /> This decision is logged immutably and cannot be undone.
          </div>
          <div className="flex items-center justify-between gap-3">
            <button onClick={onClose} className="text-xs font-bold text-[#8f978c] dark:text-[#b1c0af]">Cancel</button>
            <Button variant="dark" onClick={handleSubmit} className={submitting ? "opacity-60 cursor-not-allowed" : ""}>
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Submit resolution
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Audit log table ────────────────────────────────────────────────────── */
function AuditLogRow({ entry }: { entry: any }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#f0efe9] px-5 py-3.5 sm:px-6 dark:border-[#29372a]">
      <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f4f5f0] text-[#7a8578] dark:bg-[#243025] dark:text-[#b4c4b1]">
        <FileText size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-[#3b463b] dark:text-[#e2ede0]">{entry.action?.replace(/_/g, " ") || "System action"}</div>
        <div className="mt-0.5 text-[10px] text-[#969e94] dark:text-[#93a491]">
          {entry.userId || "system"} · {entry.entityType || "platform"} {entry.entityId ? `· ${entry.entityId.slice(0, 12)}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] text-[#a2a79f] dark:text-[#8d9c8a]">{entry.timestamp ? new Date(entry.timestamp).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—"}</div>
      </div>
    </div>
  );
}

/* ── Main AdminPortal ───────────────────────────────────────────────────── */
export default function AdminPortal() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const [metrics, setMetrics] = useState<any>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "disputes" | "audit">("overview");
  const [selectedDispute, setSelectedDispute] = useState<any | null>(null);

  const heroSpring = useSpring({
    from: { opacity: 0, transform: "translateY(18px)" },
    to: { opacity: 1, transform: "translateY(0px)" },
    config: { tension: 210, friction: 22 },
  });

  const [competitionsList, setCompetitionsList] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const [metricsRes, disputesRes, auditRes, compsRes] = await Promise.all([
        fetch("/api/admin/metrics", { headers: getSessionHeaders() }),
        fetch("/api/admin/disputes", { headers: getSessionHeaders() }),
        fetch("/api/admin/audit-logs?limit=50", { headers: getSessionHeaders() }),
        fetch("/api/competitions"),
      ]);
      if (metricsRes.ok) {
        const d = await metricsRes.json();
        setMetrics(d.metrics ?? d);
      }
      if (disputesRes.ok) setDisputes((await disputesRes.json()).disputes ?? []);
      if (auditRes.ok) setAuditLogs((await auditRes.json()).logs ?? []);
      if (compsRes.ok) {
        const c = await compsRes.json();
        setCompetitionsList(c.competitions ?? c ?? []);
      }
    } catch {
      toast.error("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleResolve(disputeId: string, resolution: string) {
    try {
      const res = await fetch("/api/admin/disputes/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getSessionHeaders() },
        body: JSON.stringify({ disputeId, resolvedByUserId: user?.id, resolution, status: "resolved" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Dispute resolved.");
      loadData();
    } catch {
      toast.error("Failed to resolve dispute.");
    }
  }

  const openDisputeCount = disputes.filter((d) => d.status === "open").length;

  function handleLogout() {
    logout();
    setLocation("/login");
  }

  /* guard: only admin may view */
  if (user && user.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8f8f4] text-center p-8 dark:bg-[#101610]">
        <LockKeyhole size={40} className="text-[#c05a5a]" />
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-[-0.05em] text-[#172017] dark:text-[#eff7ec]">Access denied</h1>
        <p className="mt-2 text-sm text-[#899087] dark:text-[#b0c0ae]">This portal is for platform administrators only.</p>
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
    { id: "disputes" as const, label: "Disputes", icon: AlertTriangle, badge: openDisputeCount },
    { id: "audit" as const, label: "Audit log", icon: LockKeyhole },
  ];

  return (
    <div className="app-shell relative min-h-screen overflow-x-clip bg-[#f8f8f4] text-[#253025] dark:bg-[#101610] dark:text-[#e8f5e0]">
      {/* ambient background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>

      {/* Top bar */}
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e7e6e0] bg-[#f8f8f4]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8 dark:border-[#263327] dark:bg-[#101610]/90">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#b8f34a] text-[#172017] shadow-[0_3px_0_#7eaa2a]">
            <Sparkles size={19} strokeWidth={2.8} />
          </div>
          <div>
            <div className="font-display text-[17px] font-extrabold leading-none tracking-[-0.04em]">campus<span className="text-[#719d2a]">arena</span></div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#969991]">admin console</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="grid h-10 w-10 place-items-center rounded-xl border border-[#e0dfd8] bg-white text-[#596158] shadow-sm transition hover:bg-[#f5f5f0] dark:border-[#354536] dark:bg-[#1d2a1e] dark:text-[#d4e1d2] dark:hover:bg-[#273828]" title="Refresh data">
            <RefreshCw size={17} />
          </button>
          <button onClick={handleLogout} aria-label="Sign out" title="Sign out" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#f0d8d8] bg-[#fef4f4] px-3 text-xs font-bold text-[#aa3030] transition hover:bg-[#fde8e8] dark:border-[#573033] dark:bg-[#2a1818] dark:text-[#ffaaaa]">
            <LogOut size={15} /><span className="hidden sm:inline">Sign out</span>
          </button>
          <div className="hidden items-center gap-2 border-l border-[#e4e3dd] pl-3 sm:flex dark:border-[#334234]">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#172017] text-white text-[11px] font-bold">A</div>
            <div className="hidden text-left md:block">
              <div className="text-xs font-bold text-[#222b22] dark:text-[#e7f2e5]">{user?.name ?? "Admin"}</div>
              <div className="text-[10px] text-[#8a8f86] dark:text-[#a2b3a0]">Platform administrator</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1300px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        {/* Hero */}
        <animated.section style={heroSpring} className="relative mb-8 overflow-hidden rounded-[24px] bg-[#172017] px-6 py-7 text-white shadow-[0_18px_40px_rgba(31,45,28,.14)] sm:px-8">
          <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[46px] border-[#b8f34a]/12 pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d9ebbb]">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b8f34a] opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-[#b8f34a]" /></span>
                Admin console · live
              </div>
              <h1 className="font-display text-[34px] font-extrabold leading-[.95] tracking-[-0.07em] sm:text-[44px]">Platform<br /><span className="text-[#b8f34a]">command centre.</span></h1>
              <p className="mt-3 max-w-[500px] text-sm leading-6 text-white/60">One view for every metric, dispute, and audit event across all competitions on campus.</p>
            </div>
          <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => setLocation("/admin/forms")}>
                <FileText size={15} /> Form builder
              </Button>
              <Button variant="outline" onClick={() => setLocation("/admin/notifications")}>
                <Bell size={15} /> Notifications
              </Button>
              <Button variant="outline" onClick={() => toast("Exporting platform data…")}>
                <Globe2 size={15} /> Export report
              </Button>
            </div>
          </div>
        </animated.section>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-[#e5e4de] bg-[#f3f3ef] p-1 dark:border-[#344435] dark:bg-[#172217]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold transition-all",
                  activeTab === tab.id ? "bg-white shadow-sm text-[#172017] dark:bg-[#2a3a2b] dark:text-[#f0f8ed]" : "text-[#7d847b] hover:text-[#2e342e] dark:text-[#a5b7a3] dark:hover:text-[#e8f5e0]"
                )}
              >
                <Icon size={15} />
                {tab.label}
                {tab.badge ? <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e55d5d] text-[10px] font-extrabold text-white">{tab.badge}</span> : null}
              </button>
            );
          })}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={28} className="animate-spin text-[#719d2a]" />
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {!loading && activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI grid */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total competitions" value={String(metrics?.totalCompetitions ?? competitionsList.length ?? "—")} meta={`${metrics?.activeCompetitions ?? 2} active`} icon={Zap} tone="lime" />
              <StatCard label="Registered students" value={String(metrics?.totalStudents ?? "—")} meta="active accounts" icon={Users} tone="blue" trend="+14 this week" />
              <StatCard label="Total payments" value={metrics?.totalRevenue !== undefined ? `₹${Number(metrics.totalRevenue).toLocaleString("en-IN")}` : "—"} meta="gross collection" icon={Activity} tone="amber" />
              <StatCard label="Open disputes" value={String(openDisputeCount)} meta={openDisputeCount === 0 ? "all resolved" : "need decision"} icon={AlertTriangle} tone={openDisputeCount > 0 ? "rose" : "lime"} />
            </div>

            {/* Secondary stats grid */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Active competitions" value={String(metrics?.activeCompetitions ?? "—")} meta="running on campus" icon={Award} tone="lime" />
              <StatCard label="Submissions received" value={String(metrics?.totalSubmissions ?? "—")} meta="across rounds" icon={ClipboardCheck} tone="blue" />
              <StatCard label="Check-ins recorded" value={String(metrics?.totalCheckIns ?? "—")} meta="digital pass scans" icon={Gauge} tone="amber" />
              <StatCard label="Teams formed" value={String(metrics?.totalTeams ?? "—")} meta="registered" icon={Users} tone="rose" />
            </div>

            {/* Competition breakdown */}
            <Surface className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#eeeee8] px-5 py-4 sm:px-6 dark:border-[#2d3b2e]">
                <div>
                  <h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#edf7ea]">Competitions at a glance</h2>
                  <p className="mt-1 text-xs text-[#90968d] dark:text-[#a8b8a6]">Live status of all competitions on the platform.</p>
                </div>
                <StatusPill tone="lime">{competitionsList.length} total</StatusPill>
              </div>
              {competitionsList.length === 0 ? (
                <div className="py-10 text-center text-sm text-[#969b94] dark:text-[#a8b8a6]">No competitions yet.</div>
              ) : (
                competitionsList.map((comp: any) => {
                  const title = comp.title || comp.name || "Unnamed";
                  return (
                    <div key={comp.id} className="flex flex-wrap items-center gap-3 border-b border-[#f0efe9] px-5 py-4 sm:px-6 dark:border-[#29372a]">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef8d7] text-[#6e9c2d] text-[11px] font-black dark:bg-[#2a4020] dark:text-[#b8f34a]">
                        {title.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-[#3b463b] dark:text-[#e4efe2]">{title}</div>
                        <div className="mt-0.5 text-[10px] text-[#969b94] dark:text-[#95a794]">{comp.type?.replace(/_/g, " ") ?? "competition"}</div>
                      </div>
                      <StatusPill tone={comp.status === "registration_open" ? "lime" : comp.status === "published" ? "blue" : comp.status === "completed" ? "slate" : "amber"}>
                        {(comp.status ?? "draft").replace(/_/g, " ")}
                      </StatusPill>
                      <div className="text-xs font-bold text-[#7d847b] dark:text-[#b3c3b1]">
                        {comp.capacity?.maxTeams ? `${comp.capacity.maxTeams} max teams` : "Open capacity"}
                      </div>
                    </div>
                  );
                })
              )}
            </Surface>

            {/* Open disputes quick view */}
            {openDisputeCount > 0 && (
              <Surface className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-[#eeeee8] px-5 py-4 sm:px-6 dark:border-[#2d3b2e]">
                  <div>
                  <h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#edf7ea]">Disputes needing action</h2>
                  <p className="mt-1 text-xs text-[#90968d] dark:text-[#a8b8a6]">These are blocking team operations.</p>
                  </div>
                  <button onClick={() => setActiveTab("disputes")} className="text-xs font-extrabold text-[#668f2b]">View all <ChevronRight size={13} className="inline" /></button>
                </div>
                {disputes.filter((d) => d.status === "open").slice(0, 3).map((d) => (
                  <div key={d.id} className="flex items-center gap-3 border-b border-[#f0efe9] px-5 py-4 sm:px-6 dark:border-[#29372a]">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#fff0ef] text-[#be5a5d] dark:bg-[#3d2022] dark:text-[#ff9da0]"><AlertTriangle size={16} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold text-[#3b463b] dark:text-[#e4efe2]">{d.type?.replace(/_/g, " ") ?? "Dispute"}</div>
                      <div className="mt-0.5 text-[10px] text-[#969b94] dark:text-[#95a794]">{d.competitionId ?? "—"} · opened {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"}</div>
                    </div>
                    <Button variant="outline" className="px-3 py-1.5 text-xs" onClick={() => { setSelectedDispute(d); setActiveTab("disputes"); }}>Resolve</Button>
                  </div>
                ))}
              </Surface>
            )}
          </div>
        )}

        {/* ── DISPUTES ── */}
        {!loading && activeTab === "disputes" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><AlertTriangle size={13} /> Dispute queue</div>
                <h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20] dark:text-[#edf7ea]">Disputes.</h1>
                <p className="mt-2 text-sm leading-6 text-[#899087] dark:text-[#adbcaa]">Immutable resolutions. Every decision is logged against your admin account.</p>
              </div>
              <StatusPill tone={openDisputeCount > 0 ? "rose" : "lime"}>{openDisputeCount} open</StatusPill>
            </div>
            <Surface className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#eeeee8] px-5 py-4 sm:px-6 dark:border-[#2d3b2e]">
                <h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#edf7ea]">All disputes</h2>
                <button className="inline-flex items-center gap-2 rounded-xl border border-[#deded8] bg-white px-3 py-2 text-xs font-bold text-[#697168] dark:border-[#3b4b3c] dark:bg-[#1d2a1e] dark:text-[#c0d0be]"><Filter size={14} /> Filter</button>
              </div>
              {disputes.length === 0 ? (
                <div className="py-14 text-center">
                  <ShieldCheck size={32} className="mx-auto text-[#9dce4d]" />
                  <div className="mt-3 text-sm font-bold text-[#4a5648] dark:text-[#deebdb]">No disputes on record</div>
                  <div className="mt-1 text-xs text-[#97a094] dark:text-[#9cac9a]">All team operations are running smoothly.</div>
                </div>
              ) : (
                disputes.map((d) => (
                  <div key={d.id} className="flex flex-wrap items-start gap-3 border-b border-[#f0efe9] px-5 py-4 sm:px-6 dark:border-[#29372a]">
                    <div className={cn("mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl", d.status === "open" ? "bg-[#fff0ef] text-[#be5a5d] dark:bg-[#3d2022] dark:text-[#ff9da0]" : "bg-[#eef8d7] text-[#6e9c2d] dark:bg-[#2a4020] dark:text-[#b8f34a]")}>
                      {d.status === "open" ? <AlertTriangle size={16} /> : <Check size={16} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-xs font-extrabold text-[#3b463b] dark:text-[#e4efe2]">{d.type?.replace(/_/g, " ") ?? "Dispute"}</div>
                        <StatusPill tone={d.status === "open" ? "rose" : "lime"}>{d.status}</StatusPill>
                      </div>
                      <div className="mt-1 text-[10px] text-[#969b94] dark:text-[#95a794]">
                        Competition: {d.competitionId ?? "—"} · Team: {d.teamId ?? "—"}
                      </div>
                      <div className="mt-1 text-[10px] text-[#969b94] dark:text-[#95a794]">
                        Raised by: {d.raisedBy ?? "—"} · Opened: {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "—"}
                      </div>
                      {d.reason && <div className="mt-2 text-[11px] italic leading-5 text-[#7d867c] dark:text-[#bdccba]">"{d.reason}"</div>}
                      {d.resolution && (
                        <div className="mt-2 rounded-lg bg-[#f2fbdc] px-3 py-2 text-[11px] leading-5 text-[#466d19] dark:bg-[#24381d] dark:text-[#c2ef95]">
                          <strong>Resolution:</strong> {d.resolution}
                        </div>
                      )}
                    </div>
                    {d.status === "open" && (
                      <Button variant="dark" className="mt-1 px-3 py-1.5 text-xs" onClick={() => setSelectedDispute(d)}>Resolve</Button>
                    )}
                  </div>
                ))
              )}
            </Surface>
          </div>
        )}

        {/* ── AUDIT LOG ── */}
        {!loading && activeTab === "audit" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><LockKeyhole size={13} /> Immutable record</div>
                <h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20] dark:text-[#edf7ea]">Audit log.</h1>
                <p className="mt-2 text-sm leading-6 text-[#899087] dark:text-[#adbcaa]">Every significant action on the platform. Append-only, never editable.</p>
              </div>
              <div className="flex gap-2">
                <button className="inline-flex items-center gap-2 rounded-xl border border-[#deded8] bg-white px-3 py-2 text-xs font-bold text-[#697168] dark:border-[#3b4b3c] dark:bg-[#1d2a1e] dark:text-[#c0d0be]"><Search size={14} /> Search</button>
                <button className="inline-flex items-center gap-2 rounded-xl border border-[#deded8] bg-white px-3 py-2 text-xs font-bold text-[#697168] dark:border-[#3b4b3c] dark:bg-[#1d2a1e] dark:text-[#c0d0be]"><Filter size={14} /> Filter</button>
              </div>
            </div>
            <Surface className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#eeeee8] px-5 py-4 sm:px-6 dark:border-[#2d3b2e]">
                <h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#edf7ea]">Recent events</h2>
                <StatusPill tone="slate">{auditLogs.length} entries</StatusPill>
              </div>
              {auditLogs.length === 0 ? (
                <div className="py-14 text-center text-sm text-[#969b94] dark:text-[#a8b8a6]">No audit events yet.</div>
              ) : (
                auditLogs.map((entry, i) => <AuditLogRow key={i} entry={entry} />)
              )}
            </Surface>
            <div className="flex items-center gap-2 text-[11px] leading-5 text-[#939990] dark:text-[#a6b5a4]">
              <LockKeyhole size={13} /> Audit entries are append-only and cannot be modified or deleted.
            </div>
          </div>
        )}
      </main>

      {/* Dispute resolution modal */}
      {selectedDispute && (
        <DisputeModal
          dispute={selectedDispute}
          onClose={() => setSelectedDispute(null)}
          onResolve={handleResolve}
        />
      )}
    </div>
  );
}
