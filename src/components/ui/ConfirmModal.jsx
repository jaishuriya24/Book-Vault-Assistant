import React, { useState, useEffect, useCallback } from "react";
import notify from "../../services/notificationService";
import SpotlightCard from "./SpotlightCard";

export default function ConfirmModal() {
  const [activeConfirm, setActiveConfirm] = useState(null);

  useEffect(() => {
    const unsubscribe = notify.subscribeConfirm((confirmData) => {
      setActiveConfirm(confirmData);
    });

    return unsubscribe;
  }, []);

  const handleConfirm = useCallback(() => {
    if (activeConfirm?.onConfirm) {
      activeConfirm.onConfirm();
    }
    setActiveConfirm(null);
  }, [activeConfirm]);

  const handleCancel = useCallback(() => {
    if (activeConfirm?.onCancel) {
      activeConfirm.onCancel();
    }
    setActiveConfirm(null);
  }, [activeConfirm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!activeConfirm) return;
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter") {
        handleConfirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeConfirm, handleCancel, handleConfirm]);

  if (!activeConfirm) return null;

  const isDanger = activeConfirm.type === "danger";
  const spotlightColor = isDanger ? "rgba(239, 68, 68, 0.28)" : "rgba(249, 115, 22, 0.3)";

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      {/* Ambient background glow */}
      <div className="absolute w-96 h-96 rounded-full bg-orange-500/10 blur-[100px] pointer-events-none" />

      {/* SpotlightCard Modal */}
      <div className="relative w-full max-w-[440px] animate-modal-pop">
        <SpotlightCard
          className="p-7 text-center bg-neutral-950/95 border-white/15 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl rounded-3xl"
          spotlightColor={spotlightColor}
        >
          {/* Subtle top ambient light line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

          {/* Ambient Pulsing Icon Badge */}
          <div className="mx-auto mb-5 relative flex items-center justify-center">
            <div className={`absolute w-16 h-16 rounded-2xl animate-ping opacity-25 ${
              isDanger ? "bg-rose-500" : "bg-orange-500"
            }`} />
            <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl border ${
              isDanger
                ? "bg-gradient-to-br from-rose-500/20 to-orange-500/10 border-rose-500/40 text-rose-400 shadow-rose-500/20"
                : "bg-gradient-to-br from-orange-500/20 to-amber-500/10 border-orange-500/40 text-orange-400 shadow-orange-500/20"
            }`}>
              <span>{activeConfirm.icon || (isDanger ? "🚪" : "⚠️")}</span>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold tracking-tight text-white mb-2 font-serif">
            {activeConfirm.title}
          </h3>

          {/* Description Message */}
          <p className="text-xs sm:text-sm text-neutral-300/90 leading-relaxed max-w-sm mx-auto mb-7 font-sans">
            {activeConfirm.message}
          </p>

          {/* Actions Button Grid */}
          <div className="grid grid-cols-2 gap-3 w-full relative z-10">
            <button
              type="button"
              onClick={handleCancel}
              className="py-3.5 px-4 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 rounded-2xl text-neutral-300 hover:text-white text-xs font-semibold tracking-wide transition-all active:scale-[0.98] cursor-pointer"
            >
              {activeConfirm.cancelText || "Cancel"}
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              className={`py-3.5 px-4 text-white text-xs font-bold rounded-2xl transition-all shadow-xl active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 ${
                isDanger
                  ? "bg-gradient-to-r from-rose-600 via-orange-600 to-rose-600 hover:from-rose-500 hover:to-orange-500 shadow-rose-600/30"
                  : "bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/30"
              }`}
            >
              {activeConfirm.confirmText || "Confirm"}
            </button>
          </div>

          {/* Accessible Keyboard Shortcut Hints */}
          <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-500 mt-5 font-mono">
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px]">Enter</kbd> Confirm
            </span>
            <span className="text-neutral-700">•</span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400 text-[10px]">Esc</kbd> Cancel
            </span>
          </div>
        </SpotlightCard>
      </div>

      <style>{`
        @keyframes modalPop {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-pop {
          animation: modalPop 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
}
