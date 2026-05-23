"use client";

import { useId } from "react";

export function LantiIcon({ size = 24 }: { size?: number }) {
    const id = useId().replace(/:/g, "");
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "block", flexShrink: 0 }}
        >
            <defs>
                <linearGradient
                    id={`lanti-g-${id}`}
                    x1="0"
                    y1="0"
                    x2="28"
                    y2="28"
                    gradientUnits="userSpaceOnUse"
                >
                    <stop offset="0%" stopColor="#E8895F" />
                    <stop offset="100%" stopColor="#C4623B" />
                </linearGradient>
            </defs>
            <rect width="28" height="28" rx="7" fill={`url(#lanti-g-${id})`} />
            <path
                d="M8.5 7.5H11V19H19.5V21.5H8.5Z"
                fill="rgba(255,255,255,0.95)"
            />
        </svg>
    );
}
