import React, { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, QrCode, X, Zap } from "lucide-react";
import { toast } from "sonner";

interface QRScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanResult?: (token: string) => void;
}

export function QRScannerModal({ open, onClose, onScanResult }: QRScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
        setCameraActive(true);
      }
    } catch (err) {
      console.warn("[QR SCANNER] Native camera access not available or permission denied:", err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const handleSimulatedScan = (codeToUse?: string) => {
    const code = codeToUse || manualCode || `QR_PASS_${Math.floor(100000 + Math.random() * 900000)}`;
    setScanning(true);
    setTimeout(() => {
      setLastScanned(code);
      setScanning(false);
      toast.success(`Check-in verified: ${code}`);
      onScanResult?.(code);
      setManualCode("");
    }, 600);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#172017]/60 p-4 backdrop-blur-md">
      <div className="w-full max-w-[500px] overflow-hidden rounded-3xl border border-white/40 bg-[#fbfcf7] shadow-2xl dark:border-[#273528] dark:bg-[#142016]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e9ece2] p-5 dark:border-[#273528]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#eaf7cf] text-[#638f25] dark:bg-[#263b1d] dark:text-[#b8f34a]">
              <QrCode size={19} />
            </div>
            <div>
              <h3 className="font-display text-lg font-extrabold tracking-[-0.04em] text-[#243024] dark:text-[#e8efe3]">
                Event Check-in Scanner
              </h3>
              <p className="text-[11px] text-[#868d83] dark:text-[#9cb09c]">
                Point camera at Digital Pass QR or enter code
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="rounded-lg p-2 text-[#788075] hover:bg-[#edf0e8] dark:text-[#9cb09c] dark:hover:bg-[#202d21]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="p-5">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-[#0f1710] border border-[#273528] flex items-center justify-center">
            {cameraActive ? (
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-[#7d8f7d]">
                <Camera size={32} className="text-[#b8f34a] animate-pulse" />
                <p className="text-xs font-semibold text-[#c8d4c8]">
                  Camera feed active or simulated environment
                </p>
                <p className="text-[10px] text-[#7d8f7d]">
                  Use the quick scan trigger below to verify event check-in passes
                </p>
              </div>
            )}

            {/* Scanning Overlay Box */}
            <div className="pointer-events-none absolute inset-8 border-2 border-dashed border-[#b8f34a]/70 rounded-xl flex items-center justify-center">
              <div className="h-0.5 w-full bg-[#b8f34a] animate-ping opacity-75" />
            </div>
          </div>

          {/* Quick Scan & Code Input */}
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter QR token code (e.g. PASS_8912)"
                onKeyDown={(e) => e.key === "Enter" && handleSimulatedScan()}
                className="flex-1 rounded-xl border border-[#dde2d6] bg-[#fafcf7] px-3.5 py-2.5 text-xs outline-none focus:border-[#a7ca61] focus:ring-2 focus:ring-[#dff2ab] dark:border-[#324133] dark:bg-[#101a11] dark:text-[#e8f5e0]"
              />
              <button
                type="button"
                disabled={scanning}
                onClick={() => handleSimulatedScan()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#172017] px-4 py-2.5 text-xs font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-50 dark:bg-[#b8f34a] dark:text-[#172017]"
              >
                {scanning ? <Zap size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Verify Scan
              </button>
            </div>

            {lastScanned && (
              <div className="rounded-xl border border-[#cfe9a5] bg-[#f2fbdc] p-3 text-xs font-bold text-[#3e6317] dark:border-[#385928] dark:bg-[#1a2d18] dark:text-[#b8f34a]">
                ✓ Successfully checked in: {lastScanned}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
