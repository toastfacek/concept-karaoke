interface IconProps {
  size?: number
  className?: string
}

// PLAYER CHARACTERS - Cartoony faces with personality
export function CreativeIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Happy creative with wild hair */}
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      {/* Wild hair spikes */}
      <path d="M8 4 L8 2 M12 3 L12 1 M16 4 L16 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Happy eyes */}
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
      <circle cx="15" cy="11" r="1.5" fill="currentColor" />
      {/* Big smile */}
      <path d="M8 15 Q12 17 16 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function StrategistIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Thinking face with glasses */}
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      {/* Glasses */}
      <rect x="7" y="10" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
      <rect x="13" y="10" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="2" fill="none" />
      <line x1="11" y1="11.5" x2="13" y2="11.5" stroke="currentColor" strokeWidth="2" />
      {/* Thoughtful mouth */}
      <line x1="10" y1="16" x2="14" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function ClientIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Business person with tie */}
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      {/* Serious eyes */}
      <line x1="8" y1="11" x2="10" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Tie */}
      <path d="M12 14 L12 18 L10 16 L14 16 Z" fill="currentColor" />
      {/* Neutral mouth */}
      <line x1="10" y1="15" x2="14" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// IDEA & CREATIVITY ICONS
export function LightbulbIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Bulb */}
      <circle cx="12" cy="10" r="5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      {/* Base */}
      <rect x="10" y="15" width="4" height="3" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="18" width="6" height="2" fill="currentColor" />
      {/* Shine lines */}
      <line x1="12" y1="3" x2="12" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="6" y1="6" x2="7.5" y2="7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="6" x2="16.5" y2="7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function BrainstormIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Brain cloud shape */}
      <path
        d="M7 12 Q5 10 7 8 Q9 6 11 7 Q13 5 15 7 Q17 6 19 8 Q21 10 19 12 Q21 14 19 16 Q17 18 15 17 Q13 19 11 17 Q9 18 7 16 Q5 14 7 12 Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Lightning bolt for idea */}
      <path d="M12 9 L10 13 L12 13 L11 17 L14 12 L12 12 Z" fill="currentColor" />
    </svg>
  )
}

export function SparkleIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Star sparkle */}
      <path d="M12 2 L13 10 L21 11 L13 12 L12 20 L11 12 L3 11 L11 10 Z" fill="currentColor" />
      {/* Small sparkles */}
      <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="6" r="1.5" fill="currentColor" />
      <circle cx="18" cy="18" r="1.5" fill="currentColor" />
    </svg>
  )
}

// CAMPAIGN & MEDIA ICONS
export function MegaphoneIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Megaphone body */}
      <path d="M4 10 L4 14 L8 16 L8 8 Z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <path d="M8 8 L20 4 L20 20 L8 16" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      {/* Sound waves */}
      <path d="M22 8 L24 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 12 L25 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 16 L24 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function BillboardIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Billboard */}
      <rect
        x="3"
        y="5"
        width="18"
        height="10"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Posts */}
      <rect x="7" y="15" width="2" height="7" fill="currentColor" />
      <rect x="15" y="15" width="2" height="7" fill="currentColor" />
      {/* Ad content */}
      <rect x="6" y="8" width="5" height="4" fill="currentColor" />
      <line x1="13" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="13" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function TVIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* TV screen */}
      <rect
        x="3"
        y="6"
        width="18"
        height="13"
        rx="1"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Antenna */}
      <path d="M8 6 L6 2 M16 6 L18 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Screen content */}
      <rect x="6" y="9" width="12" height="7" fill="currentColor" fillOpacity="0.3" />
      {/* Stand */}
      <rect x="10" y="19" width="4" height="2" fill="currentColor" />
    </svg>
  )
}

export function SocialMediaIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Phone */}
      <rect
        x="7"
        y="3"
        width="10"
        height="18"
        rx="2"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Heart icon on screen */}
      <path d="M12 16 L9 13 Q8 12 9 11 Q10 10 11 11 L12 12 L13 11 Q14 10 15 11 Q16 12 15 13 Z" fill="currentColor" />
      {/* Notification dots */}
      <circle cx="12" cy="5" r="1" fill="currentColor" />
    </svg>
  )
}

// TOOLS & ACTIONS
export function PencilIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Pencil body */}
      <path
        d="M4 20 L8 16 L16 8 L20 12 L12 20 Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Pencil tip */}
      <path d="M16 8 L20 12 L22 10 L18 6 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      {/* Eraser */}
      <rect x="2" y="18" width="4" height="4" fill="currentColor" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function CameraIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Camera body */}
      <rect
        x="3"
        y="8"
        width="18"
        height="12"
        rx="2"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Lens */}
      <circle cx="12" cy="14" r="4" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      {/* Flash */}
      <rect x="9" y="5" width="6" height="3" fill="currentColor" />
      {/* Shutter button */}
      <circle cx="18" cy="11" r="1" fill="currentColor" />
    </svg>
  )
}

export function PaintbrushIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Brush handle */}
      <path d="M4 20 L10 14 L14 18 L8 24 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      {/* Brush head */}
      <path
        d="M10 14 L18 6 L20 8 L12 16 Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Paint drip */}
      <circle cx="6" cy="22" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function ClapperboardIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Board */}
      <rect
        x="3"
        y="10"
        width="18"
        height="11"
        rx="1"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Clapper top */}
      <path d="M3 10 L5 6 L19 6 L21 10 Z" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      {/* Stripes */}
      <line x1="8" y1="6" x2="10" y2="10" stroke="currentColor" strokeWidth="2" />
      <line x1="13" y1="6" x2="15" y2="10" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// GAME MECHANICS
export function TimerIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Clock face */}
      <circle cx="12" cy="13" r="8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      {/* Clock hands */}
      <line x1="12" y1="13" x2="12" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Wind-up key */}
      <rect x="10" y="3" width="4" height="2" fill="currentColor" />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
    </svg>
  )
}

export function TrophyIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Cup */}
      <path
        d="M7 4 L7 10 Q7 14 12 14 Q17 14 17 10 L17 4 Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Handles */}
      <path d="M7 6 L4 6 Q3 6 3 8 Q3 10 4 10 L7 10" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M17 6 L20 6 Q21 6 21 8 Q21 10 20 10 L17 10" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* Base */}
      <rect x="10" y="14" width="4" height="4" fill="currentColor" />
      <rect x="8" y="18" width="8" height="2" fill="currentColor" />
      {/* Star on cup */}
      <path d="M12 7 L12.5 8.5 L14 9 L12.5 9.5 L12 11 L11.5 9.5 L10 9 L11.5 8.5 Z" fill="currentColor" />
    </svg>
  )
}

export function StarIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 2 L14.5 9 L22 10 L17 15 L18.5 22 L12 18 L5.5 22 L7 15 L2 10 L9.5 9 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ThumbsUpIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Thumb */}
      <path
        d="M7 11 L7 21 L17 21 Q19 21 19 19 L19 15 Q19 13 17 13 L15 13 L15 9 Q15 7 13 7 Q11 7 11 9 L11 11 Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Wrist */}
      <rect x="3" y="11" width="4" height="10" rx="1" fill="currentColor" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

export function VoteIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Ballot box */}
      <rect
        x="4"
        y="12"
        width="16"
        height="9"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Ballot paper */}
      <rect
        x="8"
        y="3"
        width="8"
        height="12"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Checkmark on ballot */}
      <path
        d="M10 8 L12 10 L15 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Slot */}
      <rect x="10" y="11" width="4" height="1" fill="currentColor" />
    </svg>
  )
}

// OBJECTS & ITEMS
export function CoffeeIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Cup */}
      <path
        d="M6 8 L6 16 Q6 18 8 18 L16 18 Q18 18 18 16 L18 8 Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Handle */}
      <path d="M18 10 L20 10 Q22 10 22 12 Q22 14 20 14 L18 14" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* Steam */}
      <path d="M9 5 Q9 3 10 3 Q11 3 11 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M13 5 Q13 3 14 3 Q15 3 15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Saucer */}
      <ellipse cx="12" cy="18" rx="8" ry="2" fill="currentColor" />
    </svg>
  )
}

export function NotebookIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Notebook */}
      <rect
        x="6"
        y="3"
        width="13"
        height="18"
        rx="1"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Spiral binding */}
      <line x1="6" y1="5" x2="6" y2="19" stroke="currentColor" strokeWidth="2" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="9" r="1" fill="currentColor" />
      <circle cx="6" cy="12" r="1" fill="currentColor" />
      <circle cx="6" cy="15" r="1" fill="currentColor" />
      <circle cx="6" cy="18" r="1" fill="currentColor" />
      {/* Lines */}
      <line x1="9" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="11" x2="15" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="14" x2="13" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function StickyNoteIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Note */}
      <path
        d="M4 4 L4 20 L16 20 L20 16 L20 4 Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Folded corner */}
      <path d="M16 20 L16 16 L20 16" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      {/* Text lines */}
      <line x1="7" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="11" x2="14" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="14" x2="11" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function BriefcaseIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Case */}
      <rect
        x="3"
        y="9"
        width="18"
        height="11"
        rx="1"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Handle */}
      <path d="M8 9 L8 6 Q8 4 10 4 L14 4 Q16 4 16 6 L16 9" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* Lock */}
      <rect x="11" y="13" width="2" height="3" fill="currentColor" />
      <circle cx="12" cy="13" r="1.5" fill="currentColor" />
    </svg>
  )
}

// REACTIONS & EMOTIONS
export function HappyFaceIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      <path d="M8 14 Q12 18 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function ThinkingFaceIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      <path d="M9 15 Q12 16 15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* Thought bubble */}
      <circle cx="18" cy="6" r="2" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="4" r="1" fill="currentColor" />
    </svg>
  )
}

export function ExcitedFaceIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="2" />
      {/* Star eyes */}
      <path d="M9 9 L9.5 10.5 L11 11 L9.5 11.5 L9 13 L8.5 11.5 L7 11 L8.5 10.5 Z" fill="currentColor" />
      <path d="M15 9 L15.5 10.5 L17 11 L15.5 11.5 L15 13 L14.5 11.5 L13 11 L14.5 10.5 Z" fill="currentColor" />
      {/* Big smile */}
      <path d="M7 14 Q12 19 17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function CollaborateIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Two people */}
      <circle cx="9" cy="8" r="3" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <circle cx="15" cy="8" r="3" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20 Q4 15 9 15 Q14 15 14 20" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M10 20 Q10 15 15 15 Q20 15 20 20" stroke="currentColor" strokeWidth="2" fill="none" />
    </svg>
  )
}

export function PresentIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      {/* Person */}
      <circle cx="8" cy="6" r="2" fill="currentColor" stroke="currentColor" strokeWidth="2" />
      <path d="M5 20 L5 12 Q5 10 8 10 Q11 10 11 12 L11 20" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* Presentation board */}
      <rect
        x="13"
        y="8"
        width="9"
        height="7"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="2"
      />
      {/* Stand */}
      <line x1="17.5" y1="15" x2="17.5" y2="20" stroke="currentColor" strokeWidth="2" />
      {/* Chart on board */}
      <path d="M15 13 L16 11 L18 12 L20 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}
