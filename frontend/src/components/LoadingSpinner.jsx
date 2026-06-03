const sizeMap = {
  sm: 'h-6 w-6 border-2',
  md: 'h-10 w-10 border-2',
  lg: 'h-16 w-16 border-4',
};

export default function LoadingSpinner({ size = 'md', fullScreen = false }) {
  const spinnerClass = `${sizeMap[size] ?? sizeMap.md} animate-spin rounded-full border-red-500 border-t-transparent`;

  const spinner = (
    <div className="flex items-center justify-center">
      <div className={spinnerClass} role="status" aria-label="Loading">
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full h-full py-12">
      {spinner}
    </div>
  );
}
