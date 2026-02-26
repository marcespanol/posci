"use client";

interface MessageCircleIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function MessageCircleIcon({
  size = 14,
  strokeWidth = 2,
  className
}: MessageCircleIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
