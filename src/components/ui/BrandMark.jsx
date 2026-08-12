import { Volume2 } from "lucide-react";

export default function BrandMark({ showVoice = true }) {
  return (
    <div className="flex items-center gap-2">
      {/* Logo */}
      <img
        src="/Logo-book.png"
        alt="Book Vault Logo"
        className="w-10 h-10 rounded-xl object-cover"
      />

      {showVoice && (
        <button
          aria-label="Read screen aloud"
          className="w-9 h-9 flex items-center justify-center rounded-full text-stone-700 hover:bg-stone-200 transition"
          onClick={() => {
            if ('speechSynthesis' in window && window.speechSynthesis) {
              const text = document.body.innerText;
              const speech = new SpeechSynthesisUtterance(text);
              window.speechSynthesis.speak(speech);
            } else {
              alert("Text-to-speech is not supported on this device.");
            }
          }}
        >
          <Volume2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}