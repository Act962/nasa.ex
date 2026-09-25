import Image from "next/image";

/** Marca da ÓRBITA. Arte branca — usada sobre fundo escuro. */
export function OrbitaLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/orbita-logo-dark.svg"
      alt="ÓRBITA"
      width={225}
      height={60}
      className={className}
      priority
    />
  );
}
