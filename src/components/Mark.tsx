export function Mark({ size = 28 }: { size?: number }) {
  return (
    <span className="mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M8.5 21.5 16 9.5l7.5 12"
          stroke="var(--accent)"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
