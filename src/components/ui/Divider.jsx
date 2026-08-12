export default function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="h-px flex-1 bg-stone-300" />
      <span className="text-xs text-stone-500">{label}</span>
      <div className="h-px flex-1 bg-stone-300" />
    </div>
  );
}