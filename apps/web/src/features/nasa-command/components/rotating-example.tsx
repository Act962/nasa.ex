import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { rotatingExamples } from "../data/constants";

export function RotatingExample() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % rotatingExamples.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-6 flex items-center justify-center overflow-hidden">
      <p
        className={cn(
          "text-xs text-zinc-600 text-center transition-all duration-400 max-w-lg truncate px-4",
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2",
        )}
      >
        {rotatingExamples[index]}
      </p>
    </div>
  );
}
