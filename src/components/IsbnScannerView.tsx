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

// Quantas leituras iguais seguidas são exigidas antes de aceitar o código.
// Uma leitura só, com o livro inclinado ou fora de foco, às vezes devolve um
// número errado que ainda passa no dígito verificador.
export const LEITURAS_CONFIRMACAO = 2;

// Só aceita código de barras de livro: EAN-13 começando com 978 ou 979 e com
// dígito verificador correto. Devolve o ISBN-13 ou null.
export function isbnFromBarcode(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 13 || !/^97[89]/.test(digits)) return null;
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  const verificador = (10 - (soma % 10)) % 10;
  return verificador === Number(digits[12]) ? digits : null;
}

export default function IsbnScannerView({ onResult, onManualEntry, continuous = false }: {
  onResult: (text: string) => void;
  onManualEntry?: () => void;
  // Modo lote: a câmera continua aberta depois de cada leitura e ignora
  // códigos que já foram lidos nesta sessão.
  continuous?: boolean;
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
        let candidato: string | null = null;
        let repeticoes = 0;
        const vistos = new Set<string>();
        const tick = async (time: number) => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (busy || time - last < 200) return;
          last = time;
          busy = true;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const isbn = codes.map((c) => isbnFromBarcode(c.rawValue)).find((v) => v !== null) ?? null;
              if (!isbn) {
                // Quadro sem código válido: não zera a contagem, para não
                // perder uma leitura boa por causa de um quadro borrado.
                return;
              }
              if (vistos.has(isbn)) return;
              if (isbn === candidato) {
                repeticoes += 1;
              } else {
                candidato = isbn;
                repeticoes = 1;
              }
              if (!stopped && repeticoes >= LEITURAS_CONFIRMACAO && continuous) {
                vistos.add(isbn);
                candidato = null;
                repeticoes = 0;
                try {
                  navigator.vibrate?.(60);
                } catch {
                  // Vibração é opcional.
                }
                resultRef.current(isbn);
                return;
              }
              if (!stopped && repeticoes >= LEITURAS_CONFIRMACAO) {
                stopped = true;
                stopCamera();
                resultRef.current(isbn);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl bg-foreground">
        <video ref={videoRef} playsInline muted autoPlay className="h-[320px] w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-28 w-[80%] rounded-xl border-2 border-gold" />
        </div>
        <p className="pointer-events-none absolute bottom-3 inset-x-3 rounded-md bg-foreground/80 px-2 py-2 text-center text-xs text-background">
          {continuous
            ? "Passe um livro de cada vez, com o código reto e dentro do quadro"
            : "Afaste um pouco o livro (uns 15 cm), deixe o código reto e dentro do quadro"}
        </p>
      </div>
      {showManualEntry && onManualEntry && (
        <Button type="button" variant="outline" className="w-full" onClick={onManualEntry}>
          <Keyboard /> Digitar o ISBN
        </Button>
      )}
    </div>
  );
}
