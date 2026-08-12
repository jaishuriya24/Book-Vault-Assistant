export default function PrimaryButton({ children, ...props }) {
  return (
    <button
      {...props}
      className="w-full bg-slate-700 hover:bg-slate-800 text-white py-3 rounded-lg font-semibold text-sm"
    >
      {children}
    </button>
  );
}