import Image from "next/image";

/**
 * Logo NASA. Texto "Nasa.ex" removido por decisão visual, só o
 * símbolo. Tamanho aumentado 5× (40px → 200px) pra ganhar
 * presença na navbar. width/height intrínsecos foram escalados
 * mantendo proporção 1:1.
 */
export function Logo() {
  return (
    <div className="hidden md:flex items-center">
      {/* Logo PNG intrínseca: 600×200 (proporção 3:1).
          Em 500% baseado na altura original de 40px → altura 200px,
          largura proporcional (600px) via `w-auto`. */}
      <Image
        src={"/logo-dark.png"}
        height={200}
        width={600}
        alt="N.A.S.A"
        className="hidden dark:block h-[75px] w-auto"
        priority
      />
      <Image
        src={"/logo.png"}
        height={200}
        width={600}
        alt="N.A.S.A"
        className="dark:hidden h-[75px] w-auto"
        priority
      />
    </div>
  );
}
