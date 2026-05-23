import Link from "next/link";
import { LantiIcon } from "@/components/chat/lanti-icon";

interface SiteLogoProps {
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    animate?: boolean;
    asLink?: boolean;
}

export function SiteLogo({
    size = "md",
    className = "",
    animate = false,
    asLink = false,
}: SiteLogoProps) {
    const sizeClasses = {
        sm: "text-xl",
        md: "text-2xl",
        lg: "text-4xl",
        xl: "text-6xl",
    };

    const iconSizes = {
        sm: 20,
        md: 22,
        lg: 32,
        xl: 48,
    };

    const logo = (
        <h1
            className={`flex items-center gap-2 ${sizeClasses[size]} font-semibold ${
                animate ? "sidebar-fade-in" : ""
            } ${className}`}
        >
            <LantiIcon size={iconSizes[size]} />
            <span>Lanti OS</span>
        </h1>
    );

    if (asLink) {
        return (
            <Link
                href="/"
                className="cursor-pointer hover:opacity-80 transition-opacity"
            >
                {logo}
            </Link>
        );
    }

    return logo;
}
