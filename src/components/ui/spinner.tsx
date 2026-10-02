import type { ComponentProps } from "react"
import { OrbitaSpinner } from "@/components/orbita-spinner"

/** Loading padrão do design system: a marca da ÓRBITA girando. */
function Spinner(props: ComponentProps<typeof OrbitaSpinner>) {
  return <OrbitaSpinner {...props} />
}

export { Spinner }
