import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { PublicContractView } from "@/features/forge/components/public/public-contract";
import { renderTemplate, type RenderContext } from "@/features/forge/utils/render-template";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PublicContractPage({ params }: Props) {
  const { token } = await params;

  // Find contract by signer token stored in signers JSON array
  const contracts = await prisma.forgeContract.findMany({
    where: { organizationId: { not: "" } },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          logo: true,
          cnpj: true,
          contactEmail: true,
          contactPhone: true,
          addressLine: true,
          city: true,
          state: true,
          postalCode: true,
        },
      },
      proposal: {
        include: {
          client: { select: { id: true, name: true, email: true, phone: true, document: true } },
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

  // Build render context: clientData manual tem prioridade sobre proposal.client.
  const clientData = contract.clientData as
    | {
        name?: string | null;
        document?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        contactName?: string | null;
      }
    | null;

  const ctx: RenderContext = {
    organization: {
      name: contract.organization.name,
      cnpj: contract.organization.cnpj ?? null,
      contactEmail: contract.organization.contactEmail ?? null,
      contactPhone: contract.organization.contactPhone ?? null,
      addressLine: contract.organization.addressLine ?? null,
      city: contract.organization.city ?? null,
      state: contract.organization.state ?? null,
      postalCode: contract.organization.postalCode ?? null,
    },
    client: clientData?.name || clientData?.email || clientData?.document
      ? {
          name: clientData?.name ?? null,
          email: clientData?.email ?? null,
          document: clientData?.document ?? null,
          phone: clientData?.phone ?? null,
          address: clientData?.address ?? null,
          contactName: clientData?.contactName ?? null,
        }
      : contract.proposal?.client
        ? {
            name: contract.proposal.client.name,
            email: contract.proposal.client.email,
            document: contract.proposal.client.document,
            phone: contract.proposal.client.phone,
            address: null,
            contactName: null,
          }
        : null,
    contract: {
      number: contract.number,
      value: contract.value.toString(),
      startDate: contract.startDate,
      endDate: contract.endDate,
    },
    proposal: contract.proposal
      ? {
          number: contract.proposal.number,
          title: contract.proposal.title,
          validUntil: contract.proposal.validUntil,
        }
      : null,
  };

  const renderedContent = renderTemplate(contract.content ?? "", ctx);

  const serialized = {
    ...contract,
    content: renderedContent,
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
