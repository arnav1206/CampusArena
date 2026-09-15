// =============================================================================
// Campus Arena — User Profile Page (Full standalone route /profile)
// =============================================================================

import React, { useState, useEffect } from "react";
import { animated, useSpring } from "@react-spring/web";
import {
  ArrowLeft,
  Award,
  Briefcase,
  Camera,
  Check,
  Code2,
  Edit3,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  Loader2,
  LogOut,
  Moon,
  Save,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
  User,
  Users,
  X,
  PlusCircle,
  Trash2,
  Star,
  Mail,
  Smartphone,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { toast } from "sonner";
import type { StudentProfile } from "@shared/types";

const TECHNICAL_SKILLS_OPTS = [
  "React", "TypeScript", "Python", "Node.js", "Next.js", "PostgreSQL",
  "MongoDB", "Docker", "Figma", "FastAPI", "TensorFlow", "Machine Learning",
  "Embedded C", "IoT", "AWS", "GCP", "Flutter", "Swift", "Kotlin",
  "Tailwind CSS", "GraphQL", "Redis", "Kubernetes", "Rust",
];

const NON_TECHNICAL_SKILLS_OPTS = [
  "Product Management", "Pitching", "UI/UX Thinking", "User Research",
  "Technical Writing", "Public Speaking", "Storytelling", "System Design",
  "Project Management", "Marketing", "Financial Modelling", "Leadership",
];

const DOMAIN_OPTS = [
  "Web3", "Developer Tools", "AI Systems", "FinTech", "EdTech",
  "CleanTech", "HealthTech", "Social Impact", "Robotics", "Smart Cities",
  "Cybersecurity", "Cloud Architecture", "Design Tools", "Consumer Apps",
  "E-Commerce", "Blockchain",
];

const YEAR_OPTS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Postgrad"];
const BRANCH_OPTS = [
  "Computer Science & Engineering",
  "Electronics & Communication",
  "Design & Interaction",
  "Information Technology",
  "Mechanical Engineering",
  "Civil Engineering",
  "Biotechnology",
];

type Role = "student" | "organizer" | "faculty" | "judge" | "admin";

const ROLE_COLOR: Record<Role, string> = {
  student: "#719d2a",
  organizer: "#397abb",
  faculty: "#b6741b",
  judge: "#7f4ebb",
  admin: "#c14a4a",
};

const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  organizer: "Primary Publisher",
  faculty: "Organizing Faculty",
  judge: "Judge",
  admin: "Platform Admin",
};

function SkillChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95",
        selected
          ? "border-[#a7ca61] bg-[#e8f8c8] text-[#4a7820] dark:border-[#607a40] dark:bg-[#263c18] dark:text-[#b8d880]"
          : "border-[#e0e8d8] bg-white text-[#7a8a7a] hover:border-[#c0d890] hover:bg-[#f5fce8] dark:border-[#2e3e2e] dark:bg-[#18221a] dark:text-[#8a9a8a] dark:hover:border-[#4a6040] dark:hover:bg-[#1e2e1e]",
      ].join(" ")}
    >
      {selected && <Check size={11} className="mr-1 inline" strokeWidth={3} />}
      {label}
    </button>
  );
}

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, profile, logout, updateProfile, refreshUserData } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields (mirror from profile)
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("Computer Science & Engineering");
  const [year, setYear] = useState("3rd Year");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [technicalSkills, setTechnicalSkills] = useState<string[]>([]);
  const [nonTechnicalSkills, setNonTechnicalSkills] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [lookingForTeam, setLookingForTeam] = useState(false);

  const [certificates, setCertificates] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [certsLoading, setCertsLoading] = useState(true);

  // Populate from profile on mount / profile change
  useEffect(() => {
    if (profile) {
      setName(profile.name || user?.name || "");
      setBranch(profile.branch || "Computer Science & Engineering");
      setYear(profile.year || "3rd Year");
      setGithubUrl(profile.githubUrl || "");
      setLinkedinUrl(profile.linkedinUrl || "");
      setPortfolioUrl(profile.portfolioUrl || "");
      setTechnicalSkills(profile.technicalSkills || []);
      setNonTechnicalSkills(profile.nonTechnicalSkills || []);
      setDomains(profile.domains || []);
      setLookingForTeam(profile.lookingForTeam || false);
    } else if (user) {
      setName(user.name || "");
    }
  }, [profile, user]);

  // Load certificates & teams
  useEffect(() => {
    if (!user?.id) return;
    setCertsLoading(true);
    Promise.all([
      fetch(`/api/users/${user.id}/certificates`).then((r) => r.json()),
      fetch(`/api/users/${user.id}/teams`).then((r) => r.json()),
    ])
      .then(([certData, teamData]) => {
        setCertificates(certData.certificates || []);
        setTeams(teamData.teams || []);
      })
      .catch(() => {})
      .finally(() => setCertsLoading(false));
  }, [user?.id]);

  // Page enter animation
  const pageSpring = useSpring({
    from: { opacity: 0, transform: "translateY(20px)" },
    to: { opacity: 1, transform: "translateY(0px)" },
    config: { tension: 220, friction: 24 },
  });

  async function handleSave() {
    setSaving(true);
    const ok = await updateProfile({
      name,
      branch,
      year,
      githubUrl,
      linkedinUrl,
      portfolioUrl,
      technicalSkills,
      nonTechnicalSkills,
      domains,
      lookingForTeam,
    });
    setSaving(false);
    if (ok) {
      setEditing(false);
      await refreshUserData();
      toast.success("Profile updated!");
    } else {
      toast.error("Failed to save profile.");
    }
  }

  async function toggleLookingForTeam() {
    try {
      await fetch("/api/profile/looking-for-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, isLooking: !lookingForTeam }),
      });
      setLookingForTeam((prev) => !prev);
      toast.success(`${!lookingForTeam ? "You're now visible" : "You've been removed"} from the teammate directory.`);
    } catch {
      toast.error("Failed to update status.");
    }
  }

  function toggleSkill(arr: string[], set: (a: string[]) => void, skill: string) {
    set(arr.includes(skill) ? arr.filter((s) => s !== skill) : [...arr, skill]);
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f8f4] dark:bg-[#0e1410]">
        <Loader2 size={32} className="animate-spin text-[#719d2a]" />
      </div>
    );
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const roleColor = ROLE_COLOR[user.role as Role] ?? "#719d2a";
  const roleLabel = ROLE_LABEL[user.role as Role] ?? user.role;

  return (
    <div className="min-h-screen bg-[#f8f8f4] text-[#253025] dark:bg-[#0e1410] dark:text-[#e8efe3]">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="ambient-orb ambient-orb-a" />
        <div className="ambient-orb ambient-orb-b" />
      </div>

      {/* Topbar */}
      <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#e7e6e0] bg-[#f8f8f4]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8 dark:border-[#1e2a1e] dark:bg-[#0e1410]/90">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#5a6a5a] transition hover:bg-[#e8f0d8] hover:text-[#2a3a2a] dark:text-[#8a9a8a] dark:hover:bg-[#1e2e1e] dark:hover:text-[#d0e0d0]"
          >
            <ArrowLeft size={16} />
            Back to Arena
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#172017] shadow-[0_3px_0_#7eaa2a]">
              <Sparkles size={17} className="text-[#b8f34a]" strokeWidth={2.5} />
            </div>
            <span className="hidden font-display text-[16px] font-extrabold tracking-[-0.04em] sm:block">
              campus<span className="text-[#719d2a]">arena</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#e0e4da] bg-white text-[#6a7a6a] shadow-sm transition hover:bg-[#f1f3ea] dark:border-[#2a382a] dark:bg-[#18221a] dark:text-[#d0dcd0]"
            >
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => { logout(); setLocation("/login"); }}
              className="flex items-center gap-1.5 rounded-xl border border-[#e0e4da] bg-white px-3 py-2 text-xs font-bold text-[#7a1a1a] transition hover:bg-[#fef0f0] dark:border-[#3a2020] dark:bg-[#2a1818] dark:text-[#f09090]"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-[1100px] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <animated.div style={pageSpring} className="space-y-6">

          {/* Profile Hero Card */}
          <div className="overflow-hidden rounded-3xl border border-[#e4e8de] bg-white shadow-[0_4px_24px_rgba(28,44,16,.06)] dark:border-[#2a3c2a] dark:bg-[#161e17]">
            {/* Cover gradient */}
            <div className="h-28 bg-gradient-to-br from-[#14213d] via-[#173c67] to-[#0e7490] sm:h-36" />

            <div className="relative px-5 pb-6 sm:px-8">
              {/* Avatar */}
              <div className="absolute -top-12 left-5 sm:left-8">
                <div className="h-24 w-24 rounded-2xl border-4 border-white bg-[#172017] dark:border-[#161e17]">
                  <div className="flex h-full w-full items-center justify-center rounded-xl font-display text-3xl font-extrabold text-[#b8f34a]">
                    {initials || <User size={36} className="text-[#b8f34a]" />}
                  </div>
                </div>
                {user.isVerifiedCollegeUser && (
                  <div className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[#b8f34a] shadow-md">
                    <ShieldCheck size={13} className="text-[#172017]" strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-3">
                {editing ? (
                  <>
                    <button
                      onClick={() => setEditing(false)}
                      className="flex items-center gap-1.5 rounded-xl border border-[#e0e4da] bg-white px-3 py-2 text-xs font-bold text-[#6a7a6a] transition hover:bg-[#f0f4e8] dark:border-[#2a3a2a] dark:bg-[#18221a] dark:text-[#a0b0a0]"
                    >
                      <X size={13} /> Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 rounded-xl bg-[#172017] px-4 py-2 text-xs font-bold text-white shadow-[0_3px_0_#0c110c] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-60 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_3px_0_#7eaa2a]"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-[#d8e8c0] bg-[#f0f9e0] px-3.5 py-2 text-xs font-bold text-[#6a9820] transition hover:bg-[#e4f5cc] dark:border-[#3a5a20] dark:bg-[#1e3014] dark:text-[#b0d870]"
                  >
                    <Edit3 size={13} /> Edit Profile
                  </button>
                )}
              </div>

              {/* Identity */}
              <div className="mt-8">
                {editing ? (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="font-display w-full rounded-xl border border-[#c8e4a0] bg-[#f5fde8] px-3 py-1.5 text-2xl font-extrabold tracking-tight text-[#1e2e1e] outline-none focus:ring-2 focus:ring-[#b8f34a] sm:text-3xl dark:border-[#4a6a20] dark:bg-[#1c3014] dark:text-[#e0f0d0]"
                  />
                ) : (
                  <h1 className="font-display text-2xl font-extrabold tracking-[-0.04em] text-[#1a2a1a] sm:text-3xl dark:text-[#e8f5e0]">
                    {name || user.name}
                  </h1>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize"
                    style={{ color: roleColor, borderColor: roleColor + "44", background: roleColor + "18" }}
                  >
                    {roleLabel}
                  </span>
                  {profile?.rollNumber && (
                    <span className="rounded-full border border-[#e0e8d4] bg-[#f5fae8] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#5a6a5a] dark:border-[#2a3a2a] dark:bg-[#1e2c1e] dark:text-[#a0b0a0]">
                      {profile.rollNumber}
                    </span>
                  )}
                  {user.isVerifiedCollegeUser && (
                    <span className="flex items-center gap-1 rounded-full border border-[#c8e890] bg-[#f0fbd8] px-2.5 py-0.5 text-[11px] font-bold text-[#5a8820] dark:border-[#4a6a2c] dark:bg-[#1c3414] dark:text-[#b0d870]">
                      <ShieldCheck size={10} strokeWidth={2.5} /> Verified Campus Member
                    </span>
                  )}
                  {lookingForTeam && (
                    <span className="flex items-center gap-1 rounded-full border border-[#8dc0ff] bg-[#dff0ff] px-2.5 py-0.5 text-[11px] font-bold text-[#2060aa] dark:border-[#3060a0] dark:bg-[#0e2040] dark:text-[#90c0f0]">
                      <Users size={10} /> Looking for Team
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#7a8a7a] dark:text-[#8a9a8a]">
                  <span className="flex items-center gap-1.5">
                    <Mail size={12} /> {user.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Smartphone size={12} /> {user.mobile}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Two column layout */}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Left: Skills & Links */}
            <div className="space-y-5">
              {/* Academic Info */}
              <div className="rounded-2xl border border-[#e4e8de] bg-white p-5 dark:border-[#2a3c2a] dark:bg-[#161e17]">
                <div className="mb-4 flex items-center gap-2">
                  <Briefcase size={16} className="text-[#719d2a]" />
                  <h2 className="font-display text-base font-extrabold tracking-[-0.03em] text-[#2a3a2a] dark:text-[#d8ead0]">Academic Details</h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Branch / Department</label>
                    {editing ? (
                      <select value={branch} onChange={(e) => setBranch(e.target.value)}
                        className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]">
                        {BRANCH_OPTS.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-[#e8eee0] bg-[#f8faf4] px-3 py-2 text-sm text-[#3a4e3a] dark:border-[#2a3a2a] dark:bg-[#18221a] dark:text-[#d0dcd0]">{branch}</div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">Year of Study</label>
                    {editing ? (
                      <select value={year} onChange={(e) => setYear(e.target.value)}
                        className="w-full rounded-xl border border-[#dde2d6] bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]">
                        {YEAR_OPTS.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <div className="rounded-xl border border-[#e8eee0] bg-[#f8faf4] px-3 py-2 text-sm text-[#3a4e3a] dark:border-[#2a3a2a] dark:bg-[#18221a] dark:text-[#d0dcd0]">{year}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="rounded-2xl border border-[#e4e8de] bg-white p-5 dark:border-[#2a3c2a] dark:bg-[#161e17]">
                <div className="mb-4 flex items-center gap-2">
                  <Code2 size={16} className="text-[#719d2a]" />
                  <h2 className="font-display text-base font-extrabold tracking-[-0.03em] text-[#2a3a2a] dark:text-[#d8ead0]">Technical Skills</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing
                    ? TECHNICAL_SKILLS_OPTS.map((s) => (
                        <SkillChip
                          key={s} label={s}
                          selected={technicalSkills.includes(s)}
                          onClick={() => toggleSkill(technicalSkills, setTechnicalSkills, s)}
                        />
                      ))
                    : technicalSkills.length > 0
                    ? technicalSkills.map((s) => (
                        <span key={s} className="rounded-xl border border-[#c8e4a0] bg-[#f0fae0] px-2.5 py-1 text-xs font-semibold text-[#5a8820] dark:border-[#4a6a2c] dark:bg-[#1c3014] dark:text-[#b0d870]">{s}</span>
                      ))
                    : <p className="text-sm text-[#9aaa98]">No skills added yet. Click "Edit Profile" to add.</p>
                  }
                </div>
              </div>

              <div className="rounded-2xl border border-[#e4e8de] bg-white p-5 dark:border-[#2a3c2a] dark:bg-[#161e17]">
                <div className="mb-4 flex items-center gap-2">
                  <Star size={16} className="text-[#719d2a]" />
                  <h2 className="font-display text-base font-extrabold tracking-[-0.03em] text-[#2a3a2a] dark:text-[#d8ead0]">Non-Technical Skills</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing
                    ? NON_TECHNICAL_SKILLS_OPTS.map((s) => (
                        <SkillChip
                          key={s} label={s}
                          selected={nonTechnicalSkills.includes(s)}
                          onClick={() => toggleSkill(nonTechnicalSkills, setNonTechnicalSkills, s)}
                        />
                      ))
                    : nonTechnicalSkills.length > 0
                    ? nonTechnicalSkills.map((s) => (
                        <span key={s} className="rounded-xl border border-[#e0d4f4] bg-[#f4eeff] px-2.5 py-1 text-xs font-semibold text-[#6040a8] dark:border-[#4a3880] dark:bg-[#1c1430] dark:text-[#c0a0f0]">{s}</span>
                      ))
                    : <p className="text-sm text-[#9aaa98]">No non-technical skills added yet.</p>
                  }
                </div>
              </div>

              <div className="rounded-2xl border border-[#e4e8de] bg-white p-5 dark:border-[#2a3c2a] dark:bg-[#161e17]">
                <div className="mb-4 flex items-center gap-2">
                  <Globe size={16} className="text-[#719d2a]" />
                  <h2 className="font-display text-base font-extrabold tracking-[-0.03em] text-[#2a3a2a] dark:text-[#d8ead0]">Domains of Interest</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editing
                    ? DOMAIN_OPTS.map((s) => (
                        <SkillChip
                          key={s} label={s}
                          selected={domains.includes(s)}
                          onClick={() => toggleSkill(domains, setDomains, s)}
                        />
                      ))
                    : domains.length > 0
                    ? domains.map((s) => (
                        <span key={s} className="rounded-xl border border-[#c0e0f4] bg-[#e8f5fd] px-2.5 py-1 text-xs font-semibold text-[#2060a0] dark:border-[#2a5080] dark:bg-[#0e2040] dark:text-[#90c0f0]">{s}</span>
                      ))
                    : <p className="text-sm text-[#9aaa98]">No domains selected yet.</p>
                  }
                </div>
              </div>

              {/* Links */}
              <div className="rounded-2xl border border-[#e4e8de] bg-white p-5 dark:border-[#2a3c2a] dark:bg-[#161e17]">
                <div className="mb-4 flex items-center gap-2">
                  <ExternalLink size={16} className="text-[#719d2a]" />
                  <h2 className="font-display text-base font-extrabold tracking-[-0.03em] text-[#2a3a2a] dark:text-[#d8ead0]">Links & Portfolio</h2>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: Github, label: "GitHub URL", value: githubUrl, set: setGithubUrl, placeholder: "https://github.com/yourname" },
                    { icon: Linkedin, label: "LinkedIn URL", value: linkedinUrl, set: setLinkedinUrl, placeholder: "https://linkedin.com/in/yourname" },
                    { icon: Globe, label: "Portfolio URL", value: portfolioUrl, set: setPortfolioUrl, placeholder: "https://yourname.dev" },
                  ].map(({ icon: Icon, label, value, set, placeholder }) => (
                    <div key={label}>
                      <label className="mb-1 block text-xs font-bold text-[#4a6044] dark:text-[#a8c0a4]">{label}</label>
                      {editing ? (
                        <div className="relative">
                          <Icon size={14} className="pointer-events-none absolute inset-y-0 left-3 top-1/2 -translate-y-1/2 text-[#8a9888]" />
                          <input
                            value={value}
                            onChange={(e) => set(e.target.value)}
                            placeholder={placeholder}
                            className="w-full rounded-xl border border-[#dde2d6] bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]"
                          />
                        </div>
                      ) : value ? (
                        <a href={value} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 rounded-xl border border-[#e8eee0] bg-[#f8faf4] px-3 py-2 text-sm text-[#5a8820] transition hover:bg-[#eef8e0] dark:border-[#2a3a2a] dark:bg-[#18221a] dark:text-[#a8d870]">
                          <Icon size={14} /> {value} <ExternalLink size={12} className="ml-auto" />
                        </a>
                      ) : (
                        <div className="rounded-xl border border-[#eef0e8] bg-[#f8faf4] px-3 py-2 text-sm text-[#b0b8aa] dark:border-[#262e26] dark:bg-[#161e17] dark:text-[#606860]">Not set</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Stats + Certificates + Teams */}
            <div className="space-y-5">
              {/* Team Status Toggle */}
              <div className="rounded-2xl border border-[#e4e8de] bg-white p-5 dark:border-[#2a3c2a] dark:bg-[#161e17]">
                <div className="mb-3 flex items-center gap-2">
                  <Users size={16} className="text-[#719d2a]" />
                  <h2 className="font-display text-base font-extrabold tracking-[-0.03em] text-[#2a3a2a] dark:text-[#d8ead0]">Team Status</h2>
                </div>
                <p className="mb-3 text-xs text-[#7a8a7a] dark:text-[#8a9a8a]">
                  Toggle visibility in the teammate directory so other students can invite you to their team.
                </p>
                <button
                  onClick={toggleLookingForTeam}
                  className={[
                    "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-bold transition",
                    lookingForTeam
                      ? "border-[#8dc0ff] bg-[#dff0ff] text-[#2060aa] dark:border-[#3060a0] dark:bg-[#0e2040] dark:text-[#90c0f0]"
                      : "border-[#e0e8d0] bg-[#f4f8ec] text-[#6a7a6a] dark:border-[#2a3a2a] dark:bg-[#18221a] dark:text-[#909a90]",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <Users size={16} />
                    {lookingForTeam ? "Looking for Team — Visible" : "Not Looking for Team"}
                  </span>
                  <div className={[
                    "h-5 w-9 rounded-full transition-colors",
                    lookingForTeam ? "bg-[#4090d0]" : "bg-[#c0c8c0]",
                  ].join(" ")}>
                    <div className={[
                      "mt-0.5 h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform",
                      lookingForTeam ? "translate-x-4" : "",
                    ].join(" ")} />
                  </div>
                </button>
              </div>

              {/* Certificates */}
              <div className="rounded-2xl border border-[#e4e8de] bg-white p-5 dark:border-[#2a3c2a] dark:bg-[#161e17]">
                <div className="mb-4 flex items-center gap-2">
                  <Award size={16} className="text-[#719d2a]" />
                  <h2 className="font-display text-base font-extrabold tracking-[-0.03em] text-[#2a3a2a] dark:text-[#d8ead0]">Certificates</h2>
                </div>
                {certsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={22} className="animate-spin text-[#a0b87a]" />
                  </div>
                ) : certificates.length > 0 ? (
                  <div className="space-y-2.5">
                    {certificates.map((cert: any) => (
                      <div key={cert.id} className="flex items-center gap-3 rounded-xl border border-[#e8f0d8] bg-[#f4fae8] p-3 dark:border-[#2e4020] dark:bg-[#1a2c14]">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#dff2b0] text-[#5a8820]">
                          <Trophy size={17} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-[#2a3a2a] dark:text-[#d0e4c0]">{cert.competitionName || "Competition Certificate"}</div>
                          <div className="text-[10px] text-[#8a9a88]">{cert.rank ? `Rank #${cert.rank}` : "Participation"} · {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "2026"}</div>
                        </div>
                        <button className="rounded-lg p-1.5 text-[#6a9820] transition hover:bg-[#dff2b0] dark:hover:bg-[#283c18]">
                          <ExternalLink size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#d0dcc0] p-6 text-center dark:border-[#2a3e20]">
                    <Award size={24} className="mx-auto mb-2 text-[#b0c090]" />
                    <p className="text-xs text-[#8a9a88]">No certificates yet. Win competitions to earn them!</p>
                  </div>
                )}
              </div>

              {/* Teams */}
              <div className="rounded-2xl border border-[#e4e8de] bg-white p-5 dark:border-[#2a3c2a] dark:bg-[#161e17]">
                <div className="mb-4 flex items-center gap-2">
                  <Users size={16} className="text-[#719d2a]" />
                  <h2 className="font-display text-base font-extrabold tracking-[-0.03em] text-[#2a3a2a] dark:text-[#d8ead0]">My Teams</h2>
                </div>
                {certsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={22} className="animate-spin text-[#a0b87a]" />
                  </div>
                ) : teams.length > 0 ? (
                  <div className="space-y-2.5">
                    {teams.map((team: any) => (
                      <div key={team.id} className="rounded-xl border border-[#e8eee0] bg-[#f8faf4] p-3 dark:border-[#2a3a2a] dark:bg-[#18221a]">
                        <div className="flex items-center gap-2">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e8f4d0] font-mono text-[11px] font-black text-[#5a8820] dark:bg-[#263c18] dark:text-[#b0d870]">
                            {team.code || "??"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold text-[#2a3a2a] dark:text-[#d0e4c0]">{team.name}</div>
                            <div className="text-[10px] capitalize text-[#8a9a88]">{team.status?.replace(/_/g, " ") || "formation"}</div>
                          </div>
                          {team.leaderId === user.id && (
                            <span className="rounded-full bg-[#f0fae0] px-2 py-0.5 text-[10px] font-bold text-[#6a9820] dark:bg-[#1e3014] dark:text-[#a8d870]">Leader</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#d0dcc0] p-6 text-center dark:border-[#2a3e20]">
                    <Users size={24} className="mx-auto mb-2 text-[#b0c090]" />
                    <p className="text-xs text-[#8a9a88]">Not in any teams yet. Register for a competition to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </animated.div>
      </div>
    </div>
  );
}
