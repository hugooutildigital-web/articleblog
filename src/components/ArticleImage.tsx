import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

interface ArticleImageProps {
  title: string;
  imageUrl?: string | null;
  alt?: string;
  containerClassName?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  loading?: "eager" | "lazy";
  message?: string;
  onBrokenImage?: () => void;
}

const ArticleImage = ({
  title,
  imageUrl,
  alt,
  containerClassName = "overflow-hidden bg-muted",
  imageClassName = "h-full w-full object-cover",
  fallbackClassName = "flex h-full min-h-[180px] w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted via-card to-muted p-4 text-center",
  loading = "lazy",
  message = "Image indisponible pour cet article",
  onBrokenImage,
}: ArticleImageProps) => {
  const [hasError, setHasError] = useState(false);
  const hasReportedError = useRef(false);

  useEffect(() => {
    setHasError(false);
    hasReportedError.current = false;
  }, [imageUrl]);

  const initials = title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  const handleError = () => {
    setHasError(true);

    if (!hasReportedError.current) {
      hasReportedError.current = true;
      onBrokenImage?.();
    }
  };

  return (
    <div className={containerClassName}>
      {imageUrl && !hasError ? (
        <img
          src={imageUrl}
          alt={alt ?? title}
          className={imageClassName}
          loading={loading}
          decoding="async"
          onError={handleError}
        />
      ) : (
        <div className={fallbackClassName}>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background text-foreground">
            <ImageOff className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-lg font-semibold text-foreground">{initials || "BG"}</p>
            <p className="line-clamp-3 text-xs text-muted-foreground">{message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArticleImage;
