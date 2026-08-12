export default function Field({ label, type = "text", placeholder, trailing, value, onChange }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-sm font-medium mb-1.5 text-stone-700">
          {label}
        </span>
      )}

      <div className="relative">
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="w-full border border-stone-300 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-200"
        />
        {trailing}
      </div>
    </label>
  );
}