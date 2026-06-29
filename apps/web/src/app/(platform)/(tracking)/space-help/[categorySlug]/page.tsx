import { CategoryFeaturesPage } from "@/features/space-help/components/category-features-page";

interface Props {
  params: Promise<{ categorySlug: string }>;
}

export default async function CategoryPage({ params }: Props) {
  const { categorySlug } = await params;
  return <CategoryFeaturesPage categorySlug={categorySlug} />;
}
