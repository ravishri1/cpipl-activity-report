/**
 * Reusable loading spinner.
 * Usage: <LoadingSpinner />
 * Usage: <LoadingSpinner className="h-32" size="w-6 h-6" />
 */
export default function LoadingSpinner({ className = 'h-64', size = 'w-8 h-8' }) {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div
        className={`${size} border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin`}
      />
    </div>
  );
}
