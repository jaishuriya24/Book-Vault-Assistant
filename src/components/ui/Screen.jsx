export default function Screen({ children }) {
  return (
    <div className="w-full max-w-sm bg-stone-50 rounded-3xl shadow-xl border border-stone-200 px-6 py-8 min-h-[640px] flex flex-col">
      {children}
    </div>
  );
}