import Screen from "../../components/ui/Screen";
import BrandMark from "../../components/ui/BrandMark";
import PrimaryButton from "../../components/ui/PrimaryButton";

export default function OTPVerify({ goTo }) {
  return (
    <Screen>
      <div className="flex justify-between items-center mb-8">
        <button onClick={() => goTo("signup")}>Back</button>
        <BrandMark />
      </div>

      <h1 className="text-3xl font-serif mb-2">Verify OTP</h1>
      <p className="text-sm text-stone-500 mb-6">
        Enter the 4-digit code sent to your email
      </p>

      <div className="flex gap-3 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            maxLength={1}
            className="w-14 h-14 border rounded-lg text-center text-lg"
          />
        ))}
      </div>

      <PrimaryButton onClick={() => goTo("library")}>
        Confirm
      </PrimaryButton>

      <button className="text-sm text-slate-600 mt-4">
        Resend Code
      </button>
    </Screen>
  );
}