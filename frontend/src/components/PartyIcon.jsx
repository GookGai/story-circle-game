const paths = {
  install: <><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M12 7v8m-4-4h8M10 19h4" /></>,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
  secret: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  vote: (
    <>
      <path d="m9 3 7 3-3 7-7-3zM5 12H3v8h18v-8h-5M8 16h8" />
    </>
  ),
  horse: (
    <>
      <path d="M6 20v-5l4-4-2-4 4-4 1 3 5 3-1 5h-5v6M6 20h11M15 9h.01" />
      <path d="m9 4-4 6v6" />
    </>
  ),
  jump: (
    <>
      <path d="M3 10a9 9 0 0 1 18 0H3ZM12 1c-3 3-4 6-4 9m4-9c3 3 4 6 4 9M4 10l8 10 8-10M12 10v10" />
      <circle cx="12" cy="21" r="1" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2" />
    </>
  ),
  link: (
    <>
      <path
        d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0"
        transform="translate(1 0)"
      />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  crown: <path d="m3 6 4 4 5-7 5 7 4-4-2 14H5L3 6Z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  wifi: (
    <>
      <path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0" />
      <circle cx="12" cy="20" r="1" />
    </>
  ),
  exit: (
    <>
      <path d="M9 4H4v16h5M9 12h12m-5-5 5 5-5 5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 14v7m-4 0h8" />
    </>
  ),
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path
        d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01"
        strokeWidth="3"
      />
    </>
  ),
};
export default function PartyIcon({ name = "spark", size = 24, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.spark}
    </svg>
  );
}
