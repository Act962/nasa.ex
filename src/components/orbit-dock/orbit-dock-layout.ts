export const DOCK_HEIGHT_PX = 150;
export const ARC_TOP_PX = 44;

/** Distância do centro do arco até a base da tela; o orb do ASTRO se posiciona por ela. */
export const ORBIT_DOCK_CENTER_FROM_BOTTOM_PX = DOCK_HEIGHT_PX - ARC_TOP_PX;

/** Recolhido, o dock desce até o centro da bola encostar na base: só a metade de cima fica à vista. */
export const ORBIT_DOCK_COLLAPSED_TRANSFORM = `translateY(calc(${ORBIT_DOCK_CENTER_FROM_BOTTOM_PX}px + env(safe-area-inset-bottom)))`;
