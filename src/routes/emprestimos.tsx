import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SubscriptionRequiredNotice, useHasActiveSubscription } from "@/components/SubscriptionGate";
import { acceptLoan, addLoan, listLoans, listUserBooks, setLoanReturned } from "@/lib/api";
import { listContacts, type Contato } from "@/lib/contatos";
import type { Loan } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/emprestimos")({
  head: () => ({
    meta: [
      { title: "Empréstimos — Grifo" },
      {
        name: "description",
        content: "Controle os livros que você emprestou e os que pegou emprestado, com prazos.",
      },
      { property: "og:title", content: "Empréstimos — Grifo" },
      {
        property: "og:description",
        content: "Quem está com seus livros e quais livros estão com você.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <LoansPage />
    </AppShell>
  ),
});

function LoansPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { active: subscriptionActive } = useHasActiveSubscription();
  const [direction, setDirection] = useState<Loan["direction"]>("emprestei");
  const [userBookId, setUserBookId] = useState("");
  const [mode, setMode] = useState<"contato" | "manual">("contato");
  const [contactId, setContactId] = useState("");
  const [personName, setPersonName] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data } = useQuery({
    queryKey: ["loans", user?.id],
    queryFn: () => {
      if (!user) throw new Error("Sessão expirada");
      return listLoans(user.id);
    },
    enabled: Boolean(user),
  });

  const { data: shelf } = useQuery({
    queryKey: ["user_books"],
    queryFn: () => listUserBooks(),
    enabled: Boolean(user),
  });

  const { data: contacts } = useQuery({
    queryKey: ["contatos"],
    queryFn: () => listContacts(),
    enabled: Boolean(user),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!userBookId) throw new Error("Escolha o livro");
      const selectedBook = (shelf ?? []).find((ub) => ub.id === userBookId);
      if (!selectedBook) throw new Error("Livro não encontrado na sua estante");
      const selectedContact =
        mode === "contato" ? (contacts ?? []).find((c) => c.id === contactId) : undefined;
      if (mode === "contato" && !selectedContact) throw new Error("Escolha um contato");
      if (mode === "manual" && !personName.trim()) throw new Error("Informe o nome da pessoa");
      await addLoan({
        user_id: user.id,
        linked_user_id: selectedContact?.id ?? null,
        user_book_id: userBookId,
        book_id: selectedBook.book_id,
        direction,
        person_name: selectedContact?.nome ?? personName.trim().slice(0, 100),
        due_date: dueDate || null,
        returned: false,
      });
      return { selectedContact };
    },
    onSuccess: ({ selectedContact }) => {
      setUserBookId("");
      setContactId("");
      setPersonName("");
      setDueDate("");
      void queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success(
        selectedContact ? `Empréstimo vinculado a ${selectedContact.nome}` : "Empréstimo registrado",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: ({ id, returned }: { id: string; returned: boolean }) =>
      setLoanReturned(id, returned),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["loans"] }),
  });

  const accept = useMutation({
    mutationFn: async (loan: Loan) => {
      if (!user) throw new Error("Sessão expirada");
      if (!loan.book_id) throw new Error("Livro não encontrado para este empréstimo");
      await acceptLoan(loan.id, loan.book_id, user.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loans"] });
      void queryClient.invalidateQueries({ queryKey: ["user_books"] });
      toast.success("Empréstimo aceito! Agora você já pode acompanhar sua leitura.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingIncoming = (data ?? []).filter((l) => !l.is_owner && !l.aceito && !l.returned);

  const lentActive = (data ?? []).filter((l) => l.direction === "emprestei" && !l.returned);
  const lentReturned = (data ?? []).filter((l) => l.direction === "emprestei" && l.returned);
  const borrowedActive = (data ?? []).filter(
    (l) => l.direction === "peguei_emprestado" && !l.returned,
  );
  const borrowedReturned = (data ?? []).filter(
    (l) => l.direction === "peguei_emprestado" && l.returned,
  );

  return (
    <section>
      <h1 className="font-display text-4xl leading-tight">Empréstimos</h1>

      <div className="panel-cream mt-6 rounded-2xl p-5">
        {!subscriptionActive && (
          <div className="mb-4">
            <SubscriptionRequiredNotice action="registrar um novo empréstimo" />
          </div>
        )}
        <fieldset disabled={!subscriptionActive} className="disabled:pointer-events-none disabled:opacity-40">
        <div className="flex gap-2">
          {(["emprestei", "peguei_emprestado"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDirection(d)}
              className={
                "flex-1 rounded-full border px-4 py-2 text-sm transition-colors " +
                (direction === d
                  ? "border-primary bg-primary/20"
                  : "border-border text-muted-foreground")
              }
            >
              {d === "emprestei" ? "Emprestei" : "Peguei emprestado"}
            </button>
          ))}
        </div>
        <select
          value={userBookId}
          onChange={(e) => setUserBookId(e.target.value)}
          aria-label="Livro"
          className="mt-3 w-full rounded-xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary"
        >
          <option value="">Escolha um livro da sua estante</option>
          {(shelf ?? []).map((ub) => (
            <option key={ub.id} value={ub.id}>
              {ub.book?.title ?? "Sem título"}
            </option>
          ))}
        </select>
       <div className="mt-3 flex gap-2">
          {(["contato", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                "flex-1 rounded-full border px-4 py-2 text-sm transition-colors " +
                (mode === m
                  ? "border-primary bg-primary/20"
                  : "border-border text-muted-foreground")
              }
            >
              {m === "contato" ? "Vincular a um contato" : "Pessoa sem conta no Grifo"}
            </button>
          ))}
        </div>

        {mode === "contato" ? (
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            aria-label="Contato"
            className="mt-3 w-full rounded-xl border border-border bg-transparent px-4 py-3 text-sm outline-none focus:border-primary"
          >
            <option value="">
              {(contacts ?? []).length === 0 ? "Você ainda não tem contatos" : "Escolha um contato"}
            </option>
            {(contacts ?? []).map((c: Contato) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.username ? ` (@${c.username})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            maxLength={100}
            placeholder={direction === "emprestei" ? "Para quem?" : "De quem?"}
            className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
          />
        )}
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="mt-3 w-full rounded-xl border border-border px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => create.mutate()}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground"
        >
          Registrar
        </button>
        </fieldset>
      </div>

      {pendingIncoming.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-xl">Aguardando seu aceite</h2>
          <div className="mt-3 space-y-3">
            {pendingIncoming.map((l) => (
              <div key={l.id} className="card-teal flex items-center gap-4 rounded-2xl p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display truncate text-lg">{l.book_title}</h3>
                  <p className="text-sm opacity-70">
                    {l.person_name} quer te emprestar este livro
                    {l.due_date ? ` · até ${new Date(l.due_date).toLocaleDateString("pt-BR")}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => accept.mutate(l)}
                  disabled={accept.isPending || !subscriptionActive}
                  title={!subscriptionActive ? "Assine o Grifo para aceitar empréstimos" : undefined}
                  className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  {accept.isPending ? "Aceitando…" : "Aceitar"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <LoanList
        title="Livros que emprestei"
        activeLoans={lentActive}
        returnedLoans={lentReturned}
        onToggle={toggle.mutate}
      />
      <LoanList
        title="Livros que peguei emprestado"
        activeLoans={borrowedActive}
        returnedLoans={borrowedReturned}
        onToggle={toggle.mutate}
      />
    </section>
  );
}

function LoanList({
  title,
  activeLoans,
  returnedLoans,
  onToggle,
}: {
  title: string;
  activeLoans: Loan[];
  returnedLoans: Loan[];
  onToggle: (input: { id: string; returned: boolean }) => void;
}) {
  const [showReturned, setShowReturned] = useState(false);

  return (
    <div className="mt-8">
      <h2 className="font-display text-xl">{title}</h2>
      <div className="mt-3 space-y-3">
        {activeLoans.length === 0 && (
          <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
        )}
        {activeLoans.map((l) => (
          <LoanCard key={l.id} loan={l} onToggle={onToggle} />
        ))}
      </div>

      {returnedLoans.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowReturned((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showReturned ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Ver devolvidos ({returnedLoans.length})
          </button>

          {showReturned && (
            <div className="mt-3 space-y-3 opacity-60">
              {returnedLoans.map((l) => (
                <LoanCard key={l.id} loan={l} onToggle={onToggle} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LoanCard({
  loan,
  onToggle,
}: {
  loan: Loan;
  onToggle: (input: { id: string; returned: boolean }) => void;
}) {
  const targetId = loan.is_owner ? loan.user_book_id : loan.copia_user_book_id;
  return (
    <div className="card-teal flex items-center gap-4 rounded-2xl p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {targetId ? (
            <Link
              to="/livro/$id"
              params={{ id: targetId }}
              className="font-display truncate text-lg underline-offset-4 hover:underline"
            >
              {loan.book_title}
            </Link>
          ) : (
            <h3 className="font-display truncate text-lg">{loan.book_title}</h3>
          )}
          {loan.linked_user_id && (
            <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] text-primary">
              Conta vinculada
            </span>
          )}
        </div>
        <p className="text-sm opacity-70">
          {loan.person_name}
          {loan.due_date ? ` · até ${new Date(loan.due_date).toLocaleDateString("pt-BR")}` : ""}
        </p>
      </div>
      {loan.is_owner ? (
        <button
          onClick={() => onToggle({ id: loan.id, returned: !loan.returned })}
          className={
            "shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors " +
            (loan.returned
              ? "bg-primary text-primary-foreground"
              : "border border-primary/40 opacity-80")
          }
        >
          {loan.returned ? "Devolvido" : "Marcar devolvido"}
        </button>
      ) : (
        <span className="shrink-0 rounded-full border border-primary/30 px-3 py-1.5 text-xs opacity-70">
          {loan.returned ? "Devolvido" : "Em aberto"}
        </span>
      )}
    </div>
  );
}
