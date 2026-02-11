import { useState, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const ParallaxBackground = () => {
  const [isMobile, setIsMobile] = useState(true);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 50, stiffness: 100 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const offsetX = ((e.clientX - centerX) / centerX) * 15;
      const offsetY = ((e.clientY - centerY) / centerY) * 15;

      mouseX.set(offsetX);
      mouseY.set(offsetY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isMobile, mouseX, mouseY]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <motion.img
        src={"/galaxy-bg.jpg"}
        alt=""
        className="w-[110%] h-[110%] object-cover absolute -top-[5%] "
        style={!isMobile ? { x, y } : undefined}
        loading="eager"
      />
      <div className="galaxy-overlay absolute inset-0" />
    </div>
  );
};

export default ParallaxBackground;
