import Image from "next/image";

/**
 * Logo da ÓRBITA. Duas artes do mesmo SVG: a branca para fundo escuro e a
 * escura para fundo claro — o arquivo tem cor fixa, não herda `currentColor`.
 */
export function Logo() {
  return (
    <div className="hidden md:flex items-center">
      <Image
        src={"/orbita-logo-dark.svg"}
        height={60}
        width={225}
        alt="ÓRBITA"
        className="hidden dark:block h-[35px] w-auto"
        priority
      />
      <Image
        src={"/orbita-logo.svg"}
        height={60}
        width={225}
        alt="ÓRBITA"
        className="dark:hidden h-[35px] w-auto"
        priority
      />
    </div>
  );
}
