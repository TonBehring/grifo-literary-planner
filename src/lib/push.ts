import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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
    throw new Error("VITE_VAPID_PUBLIC_KEY não configurada no projeto.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação negada. Ative nas configurações do navegador.");
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const subJson = subscription.toJSON();
  if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
    throw new Error("Inscrição de push incompleta.");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error("Não autenticado.");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userData.user.id,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
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
