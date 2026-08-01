import { useZxing } from "react-zxing";
import { toast } from "sonner";

export default function IsbnScannerView({ onResult }: { onResult: (text: string) => void }) {
  const { ref } = useZxing({
    constraints: {
      video: {
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
      },
      audio: false,
    },
    timeBetweenDecodingAttempts: 150,
    onDecodeResult: (result) => onResult((result as unknown as { getText(): string }).getText()),
    onError: () => {
      toast.error("Não foi possível acessar a câmera. Você pode digitar o ISBN manualmente.");
    },
  });

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video
        ref={ref}
        playsInline
        muted
        autoPlay
        className="h-[320px] w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-28 w-[80%] rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">
        Aproxime o código de barras e mantenha firme
      </p>
    </div>
  );
}
