"use client";

import { useEffect } from "react";

interface PrintActionsProps {
  autoprint: boolean;
}

export default function PrintActions({ autoprint }: PrintActionsProps) {
  useEffect(() => {
    if (!autoprint) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      window.print();
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoprint]);

  return null;
}
