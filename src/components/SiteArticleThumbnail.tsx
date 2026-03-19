import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

interface SiteArticleThumbnailProps {
  title: string;
  imageUrl: string | null;
}

const SiteArticleThumbnail = ({ title, imageUrl }: SiteArticleThumbnailProps) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  const showImage = Boolean(imageUrl) && !hasError;
  const initials = title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <div className="w-[200px] shrink-0 overflow-hidden bg-muted">
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={title}
          className="w-full h-full object-cover min-h-[180px]"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="flex min-h-[180px] h-full w-full flex-col items-center justify-center gap-3 border-r border-border bg-gradient-to-br from-muted via-card to-muted p-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-foreground">
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-lg font-semibold text-foreground">{initials || "BG"}</p>
            <p className="line-clamp-3 text-xs text-muted-foreground">Image indisponible pour cet article</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiteArticleThumbnail;
