export default function Logo({ className = "" }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="16" className="fill-brand-100" />
        <path
          d="M16 24c-4 0-7-3-7-7 0-5 7-9 7-9s7 4 7 9c0 4-3 7-7 7Z"
          className="fill-brand-600"
        />
        <path
          d="M16 22V12M16 16l3-3M16 18l-3-3"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-xl font-extrabold tracking-tight text-ink">
        Ecosystem
      </span>
    </span>
  );
}
