import { useEffect, useState } from "react";

/**
 * Hook que retorna um valor com debounce
 * @param value - O valor a ser debounced
 * @param delay - O tempo de delay em milissegundos (padrão: 500ms)
 * @returns O valor debounced
 */
export function useDebouncedValue<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Define um timeout para atualizar o valor debounced
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpa o timeout se o valor mudar antes do delay terminar
    // ou quando o componente for desmontado
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
