import { orpc } from "@/lib/orpc";
import { useMutation } from "@tanstack/react-query";

/** Verificações do wizard público — sem auth, limitadas por IP no servidor. */
export const useStartTrafegoPhoneVerification = () =>
  useMutation(orpc.trafego.verification.startPhone.mutationOptions());

export const useConfirmTrafegoPhoneVerification = () =>
  useMutation(orpc.trafego.verification.confirmPhone.mutationOptions());

export const useCheckTrafegoWhatsappNumber = () =>
  useMutation(orpc.trafego.verification.checkWhatsappNumber.mutationOptions());

export const useLookupTrafegoSocialProfile = () =>
  useMutation(orpc.trafego.verification.lookupSocialProfile.mutationOptions());
