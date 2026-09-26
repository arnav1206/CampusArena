import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { useSpring, animated } from "@react-spring/web";
import { 
  ArrowLeft, Check, ChevronRight, Plus, Trash2 
} from "lucide-react";
import { toast } from "sonner";
import { CompetitionType, ParticipationMode } from "../../../shared/types";

const STEPS = [
  "Basic Information",
  "Schedule",
  "Tracks",
  "Team Rules",
  "Registration Form",
  "Payment",
  "Submission",
  "Judging",
  "Certificates & Results",
  "Notifications",
  "Preview & Publish",
];

export default function CreateCompetition() {
  const { user, getSessionHeaders } = useAuth();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [competitionId, setCompetitionId] = useState<string | null>(null);

  // Form State
  const [basicInfo, setBasicInfo] = useState({
    title: "",
    type: "hackathon" as CompetitionType,
    overview: "",
    accessCode: "",
  });

  const [schedule, setSchedule] = useState({
    registrationReadyDate: "",
    competitionReadyDate: "",
    registrationDeadline: "",
    teamChangeDeadline: "",
    withdrawalDeadline: "",
    paymentDeadline: "",
    startDate: "",
    endDate: "",
  });

  const [tracks, setTracks] = useState<{ id: string; name: string; description: string; color: string }[]>([]);
  
  const [teamRules, setTeamRules] = useState({
    participationMode: "team_required" as ParticipationMode,
    minTeamSize: 1,
    maxTeamSize: 4,
    verifiedCollegeStudentsOnly: true,
  });

  const [registrationForm, setRegistrationForm] = useState<{ id: string; label: string; type: string; required: boolean; options: string[] }[]>([]);

  const [payment, setPayment] = useState({
    isFree: true,
    baseTeamFee: 0,
    baseTeamMemberCount: 1,
    additionalMemberFee: 0,
  });

  const [judging, setJudging] = useState({
    isBlindJudging: false,
    advancementMode: "manual"
  });

  // Animation for step transitions
  const fadeProps = useSpring({
    from: { opacity: 0, transform: "translateY(10px)" },
    to: { opacity: 1, transform: "translateY(0px)" },
    reset: true,
    key: currentStep
  });

  const isInitialMount = useRef(true);

  // Auto-save draft on form change or step change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveDraft();
    }, 1000);
    return () => clearTimeout(timer);
  }, [basicInfo, schedule, tracks, teamRules, registrationForm, payment, judging, currentStep]);

  const constructPayload = () => {
    return {
      id: competitionId,
      title: basicInfo.title,
      type: basicInfo.type,
      overview: basicInfo.overview,
      accessCode: basicInfo.accessCode,
      dates: schedule,
      tracks,
      participationMode: teamRules.participationMode,
      teamRules: {
        minTeamSize: teamRules.minTeamSize,
        maxTeamSize: teamRules.maxTeamSize,
      },
      eligibility: {
        verifiedCollegeStudentsOnly: teamRules.verifiedCollegeStudentsOnly,
      },
      registrationFields: registrationForm,
      pricing: {
        isFree: payment.isFree,
        baseTeamFee: payment.baseTeamFee,
        baseTeamMemberCount: payment.baseTeamMemberCount,
        additionalMemberFee: payment.additionalMemberFee,
        currency: "INR",
      },
      judging,
    };
  };

  const saveDraft = async () => {
    if (!basicInfo.title) return; // Skip saving if title is empty
    try {
      const res = await fetch("/api/competitions/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionHeaders(),
        },
        body: JSON.stringify(constructPayload()),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id && !competitionId) {
          setCompetitionId(data.id);
        }
      }
    } catch (err) {
      console.error("Auto-save failed", err);
    }
  };

  const validateCurrentStep = (): boolean => {
    if (currentStep === 0) {
      if (!basicInfo.title.trim()) {
        toast.error("Please enter a competition title before proceeding.");
        return false;
      }
    }
    if (currentStep === 1) {
      if (schedule.startDate && schedule.endDate && new Date(schedule.endDate) < new Date(schedule.startDate)) {
        toast.error("Competition End Date cannot be earlier than Start Date.");
        return false;
      }
      if (schedule.registrationDeadline && schedule.startDate && new Date(schedule.registrationDeadline) > new Date(schedule.startDate)) {
        toast.error("Registration Deadline must be on or before the Start Date.");
        return false;
      }
    }
    if (currentStep === 3) {
      if (teamRules.minTeamSize > teamRules.maxTeamSize) {
        toast.error("Minimum team size cannot be greater than Maximum team size.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const handlePublish = async () => {
    if (!basicInfo.title) {
      toast.error("Title is required before publishing.");
      return;
    }

    try {
      // First save draft
      let currentId = competitionId;
      const resDraft = await fetch("/api/competitions/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionHeaders(),
        },
        body: JSON.stringify(constructPayload()),
      });
      if (!resDraft.ok) throw new Error("Failed to save draft");
      const draftData = await resDraft.json();
      currentId = draftData.id;

      // Then publish
      const resPublish = await fetch(`/api/competitions/${currentId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getSessionHeaders(),
        },
        body: JSON.stringify({ status: "published" }),
      });

      if (!resPublish.ok) throw new Error("Failed to publish competition");

      toast.success("Competition published successfully!");
      setLocation("/");
    } catch (err) {
      console.error(err);
      toast.error("Error publishing competition");
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Basic Information</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Competition Title *</label>
                <input 
                  type="text" 
                  value={basicInfo.title} 
                  onChange={e => setBasicInfo({...basicInfo, title: e.target.value})}
                  className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]" 
                  placeholder="e.g. Annual Tech Hackathon"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Type</label>
                <select 
                  value={basicInfo.type} 
                  onChange={e => setBasicInfo({...basicInfo, type: e.target.value as CompetitionType})}
                  className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
                >
                  <option value="hackathon">Hackathon</option>
                  <option value="ideathon">Ideathon</option>
                  <option value="startup_summit">Startup Summit</option>
                  <option value="case_competition">Case Competition</option>
                  <option value="quiz">Quiz</option>
                  <option value="design_competition">Design Competition</option>
                  <option value="pitch_competition">Pitch Competition</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Overview</label>
                <textarea 
                  value={basicInfo.overview} 
                  onChange={e => setBasicInfo({...basicInfo, overview: e.target.value})}
                  rows={4}
                  className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
                  placeholder="Short description of your competition..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Access Code (Optional)</label>
                <input 
                  type="text" 
                  value={basicInfo.accessCode} 
                  onChange={e => setBasicInfo({...basicInfo, accessCode: e.target.value})}
                  className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]" 
                  placeholder="Leave empty for public"
                />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Schedule</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Object.keys(schedule).map(key => (
                <div key={key}>
                  <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0] capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input 
                    type="datetime-local" 
                    value={schedule[key as keyof typeof schedule]} 
                    onChange={e => setSchedule({...schedule, [key]: e.target.value})}
                    className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]" 
                  />
                </div>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Tracks</h2>
              <button 
                onClick={() => setTracks([...tracks, { id: Date.now().toString(), name: "", description: "", color: "#b8f34a" }])}
                className="flex items-center gap-1.5 rounded-lg bg-[#f0f4ea] px-3 py-1.5 text-sm font-medium text-[#172017] dark:bg-[#202a20] dark:text-[#b8f34a]"
              >
                <Plus size={16} /> Add Track
              </button>
            </div>
            {tracks.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No tracks added. Your competition can be a single general track.</p>
            )}
            <div className="space-y-3">
              {tracks.map((track, idx) => (
                <div key={track.id} className="flex gap-3 rounded-xl border border-[#dfe4d8] p-3 dark:border-[#273528]">
                  <div className="flex-1 space-y-2">
                    <input 
                      type="text" placeholder="Track Name"
                      value={track.name}
                      onChange={e => {
                        const newTracks = [...tracks];
                        newTracks[idx].name = e.target.value;
                        setTracks(newTracks);
                      }}
                      className="w-full rounded-lg border border-[#dfe4d8] bg-white px-3 py-2 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
                    />
                    <input 
                      type="text" placeholder="Description"
                      value={track.description}
                      onChange={e => {
                        const newTracks = [...tracks];
                        newTracks[idx].description = e.target.value;
                        setTracks(newTracks);
                      }}
                      className="w-full rounded-lg border border-[#dfe4d8] bg-white px-3 py-2 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
                    />
                  </div>
                  <button onClick={() => setTracks(tracks.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Team Rules</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Participation Mode</label>
                <select 
                  value={teamRules.participationMode} 
                  onChange={e => setTeamRules({...teamRules, participationMode: e.target.value as ParticipationMode})}
                  className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
                >
                  <option value="team_required">Team Required</option>
                  <option value="individual_allowed">Individual Allowed</option>
                  <option value="both">Both Allowed</option>
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Min Team Size</label>
                  <input 
                    type="number" min="1"
                    value={teamRules.minTeamSize} 
                    onChange={e => setTeamRules({...teamRules, minTeamSize: parseInt(e.target.value) || 1})}
                    className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]" 
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Max Team Size</label>
                  <input 
                    type="number" min="1"
                    value={teamRules.maxTeamSize} 
                    onChange={e => setTeamRules({...teamRules, maxTeamSize: parseInt(e.target.value) || 1})}
                    className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]" 
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-[#172017] dark:text-[#e8efe3]">
                <input 
                  type="checkbox" 
                  checked={teamRules.verifiedCollegeStudentsOnly}
                  onChange={e => setTeamRules({...teamRules, verifiedCollegeStudentsOnly: e.target.checked})}
                  className="rounded border-[#dfe4d8] text-[#b8f34a] focus:ring-[#b8f34a]"
                />
                Verified College Students Only
              </label>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Registration Form</h2>
              <button 
                onClick={() => setRegistrationForm([...registrationForm, { id: Date.now().toString(), label: "", type: "short_text", required: false, options: [] }])}
                className="flex items-center gap-1.5 rounded-lg bg-[#f0f4ea] px-3 py-1.5 text-sm font-medium text-[#172017] dark:bg-[#202a20] dark:text-[#b8f34a]"
              >
                <Plus size={16} /> Add Field
              </button>
            </div>
            {registrationForm.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Default fields (Name, Email, College) are automatically included.</p>
            )}
            <div className="space-y-3">
              {registrationForm.map((field, idx) => (
                <div key={field.id} className="flex gap-3 rounded-xl border border-[#dfe4d8] p-3 dark:border-[#273528]">
                  <div className="flex-1 space-y-2">
                    <input 
                      type="text" placeholder="Field Label (e.g. Dietary Restrictions)"
                      value={field.label}
                      onChange={e => {
                        const newFields = [...registrationForm];
                        newFields[idx].label = e.target.value;
                        setRegistrationForm(newFields);
                      }}
                      className="w-full rounded-lg border border-[#dfe4d8] bg-white px-3 py-2 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
                    />
                    <div className="flex gap-2">
                      <select
                        value={field.type}
                        onChange={e => {
                          const newFields = [...registrationForm];
                          newFields[idx].type = e.target.value;
                          setRegistrationForm(newFields);
                        }}
                        className="rounded-lg border border-[#dfe4d8] bg-white px-2 py-1 text-xs outline-none dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
                      >
                        <option value="short_text">Short Text</option>
                        <option value="long_text">Long Text</option>
                        <option value="dropdown">Dropdown</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
                        <input 
                          type="checkbox"
                          checked={field.required}
                          onChange={e => {
                            const newFields = [...registrationForm];
                            newFields[idx].required = e.target.checked;
                            setRegistrationForm(newFields);
                          }}
                        /> Required
                      </label>
                    </div>
                  </div>
                  <button onClick={() => setRegistrationForm(registrationForm.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Payment & Pricing</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[#172017] dark:text-white">
                <input 
                  type="checkbox" 
                  checked={payment.isFree}
                  onChange={e => setPayment({...payment, isFree: e.target.checked})}
                  className="rounded border-[#dfe4d8] text-[#b8f34a] focus:ring-[#b8f34a]"
                />
                This is a free competition
              </label>
              
              {!payment.isFree && (
                <div className="space-y-3 rounded-xl border border-[#dfe4d8] p-4 dark:border-[#273528] bg-[#f8f8f4] dark:bg-[#101812]">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Base Team Fee (INR)</label>
                    <input 
                      type="number" min="0"
                      value={payment.baseTeamFee} 
                      onChange={e => setPayment({...payment, baseTeamFee: parseInt(e.target.value) || 0})}
                      className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#162018] dark:text-[#e8efe3]" 
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Members included in Base Fee</label>
                      <input 
                        type="number" min="1"
                        value={payment.baseTeamMemberCount} 
                        onChange={e => setPayment({...payment, baseTeamMemberCount: parseInt(e.target.value) || 1})}
                        className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#162018] dark:text-[#e8efe3]" 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Additional Member Fee (INR)</label>
                      <input 
                        type="number" min="0"
                        value={payment.additionalMemberFee} 
                        onChange={e => setPayment({...payment, additionalMemberFee: parseInt(e.target.value) || 0})}
                        className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#162018] dark:text-[#e8efe3]" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Submission Requirements</h2>
            <div className="rounded-xl border border-dashed border-[#dfe4d8] p-8 text-center dark:border-[#273528]">
              <p className="text-sm text-gray-500 dark:text-gray-400">Configure round-wise submission fields here in the future.</p>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Judging</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm text-[#172017] dark:text-[#e8efe3]">
                <input 
                  type="checkbox" 
                  checked={judging.isBlindJudging}
                  onChange={e => setJudging({...judging, isBlindJudging: e.target.checked})}
                  className="rounded border-[#dfe4d8] text-[#b8f34a] focus:ring-[#b8f34a]"
                />
                Enable Blind Judging (Hide participant identities from judges)
              </label>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#606b5e] dark:text-[#d0ded0]">Advancement Mode</label>
                <select 
                  value={judging.advancementMode} 
                  onChange={e => setJudging({...judging, advancementMode: e.target.value})}
                  className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3.5 py-3 text-sm outline-none ring-[#b8f34a] focus:ring-2 dark:border-[#273528] dark:bg-[#101812] dark:text-[#e8efe3]"
                >
                  <option value="manual">Manual Advancement</option>
                  <option value="score_based">Score Based (Automatic cutoff)</option>
                  <option value="combination">Combination</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 8:
      case 9:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">
              {STEPS[currentStep]}
            </h2>
            <div className="rounded-xl border border-dashed border-[#dfe4d8] p-8 text-center dark:border-[#273528]">
              <p className="text-sm text-gray-500 dark:text-gray-400">Placeholder for future configuration.</p>
            </div>
          </div>
        );
      case 10:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-display font-bold text-[#172017] dark:text-white">Preview & Publish</h2>
            <div className="rounded-xl border border-[#e1e0da] bg-white p-5 shadow-[0_12px_30px_rgba(34,39,25,.045)] dark:border-[#273528] dark:bg-[#162018]">
              <h3 className="mb-4 text-lg font-bold text-[#172017] dark:text-[#e8efe3]">{basicInfo.title || "Untitled Competition"}</h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-bold">Type:</span> {basicInfo.type}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-bold">Participation:</span> {teamRules.participationMode}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-bold">Team Size:</span> {teamRules.minTeamSize} - {teamRules.maxTeamSize}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-bold">Tracks:</span> {tracks.length}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-bold">Custom Fields:</span> {registrationForm.length}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400"><span className="font-bold">Pricing:</span> {payment.isFree ? "Free" : `Paid (INR ${payment.baseTeamFee})`}</p>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f8f4] pb-20 dark:bg-[#101610]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#e1e0da] bg-white/80 px-4 py-4 backdrop-blur-md dark:border-[#273528] dark:bg-[#101610]/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-[#606b5e] hover:text-[#172017] dark:text-[#d0ded0] dark:hover:text-white">
            <ArrowLeft size={16} />
            My competitions
          </Link>
          <div className="font-display text-sm font-bold tracking-[-0.03em] text-[#719d2a]">
            campus<span className="text-[#253025] dark:text-[#e8efe3]">arena</span>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-8 max-w-4xl px-4">
        <div className="flex flex-col md:flex-row md:gap-8">
          {/* Sidebar steps indicator */}
          <aside className="mb-8 w-full md:mb-0 md:w-64 shrink-0">
            <h1 className="mb-6 font-display text-2xl font-bold tracking-[-0.04em] text-[#172017] dark:text-white">Create Competition</h1>
            <div className="space-y-1">
              {STEPS.map((step, idx) => (
                <div 
                  key={idx} 
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    idx === currentStep 
                      ? "bg-[#eaf4d5] text-[#3d5c14] dark:bg-[#202a20] dark:text-[#b8f34a]"
                      : idx < currentStep 
                        ? "text-[#172017] dark:text-[#e8efe3]" 
                        : "text-[#8a9986] dark:text-[#506650]"
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    idx < currentStep 
                      ? "bg-[#172017] text-white dark:bg-[#b8f34a] dark:text-[#101610]" 
                      : idx === currentStep 
                        ? "bg-[#3d5c14] text-white dark:bg-[#b8f34a] dark:text-[#101610]" 
                        : "bg-[#e1e0da] text-[#8a9986] dark:bg-[#273528] dark:text-[#506650]"
                  }`}>
                    {idx < currentStep ? <Check size={12} strokeWidth={3} /> : idx + 1}
                  </div>
                  {step}
                </div>
              ))}
            </div>
          </aside>

          {/* Form Content */}
          <div className="flex-1">
            <animated.div style={fadeProps} className="rounded-2xl border border-[#e1e0da] bg-white p-6 shadow-[0_12px_30px_rgba(34,39,25,.045)] dark:border-[#273528] dark:bg-[#162018] md:p-8">
              {renderStepContent()}
            </animated.div>

            {/* Navigation Actions */}
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-[#172017] transition-colors disabled:opacity-50 dark:text-[#e8efe3] hover:bg-[#e1e0da]/50 dark:hover:bg-[#273528]"
              >
                <ArrowLeft size={16} /> Back
              </button>
              
              {currentStep === STEPS.length - 1 ? (
                <button
                  onClick={handlePublish}
                  className="flex items-center gap-2 rounded-xl bg-[#172017] px-6 py-2.5 text-sm font-bold text-white shadow-[0_5px_0_#0c110c] transition-all hover:-translate-y-0.5 dark:bg-[#b8f34a] dark:text-[#101610] dark:shadow-[0_5px_0_#91c435]"
                >
                  Publish Competition
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 rounded-xl bg-[#172017] px-6 py-2.5 text-sm font-bold text-white shadow-[0_5px_0_#0c110c] transition-all hover:-translate-y-0.5 dark:bg-[#b8f34a] dark:text-[#101610] dark:shadow-[0_5px_0_#91c435]"
                >
                  Continue <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
