import { ScribblyLogo } from "@/components/scribbly-logo";

export function SplashScreen() {
  return (
    <div className="flex h-svh items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        <ScribblyLogo size={56} />
        <p className="text-[15px] font-medium tracking-tight">Scribbly</p>
        <div className="h-0.5 w-24 overflow-hidden rounded-full bg-border" aria-hidden>
          <span className="block h-full w-2/5 animate-[splash-slide_1s_ease-in-out_infinite] rounded-full bg-foreground" />
        </div>
      </div>
    </div>
  );
}
