import { useEffect, useRef, useState } from "react";
import { useZxing } from "react-zxing";
import { toast } from "sonner";

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const CAMERA_ERROR = "Não foi possível acessar a câmera. Você pode digitar o nome de usuário manualmente.";

function Overlay() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-48 w-48 rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-xs text-white/80">
        Centralize o QR Code e mantenha firme
      </p>
    </>
  );
}

export default function QrScannerView({ onResult }: { onResult: (text: string) => void }) {
  const [mode, setMode] = useState<"pending" | "native" | "zxing">("pending");

  useEffect(() => {
    setMode(typeof window !== "undefined" && "BarcodeDetector" in window ? "native" : "zxing");
  }, []);

  if (mode === "pending") {
    return <div className="h-[320px] rounded-xl bg-black" aria-label="Iniciando câmera" />;
  }
  return mode === "native" ? <NativeQr onResult={onResult} /> : <ZxingQr onResult={onResult} />;
}

function NativeQr({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);

        const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
          .BarcodeDetector;
        const detector = new Detector({ formats: ["qr_code"] });

        let busy = false;
        let last = 0;
        const tick = async (time: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (busy || time - last < 200) return;
          last = time;
          busy = true;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const value = codes[0]?.rawValue;
              if (!stopped && value) {
                stopped = true;
                cancelAnimationFrame(raf);
                resultRef.current(value);
              }
            }
          } catch {
            /* ignora erros transitórios */
          } finally {
            busy = false;
          }
        };
        raf = requestAnimationFrame(tick);
      } catch {
        if (!stopped) toast.error(CAMERA_ERROR);
      }
    }

    void start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} playsInline muted autoPlay className="h-[320px] w-full object-cover" />
      <Overlay />
    </div>
  );
}

function ZxingQr({ onResult }: { onResult: (text: string) => void }) {
  const { ref } = useZxing({
    constraints: {
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    },
    timeBetweenDecodingAttempts: 150,
    onDecodeResult: (result) => onResult((result as unknown as { getText(): string }).getText()),
    onError: () => {
      toast.error(CAMERA_ERROR);
    },
  });

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={ref} playsInline muted autoPlay className="h-[320px] w-full object-cover" />
      <Overlay />
    </div>
  );
}