import { FeatureArticle } from "@/features/space-help/components/feature-article";

interface Props {
  params: Promise<{ categorySlug: string; featureSlug: string }>;
}

export default async function FeaturePage({ params }: Props) {
  const { categorySlug, featureSlug } = await params;
  return <FeatureArticle categorySlug={categorySlug} featureSlug={featureSlug} />;
}
