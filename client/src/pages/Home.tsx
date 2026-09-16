import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { animated, useSpring } from "@react-spring/web";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Flame,
  Gauge,
  Globe2,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  MoreHorizontal,
  MoveUpRight,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TicketPercent,
  Trophy,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { DigitalPassModal } from "../components/student/DigitalPassModal";
import { FindTeamModal } from "../components/student/FindTeamModal";
import { FindTeammatesModal } from "../components/student/FindTeammatesModal";
import { JudgePortal } from "../components/judge/JudgePortal";
import { PaymentModal } from "../components/student/PaymentModal";
import { ShowcaseModal } from "../components/student/ShowcaseModal";
import { StudentProfileModal } from "../components/student/StudentProfileModal";
import { SubmissionModal } from "../components/student/SubmissionModal";
import { NotificationsPanel } from "../components/NotificationsPanel";
import type { Competition, Team, Round } from "@shared/types";

/* ── types ──────────────────────────────────────────────────────────────── */
type Workspace = "student" | "organizer";
type StudentView = "home" | "competitions" | "teams" | "payments" | "certificates";
type OrganizerView = "overview" | "setup" | "teams" | "submissions" | "attendance" | "team";

/** A display-ready competition card (sourced from API or fallback static). */
type CompCard = {
  id: string;
  name: string;
  type: string;
  date: string;
  deadline: string;
  fee: string;
  spots: string;
  color: string;
  accent: string;
  logo: string;
  detail: string;
  status?: string;
  maxTeamSize?: number;
  minTeamSize?: number;
};

/* ── static fallback data (matches seed.ts) ─────────────────────────────── */
const STATIC_COMPETITIONS: CompCard[] = [
  {
    id: "comp_bharat",
    name: "Build for Bharat",
    type: "Hackathon",
    date: "18–20 Oct 2026",
    deadline: "Closes in 4 days",
    fee: "₹500 / team",
    spots: "42 spots left",
    color: "from-[#14213d] via-[#173c67] to-[#0e7490]",
    accent: "#b8f34a",
    logo: "BB",
    detail: "Build accessible tools for the next billion users with a 48-hour sprint, mentor hours, and a live demo day.",
  },
  {
    id: "comp_founders",
    name: "The Founder's Table",
    type: "Startup Summit",
    date: "01–02 Nov 2026",
    deadline: "Registration open",
    fee: "₹750 / team",
    spots: "18 teams left",
    color: "from-[#361a39] via-[#6a2d54] to-[#c04462]",
    accent: "#ffd166",
    logo: "FT",
    detail: "Pitch a sharp idea to founders, operators, and investors in a high-signal startup room.",
  },
  {
    id: "comp_design",
    name: "Design / Decode",
    type: "Design Competition",
    date: "08 Nov 2026",
    deadline: "Closes in 11 days",
    fee: "Free to enter",
    spots: "Open capacity",
    color: "from-[#1c3a2e] via-[#2e7656] to-[#9ccf65]",
    accent: "#eaffb0",
    logo: "DD",
    detail: "Turn a complex campus challenge into a simple, inclusive experience in one focused design sprint.",
  },
];

const CARD_COLORS: string[] = [
  "from-[#14213d] via-[#173c67] to-[#0e7490]",
  "from-[#361a39] via-[#6a2d54] to-[#c04462]",
  "from-[#1c3a2e] via-[#2e7656] to-[#9ccf65]",
  "from-[#2c1810] via-[#6b3c1e] to-[#c47d3b]",
  "from-[#1a1a3e] via-[#3d3d7a] to-[#7b5ea7]",
];
const CARD_ACCENTS = ["#b8f34a", "#ffd166", "#eaffb0", "#ffb347", "#c3b1e1"];

function apiCompToCard(comp: any, index: number): CompCard {
  const colorIdx = index % CARD_COLORS.length;
  const feeAmt = comp.pricing?.isFree ? 0 : (comp.pricing?.baseTeamFee ?? comp.registrationFee ?? 0);
  const typeMap: Record<string, string> = {
    hackathon: "Hackathon",
    startup_summit: "Startup Summit",
    design_competition: "Design Competition",
    case_competition: "Case Competition",
    quiz: "Quiz",
    ideathon: "Ideathon",
    pitch_competition: "Pitch Competition",
    other: "Competition",
  };
  const title = comp.title || comp.name || "Untitled";
  return {
    id: comp.id,
    name: title,
    type: typeMap[comp.type] || comp.type || "Competition",
    date: comp.dates?.startDate
      ? `${new Date(comp.dates.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(comp.dates.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
      : (comp.eventDates || "18–20 Oct 2026"),
    deadline: comp.dates?.registrationDeadline
      ? `Closes in ${Math.max(1, Math.ceil((new Date(comp.dates.registrationDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days`
      : (comp.registrationDeadline ? `Closes ${new Date(comp.registrationDeadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "Registration open"),
    fee: comp.pricing?.isFree || feeAmt === 0 ? "Free to enter" : `₹${feeAmt} / team`,
    spots: comp.capacity?.maxTeams ? `${comp.capacity.maxTeams} spots left` : (comp.maxTeams ? `${comp.maxTeams} max teams` : "Open capacity"),
    color: comp.branding?.gradient || CARD_COLORS[colorIdx],
    accent: comp.branding?.accentColor || CARD_ACCENTS[colorIdx],
    logo: comp.branding?.logoText || title.slice(0, 2).toUpperCase(),
    detail: comp.overview || comp.description || "",
    status: comp.status,
    maxTeamSize: comp.teamRules?.maxTeamSize ?? comp.maxTeamSize ?? 5,
    minTeamSize: comp.teamRules?.minTeamSize ?? comp.minTeamSize ?? 2,
  };
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Avatar({ initials, tone = "bg-[#e7f2cc] text-[#2c4a15]" }: { initials: string; tone?: string }) {
  return <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold ring-2 ring-white", tone)}>{initials}</div>;
}

function StatusPill({ children, tone = "lime" }: { children: React.ReactNode; tone?: "lime" | "blue" | "amber" | "slate" | "rose" }) {
  const tones = {
    lime: "border-[#cfe9a5] bg-[#f2fbdc] text-[#466d19] dark:border-[#385928] dark:bg-[#1a2d18] dark:text-[#b8f34a]",
    blue: "border-[#bdd9ff] bg-[#edf5ff] text-[#1d5c9f] dark:border-[#254668] dark:bg-[#14263a] dark:text-[#8fc0ff]",
    amber: "border-[#f6d79b] bg-[#fff7e5] text-[#9b6511] dark:border-[#5c441c] dark:bg-[#342410] dark:text-[#f8d070]",
    slate: "border-[#d8d7d2] bg-[#f4f4f0] text-[#65635e] dark:border-[#354336] dark:bg-[#1e261f] dark:text-[#b8c6b8]",
    rose: "border-[#f3c6c7] bg-[#fff0f0] text-[#af4143] dark:border-[#5c282a] dark:bg-[#341618] dark:text-[#ff999b]",
  };
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]", tones[tone])}>{children}</span>;
}

function Button({ children, variant = "dark", onClick, className = "", type = "button" }: { children: React.ReactNode; variant?: "dark" | "lime" | "white" | "ghost" | "outline"; onClick?: () => void; className?: string; type?: "button" | "submit" }) {
  const styles = {
    dark: "bg-[#172017] text-white shadow-[0_5px_0_#0c110c] hover:-translate-y-0.5 hover:shadow-[0_7px_0_#0c110c] dark:bg-[#b8f34a] dark:text-[#101610] dark:shadow-[0_5px_0_#6c982b]",
    lime: "bg-[#b8f34a] text-[#172017] shadow-[0_5px_0_#7eaa2a] hover:-translate-y-0.5 hover:shadow-[0_7px_0_#7eaa2a] dark:bg-[#b8f34a] dark:text-[#101610] dark:shadow-[0_5px_0_#6c982b]",
    white: "bg-white text-[#172017] shadow-[0_4px_0_rgba(20,35,23,.18)] hover:-translate-y-0.5 dark:bg-[#1e2a1f] dark:text-[#e8efe3] dark:border dark:border-[#2f4030] dark:shadow-[0_4px_0_rgba(0,0,0,.4)] dark:hover:bg-[#253526]",
    ghost: "bg-transparent text-[#5b605a] hover:bg-[#f2f1ec] hover:text-[#172017] dark:text-[#9fb09f] dark:hover:bg-[#1c281d] dark:hover:text-[#e8efe3]",
    outline: "border border-[#d8d7d2] bg-white text-[#2e342e] hover:border-[#a5a39a] hover:bg-[#fafaf7] dark:border-[#2d3d2e] dark:bg-[#18231a] dark:text-[#e8efe3] dark:hover:border-[#425844] dark:hover:bg-[#202e22]",
  };
  return <button type={type} onClick={onClick} className={cn("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:translate-y-0.5 active:shadow-none", styles[variant], className)}>{children}</button>;
}

function Surface({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[#e1e0da] bg-white shadow-[0_12px_30px_rgba(34,39,25,.045)] dark:border-[#273528] dark:bg-[#162018] dark:shadow-[0_12px_30px_rgba(0,0,0,.3)] text-inherit", className)}>{children}</section>;
}

function Logo() {
  return <div className="flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#b8f34a] text-[#172017] shadow-[0_3px_0_#7eaa2a]"><Sparkles size={19} strokeWidth={2.8} /></div><div><div className="font-display text-[17px] font-extrabold leading-none tracking-[-0.04em]">campus<span className="text-[#719d2a]">arena</span></div><div className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#969991]">competition OS</div></div></div>;
}

/* ── nav config ─────────────────────────────────────────────────────────── */
const navItems = [
  { id: "home" as StudentView, label: "Home", icon: LayoutDashboard },
  { id: "competitions" as StudentView, label: "Competitions", icon: Trophy },
  { id: "teams" as StudentView, label: "My teams", icon: Users },
  { id: "payments" as StudentView, label: "Payments", icon: CreditCard },
  { id: "certificates" as StudentView, label: "Certificates", icon: Award },
];

const organizerNav = [
  { id: "overview" as OrganizerView, label: "Overview", icon: LayoutDashboard },
  { id: "setup" as OrganizerView, label: "Competition setup", icon: Settings2 },
  { id: "teams" as OrganizerView, label: "Teams & requests", icon: Users },
  { id: "submissions" as OrganizerView, label: "Submissions", icon: FileCheck2 },
  { id: "attendance" as OrganizerView, label: "Attendance", icon: QrCode },
];

/* ── TopBar ─────────────────────────────────────────────────────────────── */
function TopBar({
  workspace,
  setWorkspace,
  onMobileMenu,
  onOpenProfile,
  onOpenNotifications,
  unreadCount,
}: {
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
  onMobileMenu: () => void;
  onOpenProfile: () => void;
  onOpenNotifications: () => void;
  unreadCount: number;
}) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "??";

  function goToProfile() {
    setLocation("/profile");
  }

  function handleLogout() {
    logout();
    setLocation("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e7e6e0] bg-[#f8f8f4]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8 dark:border-[#1e2a1e] dark:bg-[#0e1410]/90">
      <div className="flex items-center gap-4">
        <button aria-label="Open navigation" className="rounded-lg p-2 text-[#687066] hover:bg-[#efefe9] lg:hidden" onClick={onMobileMenu}><Menu size={21} /></button>
        <Logo />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={toggleTheme} aria-label="Toggle theme" className="grid h-10 w-10 place-items-center rounded-xl border border-[#e0dfd8] bg-white text-[#596158] shadow-sm transition hover:bg-[#f5f5f0] dark:border-[#2a382a] dark:bg-[#18221a] dark:text-[#c0d0c0]">
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="hidden h-10 items-center gap-3 rounded-xl border border-[#e0dfd8] bg-white px-3.5 text-left text-xs text-[#8c9089] shadow-sm md:flex md:w-[230px] dark:border-[#2a382a] dark:bg-[#18221a] dark:text-[#8a9a8a]">
          <Search size={15} /><span>Search anything</span><kbd className="ml-auto rounded-md border border-[#e4e3dd] bg-[#f6f6f1] px-1.5 py-0.5 font-mono text-[9px] dark:border-[#333] dark:bg-[#222]">⌘ K</kbd>
        </button>
        <button onClick={onOpenNotifications} className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#e0dfd8] bg-white text-[#596158] shadow-sm hover:bg-[#f5f5f0] dark:border-[#2a382a] dark:bg-[#18221a] dark:text-[#c0d0c0]">
          <Bell size={17} />
          {unreadCount > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#e55d5d] ring-2 ring-white" />}
        </button>
        {/* Sign out button */}
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#f0d8d8] bg-[#fef4f4] px-3 py-2 text-xs font-bold text-[#aa3030] transition hover:bg-[#fde8e8] dark:border-[#3a2020] dark:bg-[#2a1818] dark:text-[#f09090]"
        >
          <LogOut size={14} />
          <span className="hidden md:inline">Sign out</span>
        </button>
        {/* Avatar → /profile */}
        <div className="hidden items-center gap-2 border-l border-[#e4e3dd] pl-3 sm:flex dark:border-[#263028]">
          <button
            onClick={goToProfile}
            title="View your profile"
            className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-[#f0f4e8] dark:hover:bg-[#1e2e1e]"
          >
            <Avatar initials={initials} tone="bg-[#d9e8ff] text-[#245b91]" />
            <div className="hidden text-left md:block">
              <div className="text-xs font-bold text-[#222b22] dark:text-[#e8f5e0]">{user?.name ?? "Loading…"}</div>
              <div className="text-[10px] text-[#8a8f86] dark:text-[#7a8a7a]">View profile →</div>
            </div>
          </button>
          <ChevronDown size={14} className="text-[#8d9389]" />
        </div>
      </div>
    </header>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
function Sidebar({
  workspace, active, setActive, collapsed, setCollapsed, mobileOpen, setMobileOpen, setWorkspace, onOpenDigitalPass, onOpenFindTeammates,
}: {
  workspace: Workspace; active: StudentView | OrganizerView; setActive: (id: any) => void; collapsed: boolean; setCollapsed: (v: boolean) => void; mobileOpen: boolean; setMobileOpen: (v: boolean) => void; setWorkspace: (w: Workspace) => void; onOpenDigitalPass: () => void; onOpenFindTeammates: () => void;
}) {
  const items = workspace === "student" ? navItems : organizerNav;
  return (
    <>
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col border-r border-[#e5e4de] bg-[#f8f8f4] px-4 pb-5 pt-[94px] transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 dark:border-[#1e2a1e] dark:bg-[#101610]", collapsed ? "lg:w-[82px] lg:px-3" : "", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className={cn("mb-5 flex items-center justify-between px-2", collapsed ? "lg:justify-center" : "")}>
          <div className={cn("text-[10px] font-bold uppercase tracking-[0.16em] text-[#a0a49e] dark:text-[#7d8f7d]", collapsed ? "lg:hidden" : "")}>{workspace === "student" ? "Student workspace" : "Organizer workspace"}</div>
          <button aria-label="Collapse navigation" className="hidden rounded-lg p-1.5 text-[#969a93] hover:bg-[#ecece5] dark:text-[#8a9c8a] dark:hover:bg-[#1c281d] lg:block" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
          <button aria-label="Close navigation" className="rounded-lg p-1.5 text-[#969a93] hover:bg-[#ecece5] dark:text-[#8a9c8a] dark:hover:bg-[#1c281d] lg:hidden" onClick={() => setMobileOpen(false)}><X size={17} /></button>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button key={item.id} onClick={() => { setActive(item.id); setMobileOpen(false); }} className={cn("group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors", isActive ? "bg-[#172017] text-white shadow-[0_4px_0_#d8e9b7] dark:bg-[#b8f34a] dark:text-[#101610] dark:shadow-[0_4px_0_#6c982b]" : "text-[#6b7269] hover:bg-[#edede7] hover:text-[#1d281d] dark:text-[#9cb09c] dark:hover:bg-[#1c281d] dark:hover:text-[#e8efe3]", collapsed ? "lg:justify-center lg:px-2" : "")}>
                <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
                <span className={cn(collapsed ? "lg:hidden" : "")}>{item.label}</span>
                {item.id === "payments" && <span className={cn("ml-auto h-1.5 w-1.5 rounded-full bg-[#e55d5d]", collapsed ? "lg:hidden" : "")} />}
              </button>
            );
          })}
        </nav>
        <div className={cn("my-6 h-px bg-[#e6e5df] dark:bg-[#1f2e1f]", collapsed ? "lg:mx-1" : "")} />
        <div className={cn("space-y-1", collapsed ? "lg:hidden" : "")}>
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#a0a49e] dark:text-[#7d8f7d]">Your tools</div>
          <button onClick={onOpenDigitalPass} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#6b7269] hover:bg-[#edede7] hover:text-[#1d281d] dark:text-[#9cb09c] dark:hover:bg-[#1c281d] dark:hover:text-[#e8efe3]"><QrCode size={17} /><span>Digital event pass</span></button>
          <button onClick={() => toast("Help center opened.")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[#6b7269] hover:bg-[#edede7] hover:text-[#1d281d] dark:text-[#9cb09c] dark:hover:bg-[#1c281d] dark:hover:text-[#e8efe3]"><CircleHelp size={17} /><span>Help center</span></button>
        </div>
        <div className="mt-auto">
          <div className={cn("rounded-2xl bg-[#eaf6c9] p-3.5 dark:bg-[#162315] dark:border dark:border-[#2a3c28]", collapsed ? "lg:hidden" : "")}>
            <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#c8ef76] text-[#547d1c] dark:bg-[#25381d] dark:text-[#b8f34a]"><LifeBuoy size={15} /></div>
            <div className="text-xs font-bold text-[#294116] dark:text-[#e8efe3]">Need a teammate?</div>
            <div className="mt-1 text-[11px] leading-4 text-[#668048] dark:text-[#9cb09c]">Turn on "Looking for a team" to get discovered.</div>
            <button onClick={onOpenFindTeammates} className="mt-3 text-[11px] font-extrabold text-[#456c17] dark:text-[#b8f34a] underline underline-offset-2">Explore teammates <ArrowUpRight size={11} className="inline" /></button>
          </div>
          <button onClick={() => setWorkspace(workspace === "student" ? "organizer" : "student")} className={cn("mt-3 flex w-full items-center gap-2.5 rounded-xl border border-[#dfdfd8] bg-white p-2.5 text-left hover:border-[#b9baaF] dark:border-[#273528] dark:bg-[#162018] dark:hover:border-[#385038]", collapsed ? "lg:justify-center" : "")}>
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#172017] text-white dark:bg-[#253526] dark:text-[#b8f34a]"><BriefcaseBusiness size={14} /></div>
            <div className={cn("min-w-0", collapsed ? "lg:hidden" : "")}>
              <div className="truncate text-[11px] font-bold text-[#2b322c] dark:text-[#e8efe3]">Switch workspace</div>
              <div className="text-[10px] text-[#90958e] dark:text-[#9cb09c]">{workspace === "student" ? "Open organizer view" : "Back to student view"}</div>
            </div>
            <ChevronRight size={14} className={cn("ml-auto text-[#969b93] dark:text-[#7d8f7d]", collapsed ? "lg:hidden" : "")} />
          </button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-[#142016]/25 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
    </>
  );
}

/* ── AnimatedPage ────────────────────────────────────────────────────────── */
function AnimatedPage({ children, pageKey }: { children: React.ReactNode; pageKey: string }) {
  const [spring] = useSpring(() => ({
    from: { opacity: 0, transform: "translate3d(0,14px,0) scale(.992)" },
    to: { opacity: 1, transform: "translate3d(0,0,0) scale(1)" },
    config: { tension: 250, friction: 24, mass: 0.7 },
  }), [pageKey]);
  return <animated.div style={spring}>{children}</animated.div>;
}

/* ── Haikei backdrop ─────────────────────────────────────────────────────── */
function HaikeiBackdrop({ dark = true }: { dark?: boolean }) {
  const [float] = useSpring(() => ({
    from: { transform: "translate3d(0px,0px,0) rotate(0deg)" },
    to: async (next) => {
      await next({ transform: "translate3d(18px,-12px,0) rotate(3deg)" });
      await next({ transform: "translate3d(-12px,8px,0) rotate(-2deg)" });
      await next({ transform: "translate3d(0px,0px,0) rotate(0deg)" });
    },
    loop: true,
    config: { mass: 2.2, tension: 38, friction: 28 },
  }));
  const lime = dark ? "#b8f34a" : "#8fca3d";
  return (
    <div className="haikei-atmosphere pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 opacity-[.18] [background-image:radial-gradient(circle_at_20%_20%,rgba(184,243,74,.35),transparent_24%),radial-gradient(circle_at_80%_70%,rgba(92,150,255,.28),transparent_30%)]" />
      <animated.div style={float} className="absolute -right-24 -top-40 h-[520px] w-[520px] opacity-90">
        <svg viewBox="0 0 600 600" className="h-full w-full" preserveAspectRatio="none">
          <path d="M470 54C542 93 579 179 565 266C550 357 483 447 393 486C307 524 210 509 134 457C58 405 4 316 24 222C45 126 142 22 246 12C340 3 399 16 470 54Z" fill={lime} fillOpacity=".12" />
          <path d="M438 100C510 133 540 201 528 274C516 346 455 411 386 438C311 467 229 450 170 406C110 362 74 294 91 225C109 152 185 76 263 67C329 59 378 72 438 100Z" fill="none" stroke={lime} strokeOpacity=".2" strokeWidth="16" />
          <path d="M392 151C447 177 468 228 459 281C450 332 407 376 357 393C302 411 244 398 202 367C161 337 135 290 147 242C159 190 213 136 268 129C314 123 349 131 392 151Z" fill="none" stroke="#8fb8ff" strokeOpacity=".12" strokeWidth="2" />
        </svg>
      </animated.div>
      <animated.svg style={float} viewBox="0 0 1440 520" className="absolute inset-x-[-6%] bottom-[-15%] h-[72%] w-[112%] opacity-90" preserveAspectRatio="none">
        <path d="M0 315C170 210 300 380 480 315C660 250 740 105 945 175C1135 240 1220 360 1440 230V520H0Z" fill="#79a6ff" fillOpacity=".075" />
        <path d="M0 360C180 255 325 420 520 350C700 286 795 155 975 215C1150 274 1260 395 1440 300V520H0Z" fill={lime} fillOpacity=".08" />
        <path d="M0 388C205 290 355 445 565 382C755 324 840 205 1025 245C1195 283 1295 412 1440 338" fill="none" stroke="#e7f7bd" strokeOpacity=".18" strokeWidth="2" />
      </animated.svg>
      <div className="absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,.035)_45%,transparent_62%)] bg-[length:220%_100%] animate-[haikei-sheen_9s_ease-in-out_infinite]" />
    </div>
  );
}

/* ── StatCard ────────────────────────────────────────────────────────────── */
function StatCard({ label, value, meta, icon: Icon, tone = "lime", trend }: { label: string; value: string; meta: string; icon: any; tone?: "lime" | "blue" | "amber" | "rose"; trend?: string }) {
  const colors = {
    lime: "bg-[#f2fbdc] text-[#68952a] dark:bg-[#1a2d18] dark:text-[#b8f34a]",
    blue: "bg-[#eaf3ff] text-[#3977bb] dark:bg-[#14263a] dark:text-[#8fc0ff]",
    amber: "bg-[#fff3d8] text-[#bd7b1e] dark:bg-[#342410] dark:text-[#f8d070]",
    rose: "bg-[#fff0ef] text-[#be5a5d] dark:bg-[#341618] dark:text-[#ff999b]",
  };
  const [spring, api] = useSpring(() => ({ transform: "translateY(0px) scale(1)", boxShadow: "0 12px 30px rgba(34,39,25,.045)", config: { tension: 300, friction: 22 } }));
  return (
    <animated.div style={spring} onMouseEnter={() => api.start({ transform: "translateY(-4px) scale(1.008)", boxShadow: "0 20px 42px rgba(34,39,25,.09)" })} onMouseLeave={() => api.start({ transform: "translateY(0px) scale(1)", boxShadow: "0 12px 30px rgba(34,39,25,.045)" })}>
      <Surface className="relative overflow-hidden p-4 sm:p-5">
        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full border-[12px] border-[#b8f34a]/10" />
        <div className="relative flex items-start justify-between">
          <div className={cn("grid h-9 w-9 place-items-center rounded-xl", colors[tone])}><Icon size={17} /></div>
          {trend && <span className="flex items-center gap-1 text-[10px] font-bold text-[#6c9d31] dark:text-[#b8f34a]"><ArrowUpRight size={12} />{trend}</span>}
        </div>
        <div className="relative mt-4 font-display text-[29px] font-extrabold tracking-[-0.06em] text-[#1b271d] dark:text-[#e8efe3]">{value}</div>
        <div className="relative mt-1 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#7d847b] dark:text-[#9cb09c]">{label}</span>
          <span className="text-[10px] text-[#a2a59e] dark:text-[#7d8f7d]">{meta}</span>
        </div>
      </Surface>
    </animated.div>
  );
}

/* ── DeadlineRow ─────────────────────────────────────────────────────────── */
function DeadlineRow({ icon: Icon, title, detail, tone, action }: { icon: any; title: string; detail: string; tone: "rose" | "amber" | "blue"; action?: string }) {
  const styles = {
    rose: "bg-[#fff0f0] text-[#c35151] dark:bg-[#341618] dark:text-[#ff999b]",
    amber: "bg-[#fff7e5] text-[#b5761e] dark:bg-[#342410] dark:text-[#f8d070]",
    blue: "bg-[#edf5ff] text-[#3d78b8] dark:bg-[#14263a] dark:text-[#8fc0ff]",
  };
  return (
    <div className="flex items-center gap-3 py-3">
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", styles[tone])}><Icon size={16} /></div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-[#2d342c] dark:text-[#e8efe3]">{title}</div>
        <div className="mt-0.5 truncate text-[11px] text-[#92978e] dark:text-[#9cb09c]">{detail}</div>
      </div>
      {action && <button onClick={() => toast(action)} className="shrink-0 text-[10px] font-extrabold text-[#5a8124] underline underline-offset-2 dark:text-[#b8f34a]">Act now</button>}
    </div>
  );
}

/* ── CompetitionCard ─────────────────────────────────────────────────────── */
function CompetitionCard({ competition, onOpen }: { competition: CompCard; onOpen: (c: CompCard) => void }) {
  const [cardSpring, cardApi] = useSpring(() => ({ transform: "scale(1)", config: { tension: 320, friction: 18 } }));
  return (
    <animated.button style={cardSpring} onMouseEnter={() => cardApi.start({ transform: "scale(1.018)" })} onMouseLeave={() => cardApi.start({ transform: "scale(1)" })} onClick={() => onOpen(competition)} className="group relative min-h-[263px] overflow-hidden rounded-2xl text-left text-white shadow-[0_14px_28px_rgba(24,37,27,.12)]">
      <div className={cn("absolute inset-0 bg-gradient-to-br", competition.color)} />
      <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full border-[20px] border-white/10" />
      <div className="absolute -bottom-24 -left-12 h-48 w-48 rounded-full border-[28px] border-white/10" />
      <svg className="absolute -bottom-8 left-0 h-40 w-full opacity-40 transition-transform duration-700 group-hover:translate-x-3 group-hover:scale-105" viewBox="0 0 500 180" preserveAspectRatio="none"><path d="M0 105C70 60 120 135 195 105C270 75 310 20 390 55C435 75 460 105 500 75V180H0Z" fill={competition.accent} fillOpacity=".12" /><path d="M0 125C80 80 135 150 210 120C290 88 330 45 410 78C450 95 470 125 500 102" fill="none" stroke="white" strokeOpacity=".22" strokeWidth="2" /></svg>
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-xs font-black tracking-tight backdrop-blur-sm">{competition.logo}</div>
          <StatusPill tone="lime">{competition.deadline}</StatusPill>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
            <span>{competition.type}</span><span className="h-1 w-1 rounded-full bg-white/45" /><span>{competition.fee}</span>
          </div>
          <h3 className="font-display text-[26px] font-extrabold leading-[.98] tracking-[-0.06em]">{competition.name}</h3>
          <p className="mt-2 line-clamp-2 max-w-[260px] text-xs leading-5 text-white/72">{competition.detail}</p>
          <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3 text-[10px] font-bold text-white/68">
            <span className="flex items-center gap-1.5"><CalendarDays size={12} />{competition.date}</span>
            <span>{competition.spots}</span>
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 right-4 grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white opacity-0 transition-opacity group-hover:opacity-100"><ArrowUpRight size={15} /></div>
    </animated.button>
  );
}

/* ── ProgressRing ────────────────────────────────────────────────────────── */
function ProgressRing({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 29;
  return (
    <div className="relative h-[76px] w-[76px]">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r="29" fill="none" stroke="#e6eadb" className="stroke-[#e6eadb] dark:stroke-[#253426]" strokeWidth="7" />
        <circle cx="38" cy="38" r="29" fill="none" stroke="#8fca3d" className="dark:stroke-[#b8f34a]" strokeLinecap="round" strokeWidth="7" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} />
      </svg>
      <div className="absolute inset-0 grid place-items-center font-display text-[18px] font-extrabold tracking-[-0.05em] text-[#334627] dark:text-[#e8efe3]">{value}%</div>
    </div>
  );
}

/* ── StudentHome ─────────────────────────────────────────────────────────── */
function StudentHome({
  setActive,
  openCompetition,
  competitions,
  teams,
  onOpenProfile,
  onOpenFindTeam,
}: {
  setActive: (v: StudentView) => void;
  openCompetition: (c: CompCard) => void;
  competitions: CompCard[];
  teams: any[];
  onOpenProfile: () => void;
  onOpenFindTeam: () => void;
}) {
  const { user } = useAuth();
  const heroSpring = useSpring({ from: { opacity: 0, transform: "translateY(18px)" }, to: { opacity: 1, transform: "translateY(0px)" }, config: { tension: 210, friction: 22 } });

  const activeRegistrations = teams.length;
  const pendingTeams = teams.filter((t) => t.status === "forming" || t.status === "pending_verification").length;

  return (
    <div className="space-y-6">
      <animated.section style={heroSpring} className="hero-grid relative overflow-hidden rounded-[24px] bg-[#172017] px-5 py-6 text-white shadow-[0_18px_40px_rgba(31,45,28,.14)] sm:px-8 sm:py-8">
        <HaikeiBackdrop />
        <div className="relative max-w-[610px]">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d9ebbb]">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#b8f34a] opacity-60" /><span className="relative h-1.5 w-1.5 rounded-full bg-[#b8f34a]" /></span>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <h1 className="font-display text-[35px] font-extrabold leading-[.98] tracking-[-0.065em] sm:text-[48px]">Make something<br /><span className="text-[#b8f34a]">worth showing off.</span></h1>
          <p className="mt-4 max-w-[430px] text-sm leading-6 text-white/62">The next great idea on campus is probably yours. Find a room, a team, and a deadline that makes you move.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="lime" onClick={() => setActive("competitions")}>Explore competitions <ArrowUpRight size={15} /></Button>
            <button onClick={onOpenFindTeam} className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 hover:bg-white/8 hover:text-white">Find a team <ChevronRight size={15} /></button>
          </div>
        </div>
        <div className="relative mt-8 flex items-end justify-between sm:absolute sm:bottom-8 sm:right-8 sm:mt-0 sm:block">
          <div className="mb-2 text-right text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Your momentum</div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/15"><div className="momentum-fill h-full w-[72%] rounded-full bg-[#b8f34a]" /></div>
            <span className="font-display text-2xl font-extrabold tracking-[-0.06em]">72</span>
          </div>
        </div>
      </animated.section>

      <div className="stagger-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active registrations" value={String(activeRegistrations).padStart(2, "0")} meta={pendingTeams > 0 ? `${pendingTeams} needs action` : "all good"} icon={ClipboardCheck} tone="lime" trend="+1 this week" />
        <StatCard label="Team status" value={String(teams.filter((t) => t.status === "pending_verification").length).padStart(2, "0")} meta="awaiting verify" icon={Users} tone="blue" />
        <StatCard label="Upcoming deadline" value="04d" meta={competitions[0]?.name ?? "—"} icon={Clock3} tone="amber" />
        <StatCard label="Certificates" value="03" meta="ready to download" icon={Award} tone="rose" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.8fr)]">
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#eeeee8] px-5 py-4 sm:px-6 dark:border-[#273528]">
            <div>
              <div className="flex items-center gap-2"><Flame size={16} className="text-[#e19b26]" /><h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#e8efe3]">Made for your next move</h2></div>
              <p className="mt-1 text-xs text-[#90968d] dark:text-[#9cb09c]">Opportunities based on your interests in product and building.</p>
            </div>
            <button onClick={() => setActive("competitions")} className="hidden items-center gap-1 text-xs font-extrabold text-[#648f2a] sm:flex dark:text-[#b8f34a]">View all <ChevronRight size={14} /></button>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
            {competitions.slice(0, 3).map((comp) => <CompetitionCard key={comp.id} competition={comp} onOpen={openCompetition} />)}
          </div>
          <button onClick={() => setActive("competitions")} className="flex w-full items-center justify-center gap-1 border-t border-[#eeeee8] py-3 text-xs font-extrabold text-[#648f2a] sm:hidden dark:border-[#273528] dark:text-[#b8f34a]">View all competitions <ChevronRight size={14} /></button>
        </Surface>

        <div className="space-y-6">
          <Surface className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2"><Target size={16} className="text-[#719d2a]" /><h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#e8efe3]">Finish your profile</h2></div>
                <p className="mt-1 text-xs leading-5 text-[#90968d] dark:text-[#9cb09c]">A stronger profile gets you into better teams.</p>
              </div>
              <ProgressRing value={72} />
            </div>
            <div className="mt-5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#6d746b] dark:text-[#d0ded0]"><Check size={14} className="text-[#76a72f] dark:text-[#b8f34a]" />Add a profile photo</div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#6d746b] dark:text-[#d0ded0]"><Check size={14} className="text-[#76a72f] dark:text-[#b8f34a]" />Add 3 more skills</div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#adb1aa] dark:text-[#6a786a]"><span className="h-3.5 w-3.5 rounded-full border border-[#d5d8d1] dark:border-[#384838]" />Connect your LinkedIn</div>
            </div>
            <button onClick={onOpenProfile} className="mt-5 w-full rounded-xl border border-[#dfe3d5] bg-[#f7fbe9] py-2.5 text-xs font-extrabold text-[#5e8723] hover:bg-[#eef8d1] dark:border-[#385025] dark:bg-[#1e2f1a] dark:text-[#b8f34a] dark:hover:bg-[#283d21]">Complete profile</button>
          </Surface>

          <Surface className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Clock3 size={16} className="text-[#c57b1b]" /><h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#e8efe3]">Your next deadlines</h2></div>
              <button onClick={() => setActive("competitions")} className="text-[10px] font-extrabold text-[#9a6a1e] dark:text-[#f8d070] hover:underline">See calendar</button>
            </div>
            <div className="mt-2 divide-y divide-[#f0efe9] dark:divide-[#273528]">
              <DeadlineRow icon={CreditCard} title="Complete team payment" detail="Product Case League · tomorrow" tone="rose" action="Review" />
              <DeadlineRow icon={FileText} title="Submit concept note" detail="Build for Bharat · 4 days" tone="amber" action="Open" />
              <DeadlineRow icon={Users} title="Verify your teammate" detail="Devfolio team · 6 days" tone="blue" action="Verify" />
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}

/* ── CompetitionsView ────────────────────────────────────────────────────── */
function CompetitionsView({ openCompetition, competitions }: { openCompetition: (c: CompCard) => void; competitions: CompCard[] }) {
  const [filter, setFilter] = useState("All");
  const filters = useMemo(() => ["All", ...Array.from(new Set(competitions.map((c) => c.type)))], [competitions]);
  const filtered = useMemo(() => filter === "All" ? competitions : competitions.filter((c) => c.type === filter), [filter, competitions]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><Trophy size={13} /> Discovery room</div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20]">Find your next arena.</h1>
          <p className="mt-2 max-w-[520px] text-sm leading-6 text-[#899087]">Browse campus competitions, compare deadlines, and find the one that makes you curious enough to stay up late.</p>
        </div>
        <Button variant="dark" onClick={() => toast("Shareable competition link copied.")}><ExternalLink size={15} /> Share discover page</Button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={cn("whitespace-nowrap rounded-full border px-3 py-2 text-xs font-bold transition", filter === item ? "border-[#172017] bg-[#172017] text-white dark:border-[#b8f34a] dark:bg-[#b8f34a] dark:text-[#101610]" : "border-[#deded8] bg-white text-[#757c73] hover:border-[#b1b5ae] dark:border-[#273528] dark:bg-[#162018] dark:text-[#9cb09c] dark:hover:border-[#3e523f] dark:hover:text-[#e8efe3]")}>{item}</button>
        ))}
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((comp) => <CompetitionCard key={comp.id} competition={comp} onOpen={openCompetition} />)}
        <button onClick={() => toast("Organizer submission form opened.")} className="group flex min-h-[263px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#d9ddd0] bg-[#f4f8e7] p-6 text-center hover:border-[#a7c66a] dark:border-[#2e422c] dark:bg-[#132213] dark:hover:border-[#527a44]">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-[#dff2ac] text-[#6f9c2a] transition-transform group-hover:scale-110 dark:bg-[#20371a] dark:text-[#b8f34a]"><Plus size={19} /></div>
          <div className="mt-4 text-sm font-extrabold text-[#4e6e24] dark:text-[#e8efe3]">Host a competition</div>
          <div className="mt-1 max-w-[160px] text-xs leading-5 text-[#829867] dark:text-[#9cb09c]">Bring your idea to the whole campus.</div>
        </button>
      </div>
      <Surface className="overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[1.2fr_.8fr]">
          <div className="relative overflow-hidden bg-[#ecf5ff] p-6 sm:p-8 dark:bg-[#121f2d]">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[24px] border-[#b9d9ff]/60 dark:border-[#1d3c5c]/40" />
            <div className="relative max-w-[420px]">
              <StatusPill tone="blue">Smart matching</StatusPill>
              <h2 className="mt-4 font-display text-3xl font-extrabold leading-[1] tracking-[-0.06em] text-[#173552] dark:text-[#e8efe3]">Looking for a team?<br /><span className="text-[#3d78b8] dark:text-[#8fc0ff]">Be findable.</span></h2>
              <p className="mt-3 text-sm leading-6 text-[#58748f] dark:text-[#9bb8d6]">Turn on your intent and relevant teams can invite you. Your profile stays private until you choose to connect.</p>
              <Button variant="dark" className="mt-5" onClick={() => toast("You're now marked as looking for a team.")}>Turn on team matching <ArrowUpRight size={15} /></Button>
            </div>
          </div>
          <div className="flex items-center justify-center border-t border-[#dce8f4] bg-white p-6 md:border-l md:border-t-0 dark:border-[#1d3c5c] dark:bg-[#172433]">
            <div className="flex max-w-[290px] items-center gap-4">
              <div className="flex -space-x-3">
                <Avatar initials="RK" tone="bg-[#ffe1c7] text-[#9e5a25]" />
                <Avatar initials="SZ" tone="bg-[#ded5ff] text-[#6444a0]" />
                <Avatar initials="AM" tone="bg-[#ccefe6] text-[#24745b]" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-[#2e382e] dark:text-[#e8efe3]">26 students are looking</div>
                <div className="mt-1 text-xs leading-5 text-[#929c97] dark:text-[#8ea9c2]">Across product, design, data, and climate.</div>
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}

/* ── TeamsView ───────────────────────────────────────────────────────────── */
function TeamsView({
  onOpenTeam,
  teams,
  onOpenFindTeam,
  onOpenFindTeammates,
  onOpenPayment,
  onOpenSubmission,
}: {
  onOpenTeam: () => void;
  teams: any[];
  onOpenFindTeam: () => void;
  onOpenFindTeammates: () => void;
  onOpenPayment: (team: any) => void;
  onOpenSubmission: (team: any) => void;
}) {
  const { user } = useAuth();

  // PIN verification modal state
  const [pinInput, setPinInput] = useState("");
  const [pinTeamId, setPinTeamId] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  async function verifyPin() {
    if (!pinInput || !pinTeamId || !user) return;
    setPinLoading(true);
    try {
      const res = await fetch("/api/teams/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: pinTeamId, userId: user.id, pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "PIN error");
      toast.success("PIN verified! You're now a confirmed team member.");
      setPinTeamId(null);
      setPinInput("");
    } catch (e: any) {
      toast.error(e.message ?? "Invalid PIN.");
    } finally {
      setPinLoading(false);
    }
  }

  const myTeam = teams[0]; // first team for the main card

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><Users size={13} /> Collaboration</div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20]">Your teams.</h1>
          <p className="mt-2 text-sm leading-6 text-[#899087]">Every great build starts with a small group of people who care about the same problem.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onOpenFindTeammates}><Search size={15} /> Find teammates</Button>
          <Button variant="lime" onClick={onOpenFindTeam}><Plus size={15} /> Find / join team</Button>
        </div>
      </div>

      {teams.length === 0 ? (
        <Surface className="p-10 text-center">
          <Users size={32} className="mx-auto text-[#9dce4d]" />
          <div className="mt-3 text-sm font-bold text-[#4a5648] dark:text-[#e8efe3]">No teams yet</div>
          <div className="mt-1 text-xs text-[#97a094] dark:text-[#9cb09c]">Find a competition and create or join a team to get started.</div>
          <Button variant="lime" className="mt-5" onClick={onOpenFindTeam}>Find a team <ArrowUpRight size={15} /></Button>
        </Surface>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          {myTeam && (
            <Surface className="overflow-hidden">
              <div className="border-b border-[#eeeee8] bg-[#fbfcf4] p-5 sm:p-6 dark:border-[#273528] dark:bg-[#131d14]">
                <div className="flex items-start justify-between">
                  <div>
                    <StatusPill tone={myTeam.status === "registered" ? "lime" : myTeam.status === "payment_pending" ? "amber" : "blue"}>
                      {(myTeam.status ?? "forming").replace(/_/g, " ")}
                    </StatusPill>
                    <h2 className="mt-3 font-display text-[26px] font-extrabold tracking-[-0.06em] text-[#243025] dark:text-[#e8efe3]">{myTeam.name ?? "Unnamed team"}</h2>
                    <div className="mt-1 text-xs text-[#92978e] dark:text-[#9cb09c]">Team code: {myTeam.code ?? "—"} · {myTeam.competitionId ?? "—"}</div>
                  </div>
                  <button onClick={() => toast("More team actions opened.")} className="rounded-lg p-2 text-[#9a9e97] hover:bg-white dark:hover:bg-[#1e2a20]"><MoreHorizontal size={18} /></button>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {(myTeam.members ?? []).slice(0, 4).map((m: any, i: number) => (
                      <Avatar key={i} initials={(m.userId ?? "?").slice(2, 4).toUpperCase()} tone={i === 0 ? "bg-[#d9e8ff] text-[#245b91]" : i === 1 ? "bg-[#ffe1c7] text-[#9e5a25]" : "bg-[#ded5ff] text-[#6444a0]"} />
                    ))}
                  </div>
                  <div className="ml-2 text-xs font-semibold text-[#656e64] dark:text-[#d0ded0]">{(myTeam.members ?? []).length} of {myTeam.maxSize ?? "?"} members</div>
                  {myTeam.status === "payment_pending" && (
                    <span className="ml-auto text-xs font-bold text-[#af701a] dark:text-[#f8d070]">Payment pending</span>
                  )}
                </div>
              </div>
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#899087] dark:text-[#9cb09c]">Team registration checklist</div>
                  <div className="text-xs font-bold text-[#6c982b] dark:text-[#b8f34a]">5 / 7 complete</div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef0e8] dark:bg-[#253426]"><div className="h-full w-[71%] rounded-full bg-[#9dce4d]" /></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#536052] dark:text-[#d0ded0]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#e4f4bb] text-[#6e9a2b] dark:bg-[#1a2e18] dark:text-[#b8f34a]"><Check size={12} /></span>Track selected</div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#536052] dark:text-[#d0ded0]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#e4f4bb] text-[#6e9a2b] dark:bg-[#1a2e18] dark:text-[#b8f34a]"><Check size={12} /></span>Registration details</div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#536052] dark:text-[#d0ded0]"><span className="grid h-5 w-5 place-items-center rounded-full bg-[#e4f4bb] text-[#6e9a2b] dark:bg-[#1a2e18] dark:text-[#b8f34a]"><Check size={12} /></span>Declarations accepted</div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#a06e24] dark:text-[#f8d070]">
                    <span className="grid h-5 w-5 place-items-center rounded-full border border-[#e7c37d] bg-[#fff7e5] text-[#a06e24] dark:border-[#5c441c] dark:bg-[#342410] dark:text-[#f8d070]"><Clock3 size={11} /></span>
                    Verify member PIN
                    <button onClick={() => setPinTeamId(myTeam.id)} className="ml-1 text-[10px] font-extrabold text-[#a06e24] underline dark:text-[#f8d070]">Enter PIN</button>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="dark" onClick={onOpenTeam}>Open team workspace <ArrowUpRight size={15} /></Button>
                  {myTeam.status === "payment_pending" && (
                    <Button variant="lime" onClick={() => onOpenPayment(myTeam)}>Pay now <CreditCard size={15} /></Button>
                  )}
                </div>
              </div>
            </Surface>
          )}

          <Surface className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2"><Handshake size={16} className="text-[#4c83c1]" /><h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#e8efe3]">Team invitations</h2></div>
                <p className="mt-1 text-xs text-[#90968d] dark:text-[#9cb09c]">One invite needs your response.</p>
              </div>
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[#fff0ef] text-[10px] font-extrabold text-[#bd5b5c] dark:bg-[#341618] dark:text-[#ff999b]">1</span>
            </div>
            <div className="mt-5 rounded-xl border border-[#e8e9e2] bg-[#fafbf8] p-4 dark:border-[#273528] dark:bg-[#141f15]">
              <div className="flex items-start gap-3">
                <Avatar initials="NS" tone="bg-[#f6ddc3] text-[#9c5f28]" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#344035] dark:text-[#e8efe3]">Nisha sent an invite</div>
                  <div className="mt-1 text-[11px] leading-5 text-[#899187] dark:text-[#9cb09c]">Join <span className="font-bold text-[#596b4e] dark:text-[#b8f34a]">Greenroom</span> for Design / Decode</div>
                  <div className="mt-3 flex gap-2">
                    <Button variant="dark" className="px-3 py-2 text-xs" onClick={() => toast("Invite accepted. Team leader confirmation is pending.")}>Accept</Button>
                    <button onClick={() => toast("Invite declined.")} className="rounded-lg px-3 py-2 text-xs font-bold text-[#989e94] hover:bg-[#eeefe9] dark:text-[#9cb09c] dark:hover:bg-[#202d21]">Decline</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-5 border-t border-[#eeeee8] pt-4 dark:border-[#273528]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#677067] dark:text-[#d0ded0]">Looking for a team</span>
                <button onClick={() => toast("Team matching preference updated.")} className="relative h-6 w-11 rounded-full bg-[#b8f34a]"><span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-[#172017] shadow-sm" /></button>
              </div>
              <div className="mt-2 text-[11px] leading-5 text-[#969c93] dark:text-[#9cb09c]">Your profile is visible to relevant teams while this is on.</div>
            </div>
          </Surface>
        </div>
      )}

      {/* PIN modal */}
      {pinTeamId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[400px] rounded-3xl border border-white/50 bg-[#fbfcf7] p-6 shadow-2xl dark:border-[#273528] dark:bg-[#142016]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#263126] dark:text-[#e8efe3]">Enter your member PIN</h2>
              <button onClick={() => setPinTeamId(null)} className="rounded-lg p-1.5 text-[#929a91] hover:bg-[#eef0e9] dark:text-[#9cb09c] dark:hover:bg-[#202d21]"><X size={18} /></button>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#8e968b] dark:text-[#9cb09c]">Your team leader shared a unique 6-digit PIN. Enter it here to confirm your membership.</p>
            <input
              type="text"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              className="mt-5 w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-center font-mono text-2xl font-bold tracking-widest outline-none ring-[#b8f34a] transition focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
              placeholder="000000"
              autoFocus
            />
            <Button variant="dark" className="mt-4 w-full" onClick={verifyPin}>
              {pinLoading ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              Verify PIN
            </Button>
            <p className="mt-3 text-center text-[10px] text-[#a0a69d]">PIN can only be used once and expires when the team is finalized.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── PaymentsView ────────────────────────────────────────────────────────── */
function PaymentsView({ teams, onOpenPayment }: { teams: any[]; onOpenPayment: (team: any) => void }) {
  const [payments, setPayments] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    fetch(`/api/users/${user.id}/payments`)
      .then((r) => r.json())
      .then((d) => setPayments(d.payments ?? []))
      .catch(() => {});
  }, [user]);

  const pendingTeam = teams.find((t) => t.status === "payment_pending");

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><WalletCards size={13} /> Money, clearly</div>
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20]">Payments & receipts.</h1>
        <p className="mt-2 text-sm leading-6 text-[#899087]">One clean place for team fees, payment terms, coupons, and official receipts.</p>
      </div>

      {pendingTeam && (
        <Surface className="overflow-hidden">
          <div className="flex flex-col gap-5 bg-[#fff7e5] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border dark:border-[#423218] dark:bg-[#251d10]">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffe6af] text-[#b57419] dark:bg-[#382810] dark:text-[#f8d070]"><Clock3 size={18} /></div>
              <div>
                <StatusPill tone="amber">Payment pending</StatusPill>
                <div className="mt-2 text-lg font-extrabold tracking-[-0.03em] text-[#543c18] dark:text-[#f8d070]">{pendingTeam.competitionId}</div>
                <div className="mt-1 text-xs text-[#92723c] dark:text-[#c4a06a]">Due soon · team payment</div>
              </div>
            </div>
            <Button variant="dark" onClick={() => onOpenPayment(pendingTeam)}>Review & pay <ArrowUpRight size={15} /></Button>
          </div>
        </Surface>
      )}

      <Surface>
        <div className="border-b border-[#eeeee8] px-5 py-4 sm:px-6 dark:border-[#273528]"><h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20] dark:text-[#e8efe3]">Payment history</h2></div>
        {payments.length === 0 ? (
          <div className="py-10 text-center text-sm text-[#969b94] dark:text-[#9cb09c]">No payments yet.</div>
        ) : (
          <div className="divide-y divide-[#f0efe9] dark:divide-[#273528]">
            {payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
                <div className={cn("grid h-9 w-9 place-items-center rounded-xl", p.status === "paid" ? "bg-[#edf8d7] text-[#6e9c2d] dark:bg-[#1a2d18] dark:text-[#b8f34a]" : "bg-[#f3f3ef] text-[#888d85] dark:bg-[#1f2820] dark:text-[#9cb09c]")}><ReceiptText size={16} /></div>
                <div className="min-w-[180px] flex-1">
                  <div className="text-xs font-bold text-[#364036] dark:text-[#e8efe3]">{p.competitionId} · {p.type === "individual" ? "Individual" : "Team"}</div>
                  <div className="mt-1 text-[11px] text-[#969b94] dark:text-[#9cb09c]">{p.paidAt ? `Paid ${new Date(p.paidAt).toLocaleDateString()}` : "Pending"} · {p.transactionId ?? "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-[#374338] dark:text-[#e8efe3]">₹{((p.finalAmount ?? 0) / 100).toLocaleString("en-IN")}</div>
                  <div className={cn("text-[10px] font-bold", p.status === "paid" ? "text-[#6d9c2d] dark:text-[#b8f34a]" : p.status === "waived" ? "text-[#8b9089] dark:text-[#9cb09c]" : "text-[#af701a] dark:text-[#f8d070]")}>{p.status}</div>
                </div>
                {p.receiptUrl && <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => window.open(p.receiptUrl, "_blank")}><Download size={13} /> Receipt</Button>}
              </div>
            ))}
          </div>
        )}
      </Surface>
      <div className="flex items-center gap-2 text-[11px] leading-5 text-[#939990] dark:text-[#9cb09c]"><LockKeyhole size={13} /> Participant withdrawal does not generate a refund. Competition cancellation is the exception and refunds original payments automatically.</div>
    </div>
  );
}

/* ── CertificatesView ────────────────────────────────────────────────────── */
function CertificatesView({ onOpenShowcase }: { onOpenShowcase: () => void }) {
  const [certs, setCerts] = useState<any[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    fetch(`/api/users/${user.id}/certificates`)
      .then((r) => r.json())
      .then((d) => setCerts(d.certificates ?? []))
      .catch(() => {});
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><Award size={13} /> Proof of work</div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20] dark:text-[#e8efe3]">Your certificates.</h1>
          <p className="mt-2 text-sm leading-6 text-[#899087] dark:text-[#9cb09c]">The work happened. Now take it with you.</p>
        </div>
        <Button variant="outline" onClick={onOpenShowcase}><ExternalLink size={15} /> View showcase</Button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {certs.length === 0 ? (
          <>
            <div className="certificate-card relative overflow-hidden rounded-2xl bg-[#1a283f] p-5 text-white shadow-[0_15px_32px_rgba(32,53,85,.15)]">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[22px] border-[#b8f34a]/15" />
              <div className="relative">
                <div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8f34a]">Winner</div><Award size={19} className="text-[#b8f34a]" /></div>
                <div className="mt-14 font-display text-2xl font-extrabold tracking-[-0.05em]">Campus Quiz 2026</div>
                <div className="mt-1 text-xs text-white/55">Inter-college edition · August 2026</div>
                <div className="mt-8 flex items-center justify-between border-t border-white/15 pt-4">
                  <span className="text-[10px] text-white/50">{user?.name ?? "—"}</span>
                  <button onClick={() => toast("Winner certificate downloaded.")} className="grid h-8 w-8 place-items-center rounded-lg bg-[#b8f34a] text-[#182216]"><Download size={14} /></button>
                </div>
              </div>
            </div>
            <div className="certificate-card relative overflow-hidden rounded-2xl bg-[#f4e8d0] p-5 text-[#4f3c25] shadow-[0_15px_32px_rgba(87,67,35,.1)] dark:bg-[#2a2217] dark:text-[#eedfcc]">
              <div className="absolute -bottom-14 -right-10 h-40 w-40 rounded-full border-[24px] border-[#d8ae60]/20" />
              <div className="relative">
                <div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b6b20] dark:text-[#f8d070]">Finalist</div><Award size={19} className="text-[#b7893c] dark:text-[#f8d070]" /></div>
                <div className="mt-14 font-display text-2xl font-extrabold tracking-[-0.05em]">Innovation Sprint</div>
                <div className="mt-1 text-xs text-[#927b5d] dark:text-[#c4b29a]">Product track · September 2026</div>
                <div className="mt-8 flex items-center justify-between border-t border-[#d9c49b] pt-4 dark:border-[#423422]">
                  <span className="text-[10px] text-[#927b5d] dark:text-[#c4b29a]">Team 404</span>
                  <button onClick={() => toast("Finalist certificate downloaded.")} className="grid h-8 w-8 place-items-center rounded-lg bg-[#b7893c] text-white dark:bg-[#f8d070] dark:text-[#101610]"><Download size={14} /></button>
                </div>
              </div>
            </div>
          </>
        ) : (
          certs.map((cert) => (
            <div key={cert.id} className="certificate-card relative overflow-hidden rounded-2xl bg-[#1a283f] p-5 text-white shadow-[0_15px_32px_rgba(32,53,85,.15)]">
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border-[22px] border-[#b8f34a]/15" />
              <div className="relative">
                <div className="flex items-center justify-between"><div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b8f34a]">{cert.type ?? "Participation"}</div><Award size={19} className="text-[#b8f34a]" /></div>
                <div className="mt-14 font-display text-2xl font-extrabold tracking-[-0.05em]">{cert.competitionId}</div>
                <div className="mt-1 text-xs text-white/55">{cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : "—"}</div>
                <div className="mt-8 flex items-center justify-between border-t border-white/15 pt-4">
                  <span className="text-[10px] text-white/50">{cert.userId}</span>
                  <a href={cert.downloadUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="grid h-8 w-8 place-items-center rounded-lg bg-[#b8f34a] text-[#182216]"><Download size={14} /></a>
                </div>
              </div>
            </div>
          ))
        )}
        <div className="flex min-h-[228px] flex-col justify-between rounded-2xl border border-dashed border-[#d9ddd0] bg-[#f7faef] p-5 dark:border-[#273528] dark:bg-[#131f14]">
          <div>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e6f3bd] text-[#759f32] dark:bg-[#1e331b] dark:text-[#b8f34a]"><Plus size={17} /></div>
            <div className="mt-5 font-display text-xl font-extrabold tracking-[-0.04em] text-[#415436] dark:text-[#e8efe3]">Your next one is out there.</div>
            <div className="mt-2 text-xs leading-5 text-[#83947b] dark:text-[#9cb09c]">Join a competition and start a new proof of work.</div>
          </div>
          <button onClick={onOpenShowcase} className="flex items-center gap-1 text-xs font-extrabold text-[#65902a] dark:text-[#b8f34a]">Explore showcase <ArrowUpRight size={14} /></button>
        </div>
      </div>
      <Surface className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#eaf3ff] text-[#3978bc] dark:bg-[#14263a] dark:text-[#8fc0ff]"><ShieldCheck size={17} /></div>
          <div>
            <div className="text-sm font-extrabold text-[#354035]">Certificates are tied to eligibility</div>
            <div className="mt-1 max-w-[620px] text-xs leading-5 text-[#92988f]">Some certificates depend on attendance checkpoints or reaching a final round. Downloading is never blocked by optional feedback.</div>
          </div>
        </div>
      </Surface>
    </div>
  );
}

/* ── CompetitionDetail ───────────────────────────────────────────────────── */
function CompetitionDetail({ competition, close, register }: { competition: CompCard; close: () => void; register: () => void }) {
  return (
    <div className="space-y-6">
      <button onClick={close} className="flex items-center gap-2 text-xs font-bold text-[#778078] hover:text-[#2f392f] dark:text-[#9cb09c] dark:hover:text-[#e8efe3]"><ArrowDownRight size={15} className="rotate-135" /> Back to competitions</button>
      <section className={cn("relative min-h-[320px] overflow-hidden rounded-[24px] bg-gradient-to-br p-6 text-white shadow-[0_18px_40px_rgba(31,45,28,.14)] sm:p-9", competition.color)}>
        <div className="absolute -right-10 -top-24 h-80 w-80 rounded-full border-[48px] border-white/10" />
        <div className="absolute bottom-[-150px] right-1/3 h-80 w-80 rounded-full border-[34px] border-white/8" />
        <div className="relative flex min-h-[260px] flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-sm font-black backdrop-blur-sm">{competition.logo}</div>
            <StatusPill tone="lime">Registration open</StatusPill>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/62">{competition.type} · Campus Arena</div>
            <h1 className="font-display max-w-[700px] text-5xl font-extrabold leading-[.92] tracking-[-0.07em] sm:text-6xl">{competition.name}</h1>
            <p className="mt-4 max-w-[570px] text-sm leading-6 text-white/70">{competition.detail}</p>
          </div>
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Surface className="p-5 sm:p-6">
            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl bg-[#f6f7f2] px-3 py-2.5 dark:bg-[#18231a]"><div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9a9e96] dark:text-[#7d8f7d]">Dates</div><div className="mt-1 text-xs font-extrabold text-[#384238] dark:text-[#e8efe3]">{competition.date}</div></div>
              <div className="rounded-xl bg-[#f6f7f2] px-3 py-2.5 dark:bg-[#18231a]"><div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9a9e96] dark:text-[#7d8f7d]">Deadline</div><div className="mt-1 text-xs font-extrabold text-[#b36e16] dark:text-[#f8d070]">{competition.deadline}</div></div>
              <div className="rounded-xl bg-[#f6f7f2] px-3 py-2.5 dark:bg-[#18231a]"><div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9a9e96] dark:text-[#7d8f7d]">Participation</div><div className="mt-1 text-xs font-extrabold text-[#384238] dark:text-[#e8efe3]">Teams of {competition.minTeamSize ?? 2}–{competition.maxTeamSize ?? 5}</div></div>
              <div className="rounded-xl bg-[#f6f7f2] px-3 py-2.5 dark:bg-[#18231a]"><div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#9a9e96] dark:text-[#7d8f7d]">Fee</div><div className="mt-1 text-xs font-extrabold text-[#384238] dark:text-[#e8efe3]">{competition.fee}</div></div>
            </div>
            <h2 className="mt-7 font-display text-2xl font-extrabold tracking-[-0.05em] text-[#263126] dark:text-[#e8efe3]">Make a dent, not just a deck.</h2>
            <p className="mt-3 text-sm leading-6 text-[#7f887e] dark:text-[#9cb09c]">Bring a real campus or community problem and build the smallest thing that proves your idea. You'll get mentor office hours, a feedback circle, and a room full of people who want to see you ship.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#e8e9e1] p-3 dark:border-[#273528] dark:bg-[#131d14]"><Sparkles size={16} className="text-[#7aa72f] dark:text-[#b8f34a]" /><div className="mt-3 text-xs font-bold text-[#4b574a] dark:text-[#e8efe3]">Mentor hours</div><div className="mt-1 text-[11px] text-[#969e94] dark:text-[#9cb09c]">2 live feedback rounds</div></div>
              <div className="rounded-xl border border-[#e8e9e1] p-3 dark:border-[#273528] dark:bg-[#131d14]"><Users size={16} className="text-[#4c83bf] dark:text-[#8fc0ff]" /><div className="mt-3 text-xs font-bold text-[#4b574a] dark:text-[#e8efe3]">Build together</div><div className="mt-1 text-[11px] text-[#969e94] dark:text-[#9cb09c]">Team formation supported</div></div>
              <div className="rounded-xl border border-[#e8e9e1] p-3 dark:border-[#273528] dark:bg-[#131d14]"><Trophy size={16} className="text-[#c68124] dark:text-[#f8d070]" /><div className="mt-3 text-xs font-bold text-[#4b574a] dark:text-[#e8efe3]">Showcase day</div><div className="mt-1 text-[11px] text-[#969e94] dark:text-[#9cb09c]">Top 10 go live on stage</div></div>
            </div>
          </Surface>
          <Surface className="p-5 sm:p-6">
            <div className="flex items-center justify-between"><h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#263126] dark:text-[#e8efe3]">How it unfolds</h2><span className="text-xs font-bold text-[#9a9e96] dark:text-[#7d8f7d]">3 rounds</span></div>
            <div className="mt-5 space-y-0">
              {[["01", "Registration & team formation", "Create or join your team"], ["02", "Concept note", "Short written submission"], ["03", "Demo day", "Top teams present live"]].map(([number, title, detail]) => (
                <div key={number} className="flex gap-4 border-l border-[#e1e5da] pb-5 pl-5 last:pb-0 dark:border-[#273528]">
                  <div className="relative -ml-[29px] grid h-7 w-7 shrink-0 place-items-center rounded-full border-4 border-white bg-[#b8f34a] text-[9px] font-black text-[#4d6e1d] dark:border-[#162018] dark:text-[#101610]">{number}</div>
                  <div><div className="text-sm font-extrabold text-[#455145] dark:text-[#e8efe3]">{title}</div><div className="mt-1 text-xs text-[#92998f] dark:text-[#9cb09c]">{detail}</div></div>
                </div>
              ))}
            </div>
          </Surface>
        </div>
        <div className="space-y-6">
          <Surface className="sticky top-[100px] overflow-hidden">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9da39a] dark:text-[#7d8f7d]">Capacity</div><div className="mt-1 font-display text-3xl font-extrabold tracking-[-0.06em] text-[#273227] dark:text-[#e8efe3]">{competition.spots}</div></div>
                <Gauge size={21} className="text-[#76a32d] dark:text-[#b8f34a]" />
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#eff1e9] dark:bg-[#253426]"><div className="h-full w-[68%] rounded-full bg-[#9fcf4e]" /></div>
              <Button variant="lime" className="mt-6 w-full" onClick={register}>Register now <ArrowUpRight size={15} /></Button>
              <div className="mt-3 text-center text-[10px] leading-4 text-[#9ca299] dark:text-[#7d8f7d]">You'll choose a team path next. No payment yet.</div>
            </div>
            <div className="border-t border-[#eeeee8] bg-[#fbfcf7] p-5 dark:border-[#273528] dark:bg-[#131d14]">
              <div className="flex items-start gap-2.5">
                <CircleHelp size={15} className="mt-0.5 shrink-0 text-[#7d9f3c] dark:text-[#b8f34a]" />
                <div className="text-[11px] leading-5 text-[#7d8878] dark:text-[#9cb09c]">Team code never joins someone automatically. Every member is confirmed by the Team Leader.</div>
              </div>
            </div>
          </Surface>
          <Surface className="p-5">
            <div className="flex items-center gap-2"><BookOpen size={16} className="text-[#4c83bf] dark:text-[#8fc0ff]" /><div className="text-sm font-extrabold text-[#455145] dark:text-[#e8efe3]">Before you register</div></div>
            <div className="mt-3 space-y-2.5 text-xs text-[#7d867c] dark:text-[#d0ded0]">
              <div className="flex gap-2"><Check size={14} className="shrink-0 text-[#7aa72f] dark:text-[#b8f34a]" />Verified college students only</div>
              <div className="flex gap-2"><Check size={14} className="shrink-0 text-[#7aa72f] dark:text-[#b8f34a]" />Teams of 2–5, same rules for all</div>
              <div className="flex gap-2"><Check size={14} className="shrink-0 text-[#7aa72f] dark:text-[#b8f34a]" />Payment is one team transaction</div>
            </div>
          </Surface>
        </div>
      </div>
    </div>
  );
}

/* ── RegisterModal ───────────────────────────────────────────────────────── */
function RegisterModal({ competition, close, onFindTeam }: { competition: CompCard; close: () => void; onFindTeam: () => void }) {
  const [step, setStep] = useState(1);
  const [teamName, setTeamName] = useState("");
  const [teamDesc, setTeamDesc] = useState("");
  const [joinMode, setJoinMode] = useState<"open" | "approval">("open");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  async function createTeam() {
    if (!teamName.trim() || !user) { toast.error("Team name is required."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: competition.id, name: teamName, description: teamDesc, joinMode, leaderId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create team");
      toast.success(`Team "${teamName}" created! Share your team code: ${data.team?.code ?? "—"}`);
      close();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/45 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-[540px] overflow-y-auto rounded-3xl border border-white/50 bg-[#fbfcf7] shadow-2xl dark:border-[#273528] dark:bg-[#142016]">
        <div className="flex items-start justify-between border-b border-[#e9ece2] p-5 sm:p-6 dark:border-[#273528]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7aa32e] dark:text-[#b8f34a]">Registration · step {step} of 2</div>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.05em] text-[#263126] dark:text-[#e8efe3]">Join {competition.name}</h2>
            <p className="mt-1 text-xs text-[#8e968b] dark:text-[#9cb09c]">You can form a team now or finish it later.</p>
          </div>
          <button onClick={close} className="rounded-lg p-2 text-[#929a91] hover:bg-[#eef0e9] dark:text-[#9cb09c] dark:hover:bg-[#202d21]"><X size={18} /></button>
        </div>
        <div className="p-5 sm:p-6">
          {step === 1 ? (
            <>
              <div className="space-y-3">
                <button onClick={() => setStep(2)} className="flex w-full items-center gap-4 rounded-2xl border-2 border-[#b8f34a] bg-[#f4fbdc] p-4 text-left dark:border-[#528020] dark:bg-[#1a2e18]">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#dff2ab] text-[#6c9829] dark:bg-[#253d1e] dark:text-[#b8f34a]"><Users size={18} /></div>
                  <div className="flex-1"><div className="text-sm font-extrabold text-[#374536] dark:text-[#e8efe3]">Register with a new team</div><div className="mt-1 text-xs text-[#83927b] dark:text-[#9cb09c]">Create the room for your idea.</div></div>
                  <ChevronRight size={18} className="text-[#779f32] dark:text-[#b8f34a]" />
                </button>
                <button onClick={() => { close(); onFindTeam(); }} className="flex w-full items-center gap-4 rounded-2xl border border-[#e2e5dc] bg-white p-4 text-left hover:border-[#b9c8a0] dark:border-[#273528] dark:bg-[#162018] dark:hover:border-[#385038]">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf5ff] text-[#3e7dbd] dark:bg-[#14263a] dark:text-[#8fc0ff]"><Search size={18} /></div>
                  <div className="flex-1"><div className="text-sm font-extrabold text-[#374536] dark:text-[#e8efe3]">Find an existing team</div><div className="mt-1 text-xs text-[#83927b] dark:text-[#9cb09c]">Browse open teams. Leader confirms you.</div></div>
                  <ChevronRight size={18} className="text-[#a6ada3] dark:text-[#7d8f7d]" />
                </button>
                <button onClick={() => toast("Individual registration — you'll be matched with a team.")} className="flex w-full items-center gap-4 rounded-2xl border border-[#e2e5dc] bg-white p-4 text-left hover:border-[#b9c8a0] dark:border-[#273528] dark:bg-[#162018] dark:hover:border-[#385038]">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff5e3] text-[#b8791e] dark:bg-[#342410] dark:text-[#f8d070]"><Users size={18} /></div>
                  <div className="flex-1"><div className="text-sm font-extrabold text-[#374536] dark:text-[#e8efe3]">Register individually</div><div className="mt-1 text-xs text-[#83927b] dark:text-[#9cb09c]">We'll help you find a team during formation.</div></div>
                  <ChevronRight size={18} className="text-[#a6ada3] dark:text-[#7d8f7d]" />
                </button>
              </div>
              <div className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#92998f] dark:text-[#9cb09c]"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#79a52f] dark:text-[#b8f34a]" />Your permanent student profile is reused. Competition registration details stay specific to this event.</div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Team name</span><input autoFocus value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] transition focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]" placeholder="e.g. Ctrl + Alt + Elite" /></label>
                <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Team description <span className="font-normal text-[#adb3aa] dark:text-[#7d8f7d]">(optional)</span></span><textarea value={teamDesc} onChange={(e) => setTeamDesc(e.target.value)} className="min-h-[90px] w-full resize-none rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] transition focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]" placeholder="What are you hoping to build?" /></label>
                <div>
                  <span className="mb-2 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Join mode</span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button onClick={() => setJoinMode("open")} className={cn("rounded-xl border-2 p-3 text-left", joinMode === "open" ? "border-[#b8f34a] bg-[#f4fbdc] dark:border-[#528020] dark:bg-[#1a2e18]" : "border-[#dfe4d8] bg-white dark:border-[#273528] dark:bg-[#162018]")}><div className="text-xs font-extrabold text-[#45583d] dark:text-[#e8efe3]">Open</div><div className="mt-1 text-[10px] leading-4 text-[#849677] dark:text-[#9cb09c]">Students can request to join.</div></button>
                    <button onClick={() => setJoinMode("approval")} className={cn("rounded-xl border p-3 text-left", joinMode === "approval" ? "border-[#b8f34a] bg-[#f4fbdc] dark:border-[#528020] dark:bg-[#1a2e18]" : "border-[#dfe4d8] bg-white dark:border-[#273528] dark:bg-[#162018]")}><div className="text-xs font-extrabold text-[#45583d] dark:text-[#e8efe3]">Approval required</div><div className="mt-1 text-[10px] leading-4 text-[#849677] dark:text-[#9cb09c]">You approve every request.</div></button>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-[#fff7e5] p-3.5 text-[11px] leading-5 text-[#846c3d] dark:border dark:border-[#423218] dark:bg-[#251d10] dark:text-[#f8d070]">Your unique team code will be permanent. Sharing it sends a request — it never automatically adds a member.</div>
              <div className="mt-6 flex items-center justify-between gap-3">
                <button onClick={() => setStep(1)} className="text-xs font-bold text-[#8f978c] dark:text-[#9cb09c]">Back</button>
                <Button variant="dark" onClick={createTeam}>
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUpRight size={15} />}
                  Create team draft
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Organizer views (unchanged from static, kept in full) ───────────────── */
function OrganizerOverview({ setActive }: { setActive: (v: OrganizerView) => void }) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[24px] bg-[#172017] p-6 text-white shadow-[0_18px_40px_rgba(31,45,28,.14)] sm:p-8">
        <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[46px] border-[#b8f34a]/12" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#d9ebbb]"><span className="h-1.5 w-1.5 rounded-full bg-[#b8f34a]" />Organizer control center</div>
            <h1 className="font-display text-[38px] font-extrabold leading-[.95] tracking-[-0.07em] sm:text-[49px]">Run the room.<br /><span className="text-[#b8f34a]">Keep the signal.</span></h1>
            <p className="mt-4 max-w-[520px] text-sm leading-6 text-white/60">One view for the decisions that keep Build for Bharat moving: registrations, teams, submissions, and the people waiting on you.</p>
          </div>
          <div className="min-w-[220px] rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Live competition</div>
            <div className="mt-2 font-display text-xl font-extrabold tracking-[-0.04em]">Build for Bharat</div>
            <div className="mt-1 text-xs text-white/55">Registration open · 18–20 Oct</div>
            <div className="mt-4 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[68%] rounded-full bg-[#b8f34a]" /></div><span className="text-[10px] font-bold text-[#b8f34a]">68%</span></div>
          </div>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registrations" value="82" meta="of 124 capacity" icon={ClipboardCheck} tone="lime" trend="+14 this week" />
        <StatCard label="Teams formed" value="31" meta="4 incomplete" icon={Users} tone="blue" trend="+6 this week" />
        <StatCard label="Submissions" value="18" meta="of 31 teams" icon={FileCheck2} tone="amber" />
        <StatCard label="Judging progress" value="64%" meta="12 of 18 reviewed" icon={Gauge} tone="rose" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <Surface className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#eeeee8] px-5 py-4 sm:px-6">
            <div><h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20]">What needs your attention</h2><p className="mt-1 text-xs text-[#90968d]">The next decisions, in priority order.</p></div>
            <StatusPill tone="rose">4 open actions</StatusPill>
          </div>
          <div className="divide-y divide-[#f0efe9]">
            {([["Teams", "4 teams are below minimum size", "Review requests", Users, "amber"], ["Submissions", "Concept note deadline in 4 days", "Open round", FileText, "blue"], ["Payments", "3 teams have overdue payments", "View payments", CreditCard, "rose"], ["Setup", "Certificates are not configured yet", "Finish setup", Award, "lime"]] as const).map(([eyebrow, title, action, Icon, tone]) => (
              <div key={title} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", tone === "rose" ? "bg-[#fff0ef] text-[#bd5b5d]" : tone === "amber" ? "bg-[#fff7e5] text-[#b9781d]" : tone === "blue" ? "bg-[#edf5ff] text-[#3e7bb9]" : "bg-[#eff8d9] text-[#6f9b2b]")}><Icon size={16} /></div>
                <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a2a79f]">{eyebrow}</div><div className="mt-1 truncate text-xs font-bold text-[#3a443a]">{title}</div></div>
                <button onClick={() => { if (eyebrow === "Teams") setActive("teams"); else if (eyebrow === "Submissions") setActive("submissions"); else if (eyebrow === "Setup") setActive("setup"); else toast("Payments workspace opened."); }} className="shrink-0 text-[10px] font-extrabold text-[#668f2b]">{action} <ChevronRight size={12} className="inline" /></button>
              </div>
            ))}
          </div>
        </Surface>
        <div className="space-y-6">
          <Surface className="p-5 sm:p-6">
            <div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><Activity size={16} className="text-[#3e7bb9]" /><h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20]">Registration pulse</h2></div><div className="mt-1 text-xs text-[#90968d]">Last 7 days · all tracks</div></div><ArrowUpRight size={16} className="text-[#72a12f]" /></div>
            <div className="mt-5 flex h-[82px] items-end gap-1.5">{[28, 36, 30, 48, 58, 52, 72, 63, 80, 68, 86, 92, 78, 96].map((height, index) => <div key={index} className={cn("flex-1 rounded-t-sm transition-all", index > 8 ? "bg-[#b8f34a]" : "bg-[#d8e6bd]")} style={{ height: `${height}%` }} />)}</div>
            <div className="mt-3 flex justify-between text-[10px] font-semibold text-[#b0b4ad]"><span>09 Sep</span><span>Today</span></div>
          </Surface>
          <Surface className="p-5 sm:p-6">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Bell size={16} className="text-[#c98021]" /><h2 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#202a20]">Latest announcement</h2></div><button onClick={() => toast("Announcement composer opened.")} className="text-[10px] font-extrabold text-[#67912a]">Compose</button></div>
            <div className="mt-4 rounded-xl bg-[#fff7e5] p-3.5"><div className="text-xs font-extrabold text-[#654b22]">Mentor office hours are live</div><div className="mt-1 text-[11px] leading-5 text-[#927949]">Sent to all registered teams · 2h ago</div><button onClick={() => toast("Announcement details opened.")} className="mt-3 text-[10px] font-extrabold text-[#ae761c]">View announcement <ArrowUpRight size={11} className="inline" /></button></div>
          </Surface>
        </div>
      </div>
    </div>
  );
}

function SetupView({ setActive }: { setActive: (v: OrganizerView) => void }) {
  const steps = [["Basic information", "Brand, overview, eligibility", true], ["Schedule & rounds", "3 rounds configured", true], ["Registration form", "8 fields · ready", true], ["Payment", "₹500 base + add-ons", true], ["Submission", "Concept note form", true], ["Judging", "12 judges · 4 criteria", true], ["Certificates & results", "Not configured", false], ["Notifications", "3 templates ready", true]] as const;
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><Settings2 size={13} /> Configuration</div><h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20]">Competition setup.</h1><p className="mt-2 text-sm leading-6 text-[#899087]">Build for Bharat is 88% ready. Finish the one thing that affects your participant experience next.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => toast("Preview opened.")}><ExternalLink size={15} /> Preview</Button><Button variant="lime" onClick={() => toast("Competition published.")}><Globe2 size={15} /> Publish changes</Button></div>
      </div>
      <Surface className="overflow-hidden">
        <div className="flex flex-col gap-4 bg-[#f2fbdc] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dff2ab] text-[#6d992b]"><ListChecks size={18} /></div><div><div className="text-sm font-extrabold text-[#3c532b]">Setup health · nearly there</div><div className="mt-1 text-xs leading-5 text-[#73845f]">Registration-ready information is complete. Certificate setup can happen after the competition.</div></div></div>
          <div className="min-w-[170px]"><div className="flex items-center justify-between text-[10px] font-bold text-[#6e872e]"><span>Overall completeness</span><span>88%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dcebb5]"><div className="h-full w-[88%] rounded-full bg-[#87b638]" /></div></div>
        </div>
        <div className="grid gap-0 md:grid-cols-2">
          {steps.map(([title, detail, done], index) => (
            <button key={title} onClick={() => toast(`${title} editor opened.`)} className="flex items-center gap-4 border-b border-[#f0f0ea] p-5 text-left transition-colors hover:bg-[#fbfcf7] md:[&:nth-child(odd)]:border-r">
              <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", done ? "bg-[#eef8d7] text-[#70a02d]" : "bg-[#fff5df] text-[#b7791c]")}>{done ? <Check size={16} /> : <span className="text-xs font-black">{index + 1}</span>}</div>
              <div className="min-w-0 flex-1"><div className="text-sm font-extrabold text-[#384338]">{title}</div><div className="mt-1 text-xs text-[#969e94]">{detail}</div></div>
              <ChevronRight size={16} className="text-[#b3b8ae]" />
            </button>
          ))}
        </div>
      </Surface>
    </div>
  );
}

function OrganizerTeamsView({ openTeam }: { openTeam: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><Users size={13} /> Operations</div><h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20]">Teams & requests.</h1><p className="mt-2 text-sm leading-6 text-[#899087]">Make the next team decision obvious. Every action stays in the audit trail.</p></div>
        <Button variant="dark" onClick={() => toast("Bulk team reminder sent.")}><Bell size={15} /> Send reminders</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active teams" value="31" meta="+6 this week" icon={Users} tone="lime" />
        <StatCard label="Awaiting action" value="07" meta="leader or organizer" icon={Clock3} tone="amber" />
        <StatCard label="Waitlist" value="14" meta="first come, first served" icon={ListChecks} tone="blue" />
      </div>
      <Surface className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#eeeee8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-[#273528]">
          <div><h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#263126] dark:text-[#e8efe3]">Team queue</h2><p className="mt-1 text-xs text-[#92998f] dark:text-[#9cb09c]">Prioritized by deadlines and blocked progress.</p></div>
          <div className="flex gap-2"><button onClick={() => toast("Filters opened.")} className="inline-flex items-center gap-2 rounded-xl border border-[#deded8] bg-white px-3 py-2 text-xs font-bold text-[#697168] dark:border-[#273528] dark:bg-[#162018] dark:text-[#9cb09c]"><Filter size={14} /> Filter</button><button onClick={() => toast("Export prepared.")} className="inline-flex items-center gap-2 rounded-xl border border-[#deded8] bg-white px-3 py-2 text-xs font-bold text-[#697168] dark:border-[#273528] dark:bg-[#162018] dark:text-[#9cb09c]"><Download size={14} /> Export</button></div>
        </div>
        <div className="hidden grid-cols-[1.4fr_.7fr_.7fr_.75fr_100px] gap-4 border-b border-[#f0efe9] bg-[#fbfcf8] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#a0a69d] md:grid dark:border-[#273528] dark:bg-[#131d14] dark:text-[#7d8f7d]"><span>Team</span><span>Track</span><span>Members</span><span>Status</span><span /></div>
        {(([["Ctrl + Alt + Elite", "Product", "3 / 5", "Awaiting verify", "amber", "AS"], ["Greenroom", "Design", "4 / 4", "Registered", "lime", "NS"], ["The Loop", "Climate", "2 / 5", "Incomplete", "rose", "MP"], ["404 Not Found", "Open track", "5 / 5", "Payment pending", "blue", "DV"]] as const)).map(([name, track, members, status, tone, initials]) => (
          <button key={name} onClick={openTeam} className="grid w-full gap-3 border-b border-[#f0efe9] px-5 py-4 text-left transition-colors hover:bg-[#fbfcf8] md:grid-cols-[1.4fr_.7fr_.7fr_.75fr_100px] md:items-center md:gap-4 md:px-6 dark:border-[#273528] dark:hover:bg-[#182418]">
            <div className="flex items-center gap-3"><Avatar initials={initials} /><div><div className="text-xs font-extrabold text-[#3b463b] dark:text-[#e8efe3]">{name}</div><div className="mt-1 text-[10px] text-[#a1a69f] dark:text-[#7d8f7d]">Leader · 2h ago</div></div></div>
            <div className="pl-12 text-[11px] font-semibold text-[#737d72] md:pl-0 dark:text-[#9cb09c]">{track}</div>
            <div className="pl-12 text-[11px] font-semibold text-[#737d72] md:pl-0 dark:text-[#9cb09c]">{members}</div>
            <div className="pl-12 md:pl-0"><StatusPill tone={tone as any}>{status}</StatusPill></div>
            <div className="hidden justify-end text-[10px] font-extrabold text-[#68952a] md:flex dark:text-[#b8f34a]">Open <ChevronRight size={13} /></div>
          </button>
        ))}
      </Surface>
    </div>
  );
}

function OrganizerSubmissionsView() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><FileCheck2 size={13} /> Round 02 · Concept note</div><h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20] dark:text-[#e8efe3]">Submission room.</h1><p className="mt-2 text-sm leading-6 text-[#899087] dark:text-[#9cb09c]">A calm view of what is in, what is blocked, and what needs a nudge.</p></div>
        <Button variant="outline" onClick={() => toast("Submission deadline editor opened.")}><Clock3 size={15} /> Edit deadline</Button>
      </div>
      <Surface className="p-5 sm:p-6">
        <div className="grid gap-5 md:grid-cols-3">
          <div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9da39a] dark:text-[#7d8f7d]">Submitted</div><div className="mt-1 font-display text-3xl font-extrabold tracking-[-0.06em] text-[#2f3b2f] dark:text-[#e8efe3]">18 / 31</div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef0e9] dark:bg-[#253426]"><div className="h-full w-[58%] rounded-full bg-[#9fcf4e]" /></div><div className="mt-2 text-[10px] font-semibold text-[#92998f] dark:text-[#9cb09c]">58% of registered teams</div></div>
          <div className="border-t border-[#eeeee8] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0 dark:border-[#273528]"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9da39a] dark:text-[#7d8f7d]">Need attention</div><div className="mt-1 font-display text-3xl font-extrabold tracking-[-0.06em] text-[#b36e17] dark:text-[#f8d070]">07</div><div className="mt-2 text-xs leading-5 text-[#92998f] dark:text-[#9cb09c]">Teams with missing files or invalid URLs.</div></div>
          <div className="border-t border-[#eeeee8] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0 dark:border-[#273528]"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9da39a] dark:text-[#7d8f7d]">Deadline</div><div className="mt-1 font-display text-3xl font-extrabold tracking-[-0.06em] text-[#2f3b2f] dark:text-[#e8efe3]">4 days</div><div className="mt-2 text-xs leading-5 text-[#92998f] dark:text-[#9cb09c]">24 Sep 2026 · 23:59 IST</div></div>
        </div>
      </Surface>
      <Surface className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#eeeee8] px-5 py-4 sm:px-6 dark:border-[#273528]"><div><h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#263126] dark:text-[#e8efe3]">Latest submissions</h2><p className="mt-1 text-xs text-[#92998f] dark:text-[#9cb09c]">Files are validated, scanned, and preview-ready.</p></div><button onClick={() => toast("Submission form builder opened.")} className="text-xs font-extrabold text-[#67912a] dark:text-[#b8f34a]">Edit form <ChevronRight size={14} className="inline" /></button></div>
        {([["Greenroom", "Sustainable campus toolkit", "Submitted 2h ago", "Valid", "lime"], ["404 Not Found", "Open-source mental health buddy", "Submitted yesterday", "Valid", "lime"], ["Ctrl + Alt + Elite", "Pending upload", "Started 3h ago", "Incomplete", "amber"], ["The Loop", "Broken demo URL", "Submitted yesterday", "Needs review", "rose"]] as const).map(([name, project, detail, status, tone]) => (
          <button key={name} onClick={() => toast(`${name} submission opened.`)} className="flex w-full items-center gap-3 border-b border-[#f0efe9] px-5 py-4 text-left transition-colors hover:bg-[#fbfcf8] sm:px-6 dark:border-[#273528] dark:hover:bg-[#182418]">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef4e6] text-[#739c35] dark:bg-[#1e331b] dark:text-[#b8f34a]"><FileText size={16} /></div>
            <div className="min-w-0 flex-1"><div className="truncate text-xs font-extrabold text-[#3b463b] dark:text-[#e8efe3]">{name} <span className="font-normal text-[#a2a79f] dark:text-[#7d8f7d]">· {project}</span></div><div className="mt-1 text-[10px] text-[#989f96] dark:text-[#9cb09c]">{detail}</div></div>
            <StatusPill tone={tone as any}>{status}</StatusPill>
            <ChevronRight size={15} className="text-[#adb2a9] dark:text-[#7d8f7d]" />
          </button>
        ))}
      </Surface>
    </div>
  );
}

function AttendanceView({ onOpenQRScanner }: { onOpenQRScanner: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]"><QrCode size={13} /> On the ground</div><h1 className="font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20] dark:text-[#e8efe3]">Attendance.</h1><p className="mt-2 text-sm leading-6 text-[#899087] dark:text-[#9cb09c]">Fast check-ins with a clear record of who scanned what, when, and where.</p></div>
        <Button variant="dark" onClick={onOpenQRScanner}><QrCode size={15} /> Open scanner</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Checked in today" value="69" meta="of 82 registered" icon={ClipboardCheck} tone="lime" trend="84%" />
        <StatCard label="Checkpoints live" value="02" meta="Opening · Round 1" icon={QrCode} tone="blue" />
        <StatCard label="Exceptions" value="03" meta="payment or access" icon={CircleHelp} tone="amber" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <Surface className="overflow-hidden">
          <div className="border-b border-[#eeeee8] px-5 py-4 sm:px-6 dark:border-[#273528]"><h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#263126] dark:text-[#e8efe3]">Today's checkpoints</h2></div>
          <div className="divide-y divide-[#f0efe9] dark:divide-[#273528]">
            {([["Day 1 opening", "10:00–11:00 · Main auditorium", "69 / 82 checked in", "live", "lime"], ["Round 1", "14:00–15:30 · Lab block", "Not started", "upcoming", "blue"], ["Mentor circle", "17:00–18:00 · Studio 4", "Not started", "upcoming", "blue"]] as const).map(([title, detail, count, status, tone]) => (
              <div key={title} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#edf5ff] text-[#3d7bbb] dark:bg-[#14263a] dark:text-[#8fc0ff]"><QrCode size={16} /></div>
                <div className="min-w-0 flex-1"><div className="text-xs font-extrabold text-[#3a443a] dark:text-[#e8efe3]">{title}</div><div className="mt-1 text-[10px] text-[#969e94] dark:text-[#9cb09c]">{detail}</div></div>
                <div className="hidden text-right sm:block"><div className="text-xs font-bold text-[#4d5a4b] dark:text-[#e8efe3]">{count}</div><div className="mt-1 text-[10px] text-[#9da49b] dark:text-[#7d8f7d]">{status}</div></div>
                <StatusPill tone={tone as any}>{status}</StatusPill>
              </div>
            ))}
          </div>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-[#719d2a] dark:text-[#b8f34a]" /><h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#263126] dark:text-[#e8efe3]">Scanner rules</h2></div>
          <div className="mt-5 space-y-3 text-xs leading-5 text-[#7e887c] dark:text-[#9cb09c]">
            <div className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[#79a62f] dark:text-[#b8f34a]" />QR encodes a secure registration identifier.</div>
            <div className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[#79a62f] dark:text-[#b8f34a]" />Personal information is never exposed in the QR.</div>
            <div className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[#79a62f] dark:text-[#b8f34a]" />Already checked-in participants show a clear warning.</div>
            <div className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0 text-[#79a62f] dark:text-[#b8f34a]" />Every scan records staff identity and timestamp.</div>
          </div>
          <button onClick={onOpenQRScanner} className="mt-6 flex items-center gap-1 text-xs font-extrabold text-[#68952a] dark:text-[#b8f34a]">Open scanner <ArrowUpRight size={14} /></button>
        </Surface>
      </div>
    </div>
  );
}

function TeamDetail({ close }: { close: () => void }) {
  return (
    <div className="space-y-6">
      <button onClick={close} className="flex items-center gap-2 text-xs font-bold text-[#778078] hover:text-[#2f392f] dark:text-[#9cb09c] dark:hover:text-[#e8efe3]"><ArrowDownRight size={15} className="rotate-135" /> Back to teams</button>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><StatusPill tone="amber">Awaiting verification</StatusPill><h1 className="mt-3 font-display text-4xl font-extrabold tracking-[-0.065em] text-[#1e2a20] dark:text-[#e8efe3]">Ctrl + Alt + Elite.</h1><p className="mt-2 text-sm text-[#899087] dark:text-[#9cb09c]">Product Case League · participant team workspace</p></div>
        <Button variant="dark" onClick={() => toast("Team reminder sent.")}><Bell size={15} /> Remind Mira</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <Surface className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#263126] dark:text-[#e8efe3]">Members</h2><span className="text-xs font-bold text-[#92998f] dark:text-[#7d8f7d]">3 / 5</span></div>
          <div className="mt-5 space-y-3">
            {([["Aarav Shah", "Team Leader", "AS", "Verified", "lime"], ["Riya Kapoor", "Member", "RK", "Verified", "lime"], ["Mira Bose", "Member", "MB", "Pending PIN", "amber"]] as const).map(([name, role, initials, status, tone]) => (
              <div key={name} className="flex items-center gap-3 rounded-xl border border-[#e9ebe4] p-3 dark:border-[#273528]">
                <Avatar initials={initials} tone={name === "Mira Bose" ? "bg-[#f3dfbd] text-[#9c6824]" : name === "Riya Kapoor" ? "bg-[#ffe1c7] text-[#9e5a25]" : "bg-[#d9e8ff] text-[#245b91]"} />
                <div className="min-w-0 flex-1"><div className="text-xs font-extrabold text-[#3b463b] dark:text-[#e8efe3]">{name}</div><div className="mt-1 text-[10px] text-[#9aa198] dark:text-[#7d8f7d]">{role}</div></div>
                <StatusPill tone={tone as any}>{status}</StatusPill>
              </div>
            ))}
          </div>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <div className="flex items-center gap-2"><ListChecks size={16} className="text-[#719d2a] dark:text-[#b8f34a]" /><h2 className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#263126] dark:text-[#e8efe3]">Team checklist</h2></div>
          <div className="mt-5 space-y-3">
            {([["Minimum team size", true], ["Track selected", true], ["Registration details complete", true], ["All members verified", false], ["Required documents", true], ["Final declaration", true]] as const).map(([item, complete]) => (
              <div key={item} className="flex items-center gap-2 text-xs font-semibold text-[#667166] dark:text-[#d0ded0]">
                <span className={cn("grid h-5 w-5 place-items-center rounded-full", complete ? "bg-[#e4f4bb] text-[#6e9a2b] dark:bg-[#1e331b] dark:text-[#b8f34a]" : "border border-[#e8c57f] bg-[#fff7e5] text-[#b9781d] dark:border-[#5c441c] dark:bg-[#342410] dark:text-[#f8d070]")}>{complete ? <Check size={12} /> : <Clock3 size={11} />}</span>
                {item}
              </div>
            ))}
          </div>
          <Button variant="lime" className="mt-6 w-full" onClick={() => toast("Team leader cannot finalize until all members verify.")}>Finalize team <LockKeyhole size={14} /></Button>
          <div className="mt-3 text-center text-[10px] leading-4 text-[#a0a69d]">Locked until every member verifies their unique PIN.</div>
        </Surface>
      </div>
    </div>
  );
}

/* ── Main Home export ────────────────────────────────────────────────────── */
export default function Home() {
  const { user } = useAuth();

  // ── layout state
  const [workspace, setWorkspace] = useState<Workspace>("student");
  const [studentView, setStudentView] = useState<StudentView>("home");
  const [organizerView, setOrganizerView] = useState<OrganizerView>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── navigation state
  const [detail, setDetail] = useState<CompCard | null>(null);
  const [registering, setRegistering] = useState<CompCard | null>(null);
  const [teamDetail, setTeamDetail] = useState(false);

  // ── data state
  const [competitions, setCompetitions] = useState<CompCard[]>(STATIC_COMPETITIONS);
  const [rawCompetitions, setRawCompetitions] = useState<Competition[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── modal state
  const [showProfile, setShowProfile] = useState(false);
  const [showFindTeam, setShowFindTeam] = useState(false);
  const [showFindTeammates, setShowFindTeammates] = useState(false);
  const [paymentTeam, setPaymentTeam] = useState<any | null>(null);
  const [showDigitalPass, setShowDigitalPass] = useState(false);
  const [submissionTeam, setSubmissionTeam] = useState<any | null>(null);
  const [showShowcase, setShowShowcase] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // ── set workspace by role on first load
  useEffect(() => {
    if (!user) return;
    if (user.role === "organizer" || user.role === "faculty") setWorkspace("organizer");
    else setWorkspace("student");
  }, [user?.id]);

  // ── load competitions
  useEffect(() => {
    fetch("/api/competitions")
      .then((r) => r.json())
      .then((data) => {
        const list: any[] = data.competitions ?? data ?? [];
        if (list.length > 0) {
          setRawCompetitions(list);
          setCompetitions(list.map((c, i) => apiCompToCard(c, i)));
        }
      })
      .catch(() => {}); // fall back to static
  }, []);

  // ── load user teams & notifications
  useEffect(() => {
    if (!user?.id) return;
    fetch(`/api/users/${user.id}/teams`)
      .then((r) => r.json())
      .then((d) => setTeams(d.teams ?? []))
      .catch(() => {});
    fetch(`/api/users/${user.id}/notifications`)
      .then((r) => r.json())
      .then((d) => setNotifications(d.notifications ?? []))
      .catch(() => {});
    setDataLoaded(true);
  }, [user?.id]);

  // ── derived
  const active = workspace === "student" ? studentView : organizerView;
  const setActive = useCallback((view: StudentView | OrganizerView) => {
    if (workspace === "student") setStudentView(view as StudentView);
    else setOrganizerView(view as OrganizerView);
  }, [workspace]);

  const goOrganizer = () => { setWorkspace("organizer"); setOrganizerView("overview"); setDetail(null); setTeamDetail(false); };
  const goStudent = () => { setWorkspace("student"); setStudentView("home"); setDetail(null); setTeamDetail(false); };
  const openTeam = () => { if (workspace === "student") setTeamDetail(true); else setOrganizerView("team"); };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── if user is judge, show judge portal
  if (user?.role === "judge") {
    return <JudgePortal />;
  }

  // ── main content switch
  const content = workspace === "student"
    ? (detail
        ? <CompetitionDetail competition={detail} close={() => setDetail(null)} register={() => setRegistering(detail)} />
        : teamDetail
          ? <TeamDetail close={() => setTeamDetail(false)} />
          : studentView === "home"
            ? <StudentHome setActive={setStudentView} openCompetition={setDetail} competitions={competitions} teams={teams} onOpenProfile={() => setShowProfile(true)} onOpenFindTeam={() => setShowFindTeam(true)} />
            : studentView === "competitions"
              ? <CompetitionsView openCompetition={setDetail} competitions={competitions} />
              : studentView === "teams"
                ? <TeamsView onOpenTeam={openTeam} teams={teams} onOpenFindTeam={() => setShowFindTeam(true)} onOpenFindTeammates={() => setShowFindTeammates(true)} onOpenPayment={setPaymentTeam} onOpenSubmission={setSubmissionTeam} />
                : studentView === "payments"
                  ? <PaymentsView teams={teams} onOpenPayment={setPaymentTeam} />
                  : <CertificatesView onOpenShowcase={() => setShowShowcase(true)} />)
    : (organizerView === "overview"
        ? <OrganizerOverview setActive={setOrganizerView} />
        : organizerView === "setup"
          ? <SetupView setActive={setOrganizerView} />
          : organizerView === "teams"
            ? <OrganizerTeamsView openTeam={openTeam} />
            : organizerView === "submissions"
              ? <OrganizerSubmissionsView />
              : organizerView === "attendance"
                ? <AttendanceView onOpenQRScanner={() => toast("QR scanner ready. Camera access would open here.")} />
                : <TeamDetail close={() => setOrganizerView("teams")} />);

  return (
    <div className="app-shell relative min-h-screen overflow-x-clip bg-[#f8f8f4] text-[#253025] dark:bg-[#101610] dark:text-[#e8efe3]">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>

      <TopBar
        workspace={workspace}
        setWorkspace={(v) => v === "student" ? goStudent() : goOrganizer()}
        onMobileMenu={() => setMobileOpen(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenNotifications={() => setShowNotifications(true)}
        unreadCount={unreadCount}
      />

      <div className="mx-auto flex max-w-[1600px]">
        <Sidebar
          workspace={workspace}
          active={active}
          setActive={setActive}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          setWorkspace={(v) => v === "student" ? goStudent() : goOrganizer()}
          onOpenDigitalPass={() => setShowDigitalPass(true)}
          onOpenFindTeammates={() => setShowFindTeammates(true)}
        />
        <main className="min-w-0 flex-1 px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-9">
          <div className="mx-auto max-w-[1220px]">
            <AnimatedPage pageKey={`${workspace}-${active}-${detail?.name ?? ""}-${teamDetail ? "team" : ""}`}>
              {content}
            </AnimatedPage>
          </div>
        </main>
      </div>
      <NotificationsPanel open={showNotifications} onClose={() => setShowNotifications(false)} />

      {/* Registration modal */}
      {registering && <RegisterModal competition={registering} close={() => setRegistering(null)} onFindTeam={() => { setRegistering(null); setShowFindTeam(true); }} />}

      {/* ── Modals ── */}
      {showProfile && user && (
        <StudentProfileModal close={() => setShowProfile(false)} />
      )}
      {showFindTeam && user && (
        <FindTeamModal
          competition={rawCompetitions.find((c) => c.id === detail?.id) || rawCompetitions[0] || (STATIC_COMPETITIONS[0] as unknown as Competition)}
          close={() => setShowFindTeam(false)}
          onTeamJoined={() => {
            setShowFindTeam(false);
            if (user?.id) {
              fetch(`/api/users/${user.id}/teams`)
                .then((r) => r.json())
                .then((d) => setTeams(d.teams ?? []))
                .catch(() => {});
            }
          }}
        />
      )}
      {showFindTeammates && user && (
        <FindTeammatesModal
          competition={rawCompetitions.find((c) => c.id === detail?.id) || rawCompetitions[0] || (STATIC_COMPETITIONS[0] as unknown as Competition)}
          close={() => setShowFindTeammates(false)}
        />
      )}
      {paymentTeam && user && (
        <PaymentModal
          team={paymentTeam}
          competition={rawCompetitions.find((c) => c.id === paymentTeam.competitionId) || rawCompetitions[0] || (STATIC_COMPETITIONS[0] as unknown as Competition)}
          close={() => setPaymentTeam(null)}
          onPaymentSuccess={() => {
            setPaymentTeam(null);
            toast.success("Payment successful!");
            if (user?.id) {
              fetch(`/api/users/${user.id}/teams`)
                .then((r) => r.json())
                .then((d) => setTeams(d.teams ?? []))
                .catch(() => {});
            }
          }}
        />
      )}
      {showDigitalPass && user && (
        <DigitalPassModal
          competition={rawCompetitions.find((c) => c.id === detail?.id) || rawCompetitions[0] || (STATIC_COMPETITIONS[0] as unknown as Competition)}
          close={() => setShowDigitalPass(false)}
        />
      )}
      {submissionTeam && user && (
        <SubmissionModal
          team={submissionTeam}
          round={{
            id: "round_concept",
            competitionId: submissionTeam.competitionId,
            roundNumber: 1,
            name: "Concept Note & Architecture",
            description: "Submit your solution overview and architecture diagram",
            startDate: "2026-09-01T00:00:00Z",
            endDate: "2026-10-24T23:59:59Z",
            submissionDeadline: "2026-10-24T23:59:59Z",
            advancementMode: "score_based",
            isBlindJudging: false,
            status: "active",
          }}
          close={() => setSubmissionTeam(null)}
          onSubmitted={() => {
            setSubmissionTeam(null);
            toast.success("Submission received!");
          }}
        />
      )}
      {showShowcase && (
        <ShowcaseModal
          competition={rawCompetitions.find((c) => c.id === detail?.id) || rawCompetitions[0] || (STATIC_COMPETITIONS[0] as unknown as Competition)}
          close={() => setShowShowcase(false)}
        />
      )}
    </div>
  );
}
