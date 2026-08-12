import React from "react";

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function PopButton({ className, children, ...props }) {
  return (
    <button
      className={cn(
        "group relative inline-flex items-center justify-center font-semibold uppercase text-[#382b22] dark:text-[#382b22]",
        "px-8 py-5 rounded-xl bg-[#fff8f2] border-2 border-[#d35400]",
        "transition-all duration-150 ease-[cubic-bezier(0,0,0.58,1)]",
        "shadow-[0_12px_0_-2px_#fcdbc2,0_12px_0_0_#d35400,0_22px_0_0_#ffefe2]",
        "dark:shadow-[0_12px_0_-2px_#fcdbc2,0_12px_0_0_#d35400,0_22px_15px_-5px_rgba(0,0,0,0.3)]",
        "hover:bg-[#fff0e4] hover:translate-y-1 hover:shadow-[0_8px_0_-2px_#fcdbc2,0_8px_0_0_#d35400,0_16px_0_0_#ffefe2]",
        "dark:hover:shadow-[0_8px_0_-2px_#fcdbc2,0_8px_0_0_#d35400,0_16px_10px_-5px_rgba(0,0,0,0.3)]",
        "active:bg-[#fff0e4] active:translate-y-3 active:shadow-[0_0px_0_-2px_#fcdbc2,0_0px_0_0_#d35400,0_0px_0_0_#ffefe2]",
        "dark:active:shadow-[0_0px_0_-2px_#fcdbc2,0_0px_0_0_#d35400,0_0px_0_0_rgba(0,0,0,0)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default PopButton;
