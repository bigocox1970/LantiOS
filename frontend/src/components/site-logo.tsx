import Link from "next/link";

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
        sm: 24,
        md: 32,
        lg: 48,
        xl: 72,
    };

    const logo = (
        <h1
            className={`flex items-center gap-3 ${sizeClasses[size]} font-normal font-fraunces ${
                animate ? "sidebar-fade-in" : ""
            } ${className}`}
        >
            <img
                src="/favicon-96x96.png"
                alt="Lanti OS"
                width={iconSizes[size]}
                height={iconSizes[size]}
                className="rounded-sm flex-shrink-0"
            />
            <span><span className="italic">Lanti</span> OS</span>
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
