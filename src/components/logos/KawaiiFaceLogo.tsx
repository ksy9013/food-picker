import { useId } from "react";

type Props = {
  className?: string;            // Tailwind로 크기/여백 제어 (예: "h-12 w-12")
  primary?: string;              // 라인/포인트 컬러
  cheek?: string;                // 볼터치 컬러
  background?: string;           // 배경(옵션)
  withBackground?: boolean;      // 배경 렌더링 여부
};

export default function KawaiiFaceLogo({
  className = "",
  primary = "#ef4444",           // tailwind red-500 느낌
  cheek = "#fda4af",             // rose-300 느낌
  background = "#fbe3e7",        // 연한 피치
  withBackground = false,
}: Props) {
  const gid = useId(); // 하이라이트 그라데언트 id 유니크하게
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 배경(옵션) */}
      {withBackground && (
        <rect x="4" y="4" width="120" height="120" rx="28" fill={background} />
      )}

      {/* 눈(세로 캡슐 + 하이라이트) */}
      <defs>
        <linearGradient id={`shine-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* 왼쪽 눈 */}
      <g transform="translate(34,32)">
        <rect x="0" y="0" width="22" height="44" rx="11" fill="none" stroke={primary} strokeWidth="4" />
        {/* 아래 채움 */}
        <rect x="2" y="22" width="18" height="20" rx="9" fill={primary} />
        {/* 하이라이트 */}
        <rect x="5" y="6" width="12" height="10" rx="6" fill={`url(#shine-${gid})`} />
      </g>

      {/* 오른쪽 눈 */}
      <g transform="translate(72,32)">
        <rect x="0" y="0" width="22" height="44" rx="11" fill="none" stroke={primary} strokeWidth="4" />
        <rect x="2" y="22" width="18" height="20" rx="9" fill={primary} />
        <rect x="5" y="6" width="12" height="10" rx="6" fill={`url(#shine-${gid})`} />
      </g>

      {/* 눈썹 */}
      <path d="M38 28c4-6 18-6 22 0" fill="none" stroke={primary} strokeWidth="4" strokeLinecap="round" />
      <path d="M78 28c4-6 18-6 22 0" fill="none" stroke={primary} strokeWidth="4" strokeLinecap="round" />

      {/* 볼터치 점들 */}
      <g fill={cheek}>
        <circle cx="36" cy="72" r="2.4" />
        <circle cx="30" cy="76" r="2.4" />
        <circle cx="42" cy="76" r="2.4" />
        <circle cx="92" cy="72" r="2.4" />
        <circle cx="86" cy="76" r="2.4" />
        <circle cx="98" cy="76" r="2.4" />
      </g>

      {/* 입(혀 내밀기) */}
      {/* 입 라인 */}
      <path
        d="M46 86c6 4 12 4 18 0"
        fill="none"
        stroke={primary}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* 가운데 코/입꼬리 느낌의 'w' 포인트 */}
      <path
        d="M56 82q2 3 4 0q2 3 4 0"
        fill="none"
        stroke={primary}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 혀(오른쪽으로 삐죽) */}
      <path
        d="M70 86c6 0 10 2 10 6c0 4-4 6-10 6c-4 0-6-2-6-5c0-4 2-7 6-7z"
        fill={primary}
        opacity="0.9"
      />
      <path
        d="M74 90c-2 1-4 1-6 0"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
