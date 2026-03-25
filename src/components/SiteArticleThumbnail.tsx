import ArticleImage from "./ArticleImage";

interface SiteArticleThumbnailProps {
  title: string;
  imageUrl: string | null;
  onBrokenImage?: () => void;
}

const SiteArticleThumbnail = ({ title, imageUrl, onBrokenImage }: SiteArticleThumbnailProps) => {
  return (
    <ArticleImage
      title={title}
      imageUrl={imageUrl}
      onBrokenImage={onBrokenImage}
      containerClassName="w-[200px] shrink-0 overflow-hidden bg-muted"
      imageClassName="min-h-[180px] h-full w-full object-cover"
      fallbackClassName="flex min-h-[180px] h-full w-full flex-col items-center justify-center gap-3 border-r border-border bg-gradient-to-br from-muted via-card to-muted p-4 text-center"
    />
  );
};

export default SiteArticleThumbnail;
