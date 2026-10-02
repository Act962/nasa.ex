import type { ReactNode } from "react";
import styles from "./orbita-auth-scene.module.css";

const ORBITA_LOGO_SRC = "/orbita-logo-dark.svg";
const ORBITA_SITE_URL = "https://orbitatec.com.br/";

interface OrbitaAuthSceneProps {
  children: ReactNode;
  isCompact?: boolean;
}

export function OrbitaAuthScene({ children, isCompact = false }: OrbitaAuthSceneProps) {
  return (
    <div className={styles.scene}>
      <div className={styles.beams} aria-hidden />
      <div className={styles.stars} aria-hidden />
      <div className={styles.planet} aria-hidden />

      <div className={styles.brandPanel}>
        <a href="/" aria-label="ÓRBITA">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.brandLogo} src={ORBITA_LOGO_SRC} alt="ÓRBITA" />
        </a>
      </div>

      <main className={styles.content}>
        <div className={styles.column}>
          <a href="/" aria-label="ÓRBITA">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.mobileLogo} src={ORBITA_LOGO_SRC} alt="ÓRBITA" />
          </a>
          <div className={isCompact ? `${styles.body} ${styles.bodyCompact}` : styles.body}>
            {children}
          </div>
          <div className={styles.spacer} />
          <OrbitaCredit />
        </div>
      </main>
    </div>
  );
}

export function OrbitaAuthHeadline() {
  return (
    <>
      <h1 className={styles.headline}>
        Um comando,
        <br />
        <span className={styles.headlineAccent}>tudo em Órbita.</span>
      </h1>
      <p className={styles.tagline}>Toda a sua empresa conectada em um único espaço.</p>
    </>
  );
}

function OrbitaCredit() {
  return (
    <a className={styles.credit} href={ORBITA_SITE_URL} target="_blank" rel="noopener noreferrer">
      Desenvolvido por
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ORBITA_LOGO_SRC} alt="ÓRBITA" />
    </a>
  );
}
