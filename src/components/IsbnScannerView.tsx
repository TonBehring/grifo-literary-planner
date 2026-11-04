import { useEffect, useRef, useState } from "react";
import { BarcodeDetector } from "barcode-detector/ponyfill";
import { Keyboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
};
type BarcodeDetectorCtor = new (options?: {
  formats?: Array<"ean_13" | "ean_8" | "upc_a" | "upc_e">;
}) => BarcodeDetectorLike;

const CAMERA_ERROR = "Não foi possível acessar a câmera. Você pode digitar o ISBN manualmente.";

export default function IsbnScannerView({ onResult, onManualEntry }: {
  onResult: (text: string) => void;
  onManualEntry: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const [showManualEntry, setShowManualEntry] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const video = videoRef.current;
    const timeout = window.setTimeout(() => setShowManualEntry(true), 8000);

    function stopCamera() {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      stream?.getTracks().forEach((track) => track.stop());
      if (video) video.srcObject = null;
    }

    async function start() {
      try {
        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
          .BarcodeDetector ?? BarcodeDetector;
        const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (stopped || !video) {
          stopCamera();
          return;
        }
        video.srcObject = stream;
        await video.play();
        const track = stream.getVideoTracks()[0];
        if (track && !stopped) {
          try {
            const capabilities = track.getCapabilities?.() as
              (MediaTrackCapabilities & { focusMode?: string[] }) | undefined;
            if (capabilities?.focusMode?.includes("continuous")) {
              await track.applyConstraints({
                advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
              });
            }
          } catch {
            // Focus is optional; unsupported controls must not stop scanning.
          }
        }
        if (stopped) return;
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
                stopCamera();
                resultRef.current(value);
              }
            }
          } catch {
            // Ignore transient failures while the camera is adjusting.
          } finally {
            busy = false;
          }
        };
        raf = requestAnimationFrame(tick);
      } catch {
        stopCamera();
        if (!stopped) {
          setShowManualEntry(true);
          toast.error(CAMERA_ERROR);
        }
      }
    }
    void start();
    return () => {
      stopped = true;
      stopCamera();
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        <video ref={videoRef} playsInline muted autoPlay className="h-[320px] w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-28 w-[80%] rounded-xl border-2 border-gold" />
        </div>
        <p className="pointer-events-none absolute bottom-3 inset-x-3 rounded-md bg-foreground/80 px-2 py-2 text-center text-xs text-background">
          Afaste um pouco o livro (uns 15 cm) e mantenha o código dentro do quadro
        </p>
      </div>
      {showManualEntry && (
        <Button type="button" variant="outline" className="w-full" onClick={onManualEntry}>
          <Keyboard /> Digitar o ISBN
        </Button>
      )}
    </div>
  );
}
