import { useState } from "react";
import { Heart, Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { StarRating } from "./StarRating";

export function CelebrationModal({
  open,
  bookTitle,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  bookTitle: string;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { rating: number; review: string; favorite: boolean }) => void;
}) {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [favorite, setFavorite] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="card-teal max-w-md rounded-3xl border-none p-7">
        <div className="text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-[11px] tracking-[0.2em] text-primary uppercase">
            Livro concluído
          </p>
          <h2 className="font-display mt-2 text-2xl leading-snug">{bookTitle}</h2>
          <p className="mt-2 text-sm opacity-70">Mais uma história grifada na sua estante.</p>
        </div>

        <div className="mt-6 flex justify-center">
          <StarRating value={rating} onChange={setRating} />
        </div>

        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="O que ficou de você nessa leitura?"
          className="mt-5 w-full resize-none rounded-xl border border-white/15 bg-white/5 p-3 text-sm placeholder:opacity-50 focus:border-primary focus:outline-none"
        />

        <button
          onClick={() => setFavorite((f) => !f)}
          className={
            "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition-colors " +
            (favorite ? "border-primary bg-primary/15 text-primary" : "border-white/15 opacity-80")
          }
        >
          <Heart className={"h-4 w-4 " + (favorite ? "fill-primary" : "")} />
          {favorite ? "Favoritado" : "Favoritar"}
        </button>

        <button
          onClick={() => onSave({ rating, review, favorite })}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Guardar na estante
        </button>
      </DialogContent>
    </Dialog>
  );
}