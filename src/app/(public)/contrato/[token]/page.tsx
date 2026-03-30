import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { PublicContractView } from "@/features/forge/components/public/public-contract";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicContractPage({ params }: Props) {
  const { token } = await params;

  // Find contract by signer token stored in signers JSON array
  const contracts = await prisma.forgeContract.findMany({
    where: { organizationId: { not: "" } },
    include: {
      organization: { select: { id: true, name: true, logo: true } },
      proposal: {
        include: {
          client: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const contract = contracts.find((c) => {
    const signers = c.signers as { token: string }[];
    return Array.isArray(signers) && signers.some((s) => s.token === token);
  });

  if (!contract) return notFound();

  const signers = contract.signers as { name: string; email: string; token: string; signed_at: string | null }[];
  const currentSigner = signers.find((s) => s.token === token);
  if (!currentSigner) return notFound();

  const settings = await prisma.forgeSettings.findUnique({
    where: { organizationId: contract.organizationId },
  });

  const serialized = {
    ...contract,
    value: contract.value.toString(),
    startDate: contract.startDate.toISOString(),
    endDate: contract.endDate.toISOString(),
    createdAt: contract.createdAt.toISOString(),
    updatedAt: contract.updatedAt.toISOString(),
    signers,
    currentSignerToken: token,
    settings: settings
      ? {
          ...settings,
          commissionPercentage: settings.commissionPercentage.toString(),
          createdAt: settings.createdAt.toISOString(),
          updatedAt: settings.updatedAt.toISOString(),
        }
      : null,
  };

  return <PublicContractView contract={serialized} />;
}
