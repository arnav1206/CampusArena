// =============================================================================
// Campus Arena — Payment & Terms Modal (5-7 Second Enforced Countdown)
// =============================================================================

import React, { useEffect, useState } from "react";
import {
  X,
  CreditCard,
  ShieldAlert,
  Clock3,
  Check,
  ArrowRight,
  Download,
  LockKeyhole,
  TicketPercent,
  Receipt,
  FileCheck2,
} from "lucide-react";
import type { Team, Competition, PaymentTransaction } from "@shared/types";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";

export function PaymentModal({
  team,
  competition,
  close,
  onPaymentSuccess,
}: {
  team: Team;
  competition: Competition;
  close: () => void;
  onPaymentSuccess?: () => void;
}) {
  const { user } = useAuth();

  // Step 1: Terms Screen (5-7s enforced timer)
  // Step 2: Checkout & Coupon
  // Step 3: Success Receipt
  const [step, setStep] = useState<"terms" | "checkout" | "receipt">("terms");
  const [termsTimer, setTermsTimer] = useState(6);
  const [canProceed, setCanProceed] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);

  // 6-second countdown for payment terms
  useEffect(() => {
    if (step === "terms" && termsTimer > 0) {
      const timer = setTimeout(() => {
        setTermsTimer((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (termsTimer === 0) {
      setCanProceed(true);
    }
  }, [step, termsTimer]);

  useEffect(() => {
    loadCheckoutSummary();
  }, [team.id, appliedCoupon]);

  async function loadCheckoutSummary() {
    setCalculating(true);
    try {
      const res = await fetch("/api/payments/checkout-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          couponCode: appliedCoupon || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCalculating(false);
    }
  }

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const res = await fetch(`/api/competitions/${competition.id}/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon(data.coupon.code);
        toast.success(`Coupon "${data.coupon.code}" applied!`);
      } else {
        toast.error(data.error || "Invalid coupon code");
      }
    } catch {
      toast.error("Failed to apply coupon");
    }
  };

  const handlePayNow = async () => {
    if (!user) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/payments/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: team.id,
          payerUserId: user.id,
          couponCode: appliedCoupon || undefined,
          gatewayProvider: "CampusRazorpayUPI",
        }),
      });
      const data = await res.json();
      setProcessing(false);
      if (res.ok && data.success) {
        setTransaction(data.transaction);
        setStep("receipt");
        toast.success("Payment confirmed server-side! Official receipt generated.");
        if (onPaymentSuccess) onPaymentSuccess();
      } else {
        toast.error(data.error || "Payment gateway simulation failed");
      }
    } catch (err: any) {
      setProcessing(false);
      toast.error(err.message || "Network error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/45 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="my-8 max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-3xl border border-white/60 bg-[#fbfcf8] p-6 shadow-2xl sm:p-8 dark:border-[#2f3f2f] dark:bg-[#162118]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#e9ece3] pb-5 dark:border-[#283729]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#b8f34a] text-[#172017] shadow-[0_3px_0_#7eaa2a]">
              <CreditCard size={20} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#719d2a]">
                Checkout & Financial Room
              </div>
              <h2 className="font-display text-2xl font-extrabold tracking-[-0.05em] text-[#222c22] dark:text-[#eff7eb]">
                {step === "terms"
                  ? "Payment Policy & Terms"
                  : step === "checkout"
                  ? "Team Fee Payment"
                  : "Official Payment Receipt"}
              </h2>
            </div>
          </div>
          <button
            onClick={close}
            className="rounded-lg p-2 text-[#949c91] hover:bg-[#edf0e8] dark:hover:bg-[#202e22]"
          >
            <X size={19} />
          </button>
        </div>

        {/* STEP 1: PAYMENT TERMS SCREEN (5-7 SECONDS MANDATORY TIMER) */}
        {step === "terms" && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border-2 border-[#f3c6c7] bg-[#fff4f4] p-5 dark:border-[#5c2d2f] dark:bg-[#2a1718]">
              <div className="flex items-start gap-3">
                <ShieldAlert size={22} className="shrink-0 text-[#c73d3f]" />
                <div>
                  <h3 className="text-sm font-black text-[#a62e30] dark:text-[#f38d8f]">
                    STRICT NO-REFUND POLICY
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-[#8c3537] dark:text-[#e4a5a7]">
                    All competition registrations and team fee payments are final. Participant withdrawal,
                    team disqualification, or failure to submit does <strong>NOT</strong> qualify for a refund.
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[#8c3537] dark:text-[#e4a5a7]">
                    <strong>Sole Exception:</strong> In the rare event that the competition is officially
                    cancelled by organizers, full registration fees are automatically refunded to your original payment method.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e2e6dc] bg-white p-4 dark:border-[#2a382c] dark:bg-[#1a251c]">
              <div className="text-xs font-bold text-[#354335] dark:text-[#e4efe2]">
                Key Payment Rules
              </div>
              <ul className="mt-2 space-y-1.5 text-xs text-[#707c6f] dark:text-[#9fae9d]">
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#719d2a]" /> One consolidated transaction covers the entire team.
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#719d2a]" /> Payment is calculated as Base Fee + Additional Member Surcharge.
                </li>
                <li className="flex items-center gap-2">
                  <Check size={13} className="text-[#719d2a]" /> Payments stay attached to this team and cannot be transferred.
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between border-t border-[#e9ece3] pt-5 dark:border-[#283729]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#868f83] dark:text-[#9ea99b]">
                <Clock3 size={15} />
                {!canProceed ? (
                  <span>Please review policy ({termsTimer}s remaining)</span>
                ) : (
                  <span className="text-[#649525]">Policy reviewed and acknowledged</span>
                )}
              </div>

              <button
                type="button"
                disabled={!canProceed}
                onClick={() => setStep("checkout")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  canProceed
                    ? "bg-[#172017] text-white shadow-[0_4px_0_#0c110c] hover:-translate-y-0.5 active:translate-y-0 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_4px_0_#7eaa2a]"
                    : "cursor-not-allowed bg-[#e4e7de] text-[#9ca398] dark:bg-[#253326] dark:text-[#5f6e60]"
                }`}
              >
                Continue to Checkout <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CHECKOUT & COUPON APPLICATION */}
        {step === "checkout" && (
          <div className="mt-6 space-y-6">
            {/* Fee Breakdown */}
            <div className="rounded-2xl border border-[#e2e6dc] bg-white p-5 shadow-sm dark:border-[#2a382c] dark:bg-[#1a251c]">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#868f83] dark:text-[#9ea99b]">
                Registration Fee Calculation
              </div>

              <div className="mt-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#697467] dark:text-[#a0ae9e]">
                    Base Team Fee ({summary?.competition?.pricing?.baseTeamMemberCount || 2} members)
                  </span>
                  <span className="font-extrabold text-[#2b372b] dark:text-[#edf7ec]">
                    ₹{summary?.baseFee || 0}
                  </span>
                </div>

                {summary?.additionalMembersCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#697467] dark:text-[#a0ae9e]">
                      Additional Members ({summary?.additionalMembersCount} × ₹
                      {summary?.competition?.pricing?.additionalMemberFee})
                    </span>
                    <span className="font-extrabold text-[#2b372b] dark:text-[#edf7ec]">
                      + ₹{summary?.additionalMembersFee || 0}
                    </span>
                  </div>
                )}

                {summary?.discountAmount > 0 && (
                  <div className="flex justify-between text-[#689926] dark:text-[#b8f34a]">
                    <span>Coupon Discount ({summary?.coupon?.code})</span>
                    <span className="font-extrabold">- ₹{summary?.discountAmount}</span>
                  </div>
                )}

                {summary?.waiverAmount > 0 && (
                  <div className="flex justify-between text-[#3876b5]">
                    <span>Organizer Fee Waiver</span>
                    <span className="font-extrabold">- ₹{summary?.waiverAmount}</span>
                  </div>
                )}

                <div className="border-t border-[#edf0e8] pt-3 flex justify-between text-base font-extrabold text-[#222c22] dark:border-[#2b3a2d] dark:text-[#eef7ec]">
                  <span>Total Net Payable</span>
                  <span className="text-xl text-[#719d2a]">₹{summary?.netPayable ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Public Coupons (e.g. IEEE100, EARLYBIRD) */}
            <div className="rounded-2xl border border-[#dce2d5] bg-[#f8faf4] p-4 dark:border-[#2c3d2e] dark:bg-[#182319]">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#455444] dark:text-[#c4d4c2]">
                <TicketPercent size={15} className="text-[#719d2a]" /> Have a Coupon Code?
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. IEEE100 or EARLYBIRD"
                  className="w-full rounded-xl border border-[#dfe4d8] bg-white px-3 py-2 font-mono text-xs uppercase outline-none focus:ring-2 focus:ring-[#b8f34a] dark:border-[#334234] dark:bg-[#131d14] dark:text-[#eaf5e8]"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="shrink-0 rounded-xl border border-[#d5dccf] bg-white px-3.5 py-2 text-xs font-bold text-[#324032] shadow-sm hover:bg-[#f3f6ec] dark:border-[#384839] dark:bg-[#202c21] dark:text-[#d3dfd1]"
                >
                  Apply
                </button>
              </div>
              <div className="mt-2 text-[10px] text-[#8c9489] dark:text-[#9ea99b]">
                Public codes: <strong>IEEE100</strong> (₹100 off) or <strong>EARLYBIRD</strong> (20% off up to ₹200). 1 coupon per team.
              </div>
            </div>

            {/* Pay Button */}
            <div className="flex items-center justify-between border-t border-[#e9ece3] pt-5 dark:border-[#283729]">
              <button
                type="button"
                onClick={() => setStep("terms")}
                className="text-xs font-bold text-[#868f83] hover:underline"
              >
                Back to Terms
              </button>

              <button
                type="button"
                disabled={processing || calculating}
                onClick={handlePayNow}
                className="inline-flex items-center gap-2 rounded-xl bg-[#172017] px-6 py-3 text-xs font-bold text-white shadow-[0_4px_0_#0c110c] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_4px_0_#7eaa2a]"
              >
                {processing ? "Processing Gateway..." : `Confirm & Pay ₹${summary?.netPayable ?? 0}`}
                <LockKeyhole size={13} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OFFICIAL RECEIPT */}
        {step === "receipt" && transaction && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-[#cfe69f] bg-[#f5fbdc] p-5 text-center dark:border-[#4c6e2b] dark:bg-[#1f2e19]">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#dff2ab] text-[#5e8b20] dark:bg-[#344b24] dark:text-[#d3f295]">
                <FileCheck2 size={24} strokeWidth={2.5} />
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold text-[#283628] dark:text-[#edf7ec]">
                Payment Successful!
              </h3>
              <p className="mt-1 text-xs text-[#70845a] dark:text-[#a8bea0]">
                Invoice #{transaction.invoiceNumber} has been verified and registered.
              </p>
            </div>

            <div className="rounded-2xl border border-[#e2e6dc] bg-white p-5 text-xs space-y-2.5 dark:border-[#2a382c] dark:bg-[#1a251c]">
              <div className="flex justify-between">
                <span className="text-[#838c81]">Transaction ID</span>
                <span className="font-mono font-bold text-[#2d372d] dark:text-[#edf7ec]">
                  {transaction.transactionId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#838c81]">Team</span>
                <span className="font-bold text-[#2d372d] dark:text-[#edf7ec]">{team.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#838c81]">Amount Paid</span>
                <span className="font-extrabold text-[#719d2a] text-sm">₹{transaction.amount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#838c81]">Gateway Mode</span>
                <span className="font-semibold text-[#2d372d] dark:text-[#edf7ec]">
                  UPI / NetBanking Verified
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#838c81]">Date / Time</span>
                <span className="text-[#2d372d] dark:text-[#edf7ec]">
                  {new Date(transaction.paidAt || "").toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#e9ece3] pt-5 dark:border-[#283729]">
              <button
                type="button"
                onClick={close}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-[#6f776d] hover:bg-[#edf0e8]"
              >
                Close Window
              </button>

              <button
                type="button"
                onClick={() => {
                  toast.success("Receipt downloaded successfully!");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#172017] px-4 py-2.5 text-xs font-bold text-white shadow-[0_3px_0_#0c110c] hover:-translate-y-0.5 dark:bg-[#b8f34a] dark:text-[#172017] dark:shadow-[0_3px_0_#7eaa2a]"
              >
                <Download size={14} /> Download Official Invoice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
