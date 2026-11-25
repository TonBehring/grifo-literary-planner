import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import IsbnScannerView, { isbnFromBarcode } from "./IsbnScannerView";

const { detect, construct } = vi.hoisted(() => ({ detect: vi.fn(), construct: vi.fn() }));
vi.mock("barcode-detector/ponyfill", () => ({
  BarcodeDetector: class {
    constructor(options: unknown) { construct(options); }
    detect = detect;
  },
}));

let root: Root;
let container: HTMLDivElement;
let frame: FrameRequestCallback | undefined;
const stop = vi.fn();
const applyConstraints = vi.fn();
const getCapabilities = vi.fn();
const getUserMedia = vi.fn();
const onResult = vi.fn();
const onManualEntry = vi.fn();

beforeEach(async () => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => { frame = callback; return 1; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.defineProperty(window, "BarcodeDetector", { value: undefined, configurable: true });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "readyState", "get").mockReturnValue(2);
  getCapabilities.mockReturnValue({});
  applyConstraints.mockResolvedValue(undefined);
  const track = { stop, getCapabilities, applyConstraints };
  getUserMedia.mockResolvedValue({ getTracks: () => [track], getVideoTracks: () => [track] });
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
  detect.mockResolvedValue([]);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

async function render() {
  await act(async () => root.render(<IsbnScannerView onResult={onResult} onManualEntry={onManualEntry} />));
}

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("accepts only book barcodes (978/979) with a valid check digit", () => {
  expect(isbnFromBarcode("9786587408491")).toBe("9786587408491");
  expect(isbnFromBarcode("9788501012531")).toBe("9788501012531");
  // Leitura errada real: passa no dígito verificador, mas não é ISBN.
  expect(isbnFromBarcode("6766659408461")).toBeNull();
  expect(isbnFromBarcode("9786587408492")).toBeNull();
  expect(isbnFromBarcode("12345670")).toBeNull();
});

it("offers manual entry only after eight seconds without a read", async () => {
  await render();
  await act(async () => { vi.advanceTimersByTime(7999); });
  expect(container.querySelector("button")).toBeNull();
  await act(async () => { vi.advanceTimersByTime(1); });
  const button = container.querySelector("button");
  expect(button).not.toBeNull();
  await act(async () => button?.click());
  expect(onManualEntry).toHaveBeenCalledTimes(1);
});

it("uses the ponyfill with the four formats and a 1280x720 rear camera", async () => {
  await render();
  expect(construct).toHaveBeenCalledWith({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
  expect(getUserMedia).toHaveBeenCalledWith({ video: {
    facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 },
  }, audio: false });
  expect(applyConstraints).not.toHaveBeenCalled();
});

it("applies continuous focus only when supported and tolerates rejection", async () => {
  getCapabilities.mockReturnValue({ focusMode: ["continuous"] });
  applyConstraints.mockRejectedValue(new Error("unsupported"));
  await render();
  expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ focusMode: "continuous" }] });
  detect.mockResolvedValue([{ rawValue: "9788501012531" }]);
  await act(async () => { await frame?.(200); await frame?.(400); });
  expect(onResult).toHaveBeenCalledWith("9788501012531");
});

it("waits for two equal reads before accepting a code", async () => {
  await render();
  detect.mockResolvedValueOnce([{ rawValue: "9788501012531" }]);
  await act(async () => { await frame?.(200); });
  expect(onResult).not.toHaveBeenCalled();
  detect.mockResolvedValueOnce([{ rawValue: "9786587408491" }]);
  await act(async () => { await frame?.(400); });
  expect(onResult).not.toHaveBeenCalled();
  detect.mockResolvedValueOnce([{ rawValue: "9786587408491" }]);
  await act(async () => { await frame?.(600); });
  expect(onResult).toHaveBeenCalledWith("9786587408491");
});

it("ignores codes that are not ISBNs", async () => {
  await render();
  detect.mockResolvedValue([{ rawValue: "6766659408461" }]);
  await act(async () => { await frame?.(200); await frame?.(400); await frame?.(600); });
  expect(onResult).not.toHaveBeenCalled();
  expect(stop).not.toHaveBeenCalled();
});

it("emits once and stops the camera and timeout after a successful read", async () => {
  await render();
  detect.mockResolvedValue([{ rawValue: "9788501012531" }]);
  await act(async () => {
    await frame?.(200); await frame?.(400); await frame?.(600); vi.advanceTimersByTime(8000);
  });
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(stop).toHaveBeenCalled();
  expect(container.querySelector("button")).toBeNull();
});

it("stops a camera that opens after the scanner was closed", async () => {
  let resolveStream: ((value: unknown) => void) | undefined;
  getUserMedia.mockImplementation(() => new Promise((resolve) => { resolveStream = resolve; }));
  await render();
  await act(async () => root.render(null));
  await act(async () => { resolveStream?.({ getTracks: () => [{ stop }] }); });
  expect(stop).toHaveBeenCalledTimes(1);
});

it("keeps scanning in continuous mode and skips codes already read", async () => {
  await act(async () => root.render(<IsbnScannerView onResult={onResult} continuous />));
  detect.mockResolvedValue([{ rawValue: "9788501012531" }]);
  await act(async () => { await frame?.(200); await frame?.(400); await frame?.(600); await frame?.(800); });
  expect(onResult).toHaveBeenCalledTimes(1);
  expect(stop).not.toHaveBeenCalled();
  detect.mockResolvedValue([{ rawValue: "9786587408491" }]);
  await act(async () => { await frame?.(1000); await frame?.(1200); });
  expect(onResult).toHaveBeenCalledTimes(2);
  expect(onResult).toHaveBeenLastCalledWith("9786587408491");
});
