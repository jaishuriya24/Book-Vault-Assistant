import React, { useState, useEffect } from "react";
import notify from "../../services/notificationService";
import SpotlightCard from "./SpotlightCard";

export default function ToastNotification() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = notify.subscribe((toast) => {
      setToasts((prev) => [...prev, toast]);

      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== toast.id));
      }, toast.duration || 4000);
    });

    return unsubscribe;
  }, []);

  const removeToast = (id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[99999] flex flex-col gap-3.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3">
      {toasts.map((toast, index) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";

        const accentColor = isSuccess 
          ? "#10b981" 
          : isError 
          ? "#ef4444" 
          : isWarning 
          ? "#f59e0b" 
          : "#e07a3a"; // Book Vault Warm Brand Orange / Amber Theme Color

        const spotlightColor = isSuccess
          ? "rgba(16, 185, 129, 0.25)"
          : isError
          ? "rgba(239, 68, 68, 0.25)"
          : isWarning
          ? "rgba(245, 158, 11, 0.25)"
          : "rgba(224, 122, 58, 0.30)";

        // Extract title & subtitle if present or split message
        let title = toast.title;
        let subtitle = toast.message;
        if (!title) {
          if (toast.message.includes("!")) {
            const parts = toast.message.split("!");
            title = parts[0] + "!";
            subtitle = parts.slice(1).join("!").trim() || "Book Vault System Notification";
          } else if (toast.message.includes(".")) {
            const parts = toast.message.split(".");
            title = parts[0];
            subtitle = parts.slice(1).join(".").trim() || "Reading Companion Update";
          } else {
            title = toast.message;
            subtitle = isSuccess ? "Action completed successfully" : isError ? "Action failed to execute" : "System Notification";
          }
        }

        return (
          <div
            key={toast.id}
            style={{ animationDelay: `${index * 50}ms` }}
            className="pointer-events-auto group transform transition-all duration-300 animate-swipe-in-right hover:scale-[1.02]"
          >
            <SpotlightCard
              className="relative flex items-center justify-between p-3.5 pr-4 rounded-full bg-[#12151b]/95 border border-neutral-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden cursor-pointer"
              spotlightColor={spotlightColor}
            >
              {/* Left Action / Swiping Circular Badge */}
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-105"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 22px ${accentColor}80`,
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transform transition-transform group-hover:translate-x-0.5"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>

                {/* Notification Content */}
                <div className="flex flex-col min-w-0 text-left">
                  <h4 className="text-sm font-bold text-white tracking-tight truncate leading-snug">
                    {title}
                  </h4>
                  <p className="text-[11px] text-neutral-400 font-normal truncate mt-0.5 leading-none">
                    {subtitle}
                  </p>
                </div>
              </div>

              {/* Right Action Button / Dismiss Pill */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeToast(toast.id);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-white rounded-full transition-all duration-200 shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                  style={{
                    backgroundColor: accentColor,
                    boxShadow: `0 0 16px ${accentColor}60`,
                  }}
                >
                  {isSuccess ? "View" : isError ? "Retry" : "Dismiss"}
                </button>
              </div>

              {/* Bottom Subtle Countdown Progress */}
              <div
                className="absolute bottom-0 left-6 right-6 h-[2px] opacity-40 rounded-full animate-progress"
                style={{
                  backgroundColor: accentColor,
                  animationDuration: `${toast.duration || 4000}ms`,
                }}
              />
            </SpotlightCard>
          </div>
        );
      })}

      <style>{`
        @keyframes swipeInRight {
          0% {
            opacity: 0;
            transform: translateX(110%) scale(0.92);
          }
          65% {
            opacity: 1;
            transform: translateX(-8px) scale(1.01);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
        @keyframes progressCountdown {
          from { width: 100%; opacity: 0.6; }
          to { width: 0%; opacity: 0; }
        }
        .animate-swipe-in-right {
          animation: swipeInRight 0.38s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-progress {
          animation: progressCountdown linear forwards;
        }
      `}</style>
    </div>
  );
}
