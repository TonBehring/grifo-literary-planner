import { Star, StarHalf } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-4 w-4" : "h-8 w-8";

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star;
        const half = !filled && value >= star - 0.5;
        return (
          <div key={star} className="relative">
            <Star
              className={cn(dim, filled ? "fill-primary text-primary" : "text-primary/35")}
            />
            {half && (
              <StarHalf
                className={cn(dim, "absolute inset-0 fill-primary text-primary")}
              />
            )}
            {onChange && (
              <>
                <button
                  aria-label={`${star - 0.5} estrelas`}
                  onClick={() => onChange(star - 0.5)}
                  className="absolute inset-y-0 left-0 w-1/2"
                />
                <button
                  aria-label={`${star} estrelas`}
                  onClick={() => onChange(star)}
                  className="absolute inset-y-0 right-0 w-1/2"
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}