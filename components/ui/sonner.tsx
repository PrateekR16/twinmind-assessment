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
      }}
    />
  );
}
