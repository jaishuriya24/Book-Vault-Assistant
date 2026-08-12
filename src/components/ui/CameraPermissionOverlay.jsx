import React from "react";
import SpotlightCard from "./SpotlightCard";

export default function CameraPermissionOverlay({
  cameraReady,
  cameraError,
  onRetry,
  onSwitchToPassword,
}) {
  // When camera is live and ready, keep the camera feed 100% clean with no obstructive overlays
  if (cameraReady && !cameraError) {
    return null;
  }

  // Camera Connecting or Permission Denied State
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-gradient-to-b from-[#0e1117] via-[#090b0e] to-black text-white">
      <SpotlightCard
        className="w-full max-w-sm p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl text-center flex flex-col items-center gap-4"
        spotlightColor={cameraError ? "rgba(239, 68, 68, 0.25)" : "rgba(234, 88, 12, 0.25)"}
      >
        {/* Holographic Lens Icon */}
        <div className="relative flex items-center justify-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
              cameraError
                ? "bg-red-500/10 border border-red-500/30 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.2)]"
                : "bg-orange-500/10 border border-orange-500/30 text-orange-400 shadow-[0_0_30px_rgba(234,88,12,0.25)]"
            }`}
          >
            {cameraError ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
              </svg>
            ) : (
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="absolute text-orange-400"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Title & Instructions */}
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white tracking-tight">
            {cameraError ? "Camera Access Needed" : "Connecting Camera..."}
          </h3>
          <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
            {cameraError
              ? "Please allow camera access in your browser to log in with face recognition."
              : "Starting your webcam for face recognition..."}
          </p>
        </div>

        {/* Action Button */}
        <div className="w-full flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            onClick={onRetry}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white shadow-lg transition-all duration-200 active:scale-98 cursor-pointer flex items-center justify-center gap-2 ${
              cameraError
                ? "bg-red-600 hover:bg-red-500 shadow-red-600/30"
                : "bg-orange-600 hover:bg-orange-500 shadow-orange-600/30"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <span>{cameraError ? "Grant Permission & Retry" : "Enable Camera"}</span>
          </button>

          {onSwitchToPassword && (
            <button
              type="button"
              onClick={onSwitchToPassword}
              className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer py-1"
            >
              Switch to Password Login →
            </button>
          )}
        </div>

        {/* Helpful Browser Tip */}
        <div className="text-[11px] text-neutral-400 bg-neutral-950/60 border border-neutral-800/60 rounded-xl px-3 py-2 text-left w-full mt-1">
          💡 <span className="font-semibold text-neutral-300">Tip:</span> If blocked, click the 🔒 icon in the URL bar, allow <b>Camera</b>, and tap Retry.
        </div>
      </SpotlightCard>
    </div>
  );
}
