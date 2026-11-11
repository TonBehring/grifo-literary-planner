import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { formatWhatsApp, getWhatsApp, whatsappQueryKey } from "@/lib/whatsapp";
import { WhatsAppForm } from "@/components/WhatsAppForm";
import { Button } from "@/components/ui/button";

export function WhatsAppSection() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const profile = useQuery({ queryKey: whatsappQueryKey(userId), queryFn: () => getWhatsApp(userId), enabled: Boolean(userId) });
  if (!userId) return null;
  return (
    <section className="contact-theme mt-6 space-y-4 border-t border-contact-detail/40 py-5 text-contact-heading">
      <h2 className="font-display text-xl">WhatsApp</h2>
      {profile.isPending ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : profile.isError ? <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">Não foi possível carregar seu WhatsApp.</p>
          <Button variant="outline" onClick={() => void profile.refetch()}>Tentar novamente</Button>
        </div>
        : <>
          {profile.data.whatsapp && <p className="text-sm text-muted-foreground">Número salvo: {formatWhatsApp(profile.data.whatsapp)}</p>}
          <WhatsAppForm userId={userId} profile={profile.data} />
        </>}
    </section>
  );
}