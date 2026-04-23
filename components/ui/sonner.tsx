"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: "#18181d",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.75)",
          fontSize: "13px",
        },
        classNames: {
          error:   "!border-red-500/40 !bg-red-950/60 [&>[data-icon]]:text-red-400 [&>[data-title]]:text-red-200",
          warning: "!border-orange-500/40 !bg-orange-950/60 [&>[data-icon]]:text-orange-400 [&>[data-title]]:text-orange-200",
          success: "!border-emerald-500/40 !bg-emerald-950/60 [&>[data-icon]]:text-emerald-400 [&>[data-title]]:text-emerald-200",
          info:    "!border-blue-500/40 !bg-blue-950/60 [&>[data-icon]]:text-blue-400 [&>[data-title]]:text-blue-200",
        },
      }}
    />
  );
}
