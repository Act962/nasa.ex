import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { loadTrafegoSettings } from "@/features/trafego/server/lib/trafego-settings";
import { isWhatsappNumberCheckAvailable } from "@/features/trafego/server/lib/whatsapp-number-check";
import { isSocialLookupAvailable } from "@/features/trafego/server/lib/social-profile-lookup";
import { loadTrafegoAsaasGateway } from "@/features/trafego/server/lib/asaas-gateway";

/**
 * Configuração pública da landing — só o que pode ser exposto sem auth:
 * o WhatsApp do gestor e quais verificações do wizard estão disponíveis
 * (dependem de instância/integração configuradas). O browser cacheia 5 min.
 */
export const getPublicTrafegoConfig = base
  .route({ method: "GET", summary: "Configuração pública do trafeGO" })
  .input(z.object({}).optional())
  .output(
    z.object({
      supportWhatsapp: z.string().nullable(),
      includedCreatives: z.number().int().positive(),
      extraCreativeBrlCents: z.number().int().nonnegative(),
      pixAvailable: z.boolean(),
      /// Cobrança pelo Asaas ligada: o wizard pede CPF/CNPJ e a tela do PIX
      /// mostra QR em vez de pedir comprovante (spec 0022).
      pixAutoConfirms: z.boolean(),
      verification: z.object({
        phone: z.boolean(),
        whatsappCheck: z.boolean(),
        social: z.boolean(),
      }),
    }),
  )
  .handler(async () => {
    // Endpoint público: nada aqui é essencial para a página funcionar, então
    // uma falha de leitura vira "sem verificações disponíveis" em vez de 500.
    // O wizard já trata cada flag como opcional.
    try {
      const settings = await loadTrafegoSettings();

      const asaasGateway = loadTrafegoAsaasGateway();

      const [hasOperationsInstance, whatsappCheck, social] =
        await Promise.all([
          settings.operationsTrackingId
            ? prisma.whatsAppInstance
                .count({ where: { trackingId: settings.operationsTrackingId } })
                .then((count) => count > 0)
                .catch(() => false)
            : Promise.resolve(false),
          isWhatsappNumberCheckAvailable().catch(() => false),
          isSocialLookupAvailable().catch(() => false),
        ]);

      return {
        supportWhatsapp: settings.supportWhatsapp,
        includedCreatives: settings.includedCreatives,
        extraCreativeBrlCents: settings.extraCreativeBrlCents,
        // Com o Asaas ligado o PIX existe mesmo sem chave estática: a cobrança
        // carrega a própria chave. Sem ele, volta a depender do PIX manual.
        pixAvailable: Boolean(settings.pixKey) || Boolean(asaasGateway),
        pixAutoConfirms: Boolean(asaasGateway),
        verification: { phone: hasOperationsInstance, whatsappCheck, social },
      };
    } catch (error) {
      console.error(
        "[trafego/config] leitura falhou — landing segue sem verificações:",
        error,
      );
      return {
        supportWhatsapp: null,
        includedCreatives: 3,
        extraCreativeBrlCents: 4000,
        pixAvailable: false,
        pixAutoConfirms: false,
        verification: { phone: false, whatsappCheck: false, social: false },
      };
    }
  });
