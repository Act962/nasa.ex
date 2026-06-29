import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  Hr,
} from "@react-email/components";

export interface PurchaseCustomEmailProps {
  previewText: string;
  bodyHtml: string;
  orgName: string;
}

export const PurchaseCustomEmail = ({
  previewText,
  bodyHtml,
  orgName,
}: PurchaseCustomEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-[#fafafa] my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#e5e5e5] rounded-lg my-10 mx-auto p-8 max-w-[560px] bg-white">
            <Section
              className="text-[#0a0a0a] text-[15px] leading-[26px]"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            <Hr className="border border-solid border-[#e5e5e5] my-6 mx-0 w-full" />

            <Text className="text-[#737373] text-[12px] leading-[22px] text-center">
              Enviado por <strong>{orgName}</strong> via N.A.S.A. Route.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export function reactPurchaseCustomEmail(props: PurchaseCustomEmailProps) {
  return <PurchaseCustomEmail {...props} />;
}
