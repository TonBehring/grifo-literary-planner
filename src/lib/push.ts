import { supabase } from "@/integrations/supabase/client";

// Chave pública VAPID do projeto. Vem do ambiente se existir; senão, usa a
// chave pública fixa abaixo — é pública, então pode ficar no código.
const VAPID_PUBLIC_KEY =
  (import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string | undefined) ||
  "BGPVnE5aduHcm4cODLeGOhjVd-QMkY4kcCOqyvNB2UA1SJT8eRCfqNYYUBsuAMja1n5cLvdeHdR5WGhVKEZEavI";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Compara, byte a byte, a chave de aplicação de uma inscrição existente com a
// chave atual. O navegador devolve ArrayBuffer ou Uint8Array dependendo do
// caso, então normaliza antes de comparar.
function sameApplicationKey(
  actual: ArrayBuffer | ArrayBufferView | null | undefined,
  expected: Uint8Array,
): boolean {
  if (!actual) return false;
  const bytes =
    actual instanceof ArrayBuffer
      ? new Uint8Array(actual)
      : new Uint8Array(actual.buffer, actual.byteOffset, actual.byteLength);
  if (bytes.length !== expected.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== expected[i]) return false;
  }
  return true;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

// Pede permissão (se ainda não tiver) e registra a inscrição de push desse
// navegador/dispositivo, salvando no Supabase pra Edge Function conseguir
// achar depois. Chame isso a partir de um clique do usuário (botão), nunca
// automaticamente ao carregar a página — navegadores bloqueiam isso.
export async function subscribeToPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Notificações push não são suportadas neste navegador/dispositivo.");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Não foi possível ativar as notificações agora. Tente novamente mais tarde.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada. Ative nas configurações do navegador.");
  }

  const registration = await navigator.serviceWorker.ready;
  const desiredKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const existing = await registration.pushManager.getSubscription();

  // Uma inscrição criada com outra chave não funciona com a chave atual:
  // descarta a antiga e assina de novo.
  let subscription: PushSubscription | null = existing;
  if (existing && !sameApplicationKey(existing.options.applicationServerKey, desiredKey)) {
    await existing.unsubscribe();
    subscription = null;
  }
  subscription ??= await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: desiredKey,
  });

  const subJson = subscription.toJSON();
  if (!subJson.endpoint || !subJson.keys?.['p256dh'] || !subJson.keys?.['auth']) {
    throw new Error("Inscrição de push incompleta.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Não autenticado.");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user.id,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys['p256dh'],
      auth: subJson.keys['auth'],
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

export async function sendTestPush(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("push-send-test");
  if (error) throw new Error(error.message);
  const payload = data as { error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
}
