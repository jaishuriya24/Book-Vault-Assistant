import { ChevronLeft } from "lucide-react";

export default function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Go back"
      className="w-9 h-9 flex items-center justify-center rounded-full text-stone-700 hover:bg-stone-200 transition"
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  );
}