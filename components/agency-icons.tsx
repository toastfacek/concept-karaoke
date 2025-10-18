interface IconProps {
  className?: string
  size?: number
}

// Creative Director - Megaphone icon
export function CreativeDirectorIcon({ className = "", size = 48 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M8 18L24 12L24 36L8 30V18Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="bevel"
      />
      <path d="M24 14L38 10V38L24 34" stroke="currentColor" strokeWidth="2" strokeLinejoin="bevel" />
      <circle cx="40" cy="24" r="4" fill="currentColor" />
      <path d="M40 24L44 20M40 24L44 28" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  )
}

// Copywriter - Typewriter icon
export function CopywriterIcon({ className = "", size = 48 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="6" y="12" width="36" height="24" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="16" width="28" height="3" fill="currentColor" />
      <rect x="10" y="21" width="28" height="3" fill="currentColor" />
      <rect x="10" y="26" width="20" height="3" fill="currentColor" />
      <rect x="6" y="36" width="36" height="6" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="8" r="3" fill="currentColor" />
      <path d="M24 8V12" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// Art Director - Paintbrush icon
export function ArtDirectorIcon({ className = "", size = 48 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M32 8L40 16L20 36L12 38L14 30L32 8Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="bevel"
      />
      <path d="M28 12L36 20" stroke="white" strokeWidth="2" />
      <rect x="8" y="34" width="8" height="8" fill="currentColor" />
    </svg>
  )
}

// Account Manager - Briefcase icon
export function AccountManagerIcon({ className = "", size = 48 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="6" y="18" width="36" height="22" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <rect x="16" y="10" width="16" height="8" stroke="currentColor" strokeWidth="2" />
      <rect x="6" y="26" width="36" height="4" fill="white" />
      <circle cx="24" cy="28" r="2" fill="currentColor" />
    </svg>
  )
}

// Strategist - Lightbulb icon
export function StrategistIcon({ className = "", size = 48 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="24" cy="18" r="10" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <path d="M18 26H30V32H18V26Z" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="bevel" />
      <rect x="20" y="32" width="8" height="6" fill="currentColor" />
      <path d="M16 18L12 14M32 18L36 14M24 8V4" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  )
}

// Designer - Pen Tool icon
export function DesignerIcon({ className = "", size = 48 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <circle cx="36" cy="12" r="4" fill="currentColor" />
      <circle cx="24" cy="36" r="4" fill="currentColor" />
      <path d="M12 12Q24 24 36 12" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M12 12Q18 24 24 36" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M36 12Q30 24 24 36" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  )
}

// Producer - Clapperboard icon
export function ProducerIcon({ className = "", size = 48 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="6" y="20" width="36" height="20" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <path
        d="M6 14L42 8L42 20L6 20L6 14Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="bevel"
      />
      <rect x="10" y="10" width="6" height="10" fill="white" />
      <rect x="20" y="9" width="6" height="11" fill="white" />
      <rect x="30" y="8" width="6" height="12" fill="white" />
    </svg>
  )
}

// Media Planner - Calendar/Grid icon
export function MediaPlannerIcon({ className = "", size = 48 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="6" y="10" width="36" height="32" stroke="currentColor" strokeWidth="2" />
      <path d="M6 18H42M18 10V42M30 10V42" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="22" width="4" height="4" fill="currentColor" />
      <rect x="22" y="22" width="4" height="4" fill="currentColor" />
      <rect x="34" y="30" width="4" height="4" fill="currentColor" />
      <rect x="10" y="34" width="4" height="4" fill="currentColor" />
    </svg>
  )
}
