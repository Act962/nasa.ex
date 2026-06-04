export const STYLES = `
  @keyframes nasaFloat {
    0%,100% { transform: translateY(0px); }
    50%      { transform: translateY(-14px); }
  }
  @keyframes nasaGlow {
    0%,100% { opacity:.35; transform:scale(1); }
    50%     { opacity:.65; transform:scale(1.06); }
  }
  @keyframes nasaFadeUp {
    from { opacity:0; transform:translateY(24px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes nasaSlideLeft {
    from { opacity:0; transform:translateX(32px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes nasaMarquee {
    from { transform:translateX(0); }
    to   { transform:translateX(-50%); }
  }
  @keyframes nasaBadge {
    0%,100% { box-shadow:0 0 0 0 rgba(124,58,237,.5); }
    50%     { box-shadow:0 0 0 10px rgba(124,58,237,0); }
  }
  @keyframes nasaShimmer {
    from { background-position:-200% 0; }
    to   { background-position:200% 0; }
  }
  @keyframes nasaSpin {
    from { transform:rotate(0deg); }
    to   { transform:rotate(360deg); }
  }
  @keyframes nasaPing {
    0%   { transform:scale(1); opacity:1; }
    75%, 100% { transform:scale(2); opacity:0; }
  }
  /* nasaFlow, usado pelo AutomationSection na linha de fluxo entre
     os 5 estágios. Indica continuidade do processo. */
  @keyframes nasaFlow {
    0%   { transform:translateX(-100%); opacity:0; }
    50%  { opacity:1; }
    100% { transform:translateX(100%); opacity:0; }
  }

  .nasa-float      { animation: nasaFloat 7s ease-in-out infinite; }
  .nasa-float-d2   { animation: nasaFloat 7s ease-in-out infinite 1s; }
  .nasa-glow       { animation: nasaGlow 4s ease-in-out infinite; }
  .nasa-fade-up    { animation: nasaFadeUp .7s ease-out forwards; }
  .nasa-fade-up-d1 { animation: nasaFadeUp .7s ease-out .15s forwards; opacity:0; }
  .nasa-fade-up-d2 { animation: nasaFadeUp .7s ease-out .3s forwards; opacity:0; }
  .nasa-fade-up-d3 { animation: nasaFadeUp .7s ease-out .45s forwards; opacity:0; }
  .nasa-slide-left { animation: nasaSlideLeft .7s ease-out forwards; }
  .nasa-marquee    { animation: nasaMarquee 35s linear infinite; }
  /* Variante rápida, usada pelo carrossel de parceiros pra dar
     mais dinamismo que o de integrações (que segue calmo). */
  .nasa-marquee-fast { animation: nasaMarquee 15s linear infinite; }
  .nasa-flow       { animation: nasaFlow 3s linear infinite; }
  .nasa-badge      { animation: nasaBadge 2.5s ease-in-out infinite; }
  .nasa-spin       { animation: nasaSpin 22s linear infinite; }
  .nasa-ping       { animation: nasaPing 1.5s cubic-bezier(0,0,.2,1) infinite; }

  .nasa-glass {
    background: rgba(255,255,255,.03);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(255,255,255,.07);
  }
  .nasa-glass-hover:hover {
    background: rgba(255,255,255,.055);
    border-color: rgba(124,58,237,.35);
    transform: translateY(-3px);
  }
  .nasa-glow-box {
    box-shadow: 0 0 50px rgba(124,58,237,.25), 0 0 100px rgba(124,58,237,.1);
  }
  .nasa-glow-sm {
    box-shadow: 0 0 24px rgba(124,58,237,.3);
  }
  .text-nasa {
    background: linear-gradient(135deg, #c4b5fd 0%, #a855f7 50%, #7C3AED 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .text-nasa-white {
    background: linear-gradient(135deg, #ffffff 0%, #e0d4ff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .nasa-border-gradient {
    border: 1px solid transparent;
    background-clip: padding-box;
    position: relative;
  }
  .nasa-border-gradient::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    background: linear-gradient(135deg, #7C3AED44, #a855f722, #7C3AED44);
    z-index: -1;
  }
  .nasa-shimmer {
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.06) 50%, transparent 100%);
    background-size: 200% auto;
    animation: nasaShimmer 3s linear infinite;
  }
  .card-hover {
    transition: all .25s cubic-bezier(.4,0,.2,1);
  }
  .card-hover:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 60px rgba(124,58,237,.2);
  }

  @keyframes nasaBar {
    from { width: 0; }
    to   { width: var(--bar-w); }
  }
  @keyframes nasaCountUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes nasaRankIn {
    from { opacity: 0; transform: translateX(-16px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes nasaStarPop {
    0%   { transform: scale(0) rotate(-30deg); opacity: 0; }
    60%  { transform: scale(1.2) rotate(5deg); }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes nasaLevelUp {
    0%,100% { box-shadow: 0 0 0 0 rgba(250,204,21,0); }
    50%     { box-shadow: 0 0 0 8px rgba(250,204,21,0); }
  }
  @keyframes nasaSliderGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(124,58,237,.4); }
    50%     { box-shadow: 0 0 14px 4px rgba(124,58,237,.25); }
  }

  .nasa-bar        { animation: nasaBar 1s ease-out forwards; }
  .nasa-rank-in    { animation: nasaRankIn .5s ease-out forwards; }
  .nasa-star-pop   { animation: nasaStarPop .6s cubic-bezier(.34,1.56,.64,1) forwards; }
  .nasa-level-up   { animation: nasaLevelUp 2.5s ease-in-out infinite; }
  .nasa-slider-glow{ animation: nasaSliderGlow 3s ease-in-out infinite; }

  @keyframes nasaWave {
    0%,100% { transform: scaleY(1); }
    50%     { transform: scaleY(2.5); }
  }
  @keyframes nasaPopIn {
    from { opacity:0; transform:scale(.85) translateY(6px); }
    to   { opacity:1; transform:scale(1) translateY(0); }
  }
  @keyframes nasaTypingDot {
    0%,80%,100% { transform: scale(0); opacity:.3; }
    40%         { transform: scale(1);  opacity:1; }
  }
  @keyframes nasaDataFlow {
    0%   { stroke-dashoffset: 60; opacity:0; }
    20%  { opacity:1; }
    100% { stroke-dashoffset: 0;  opacity:1; }
  }
  @keyframes nasaFadeRight {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes nasaBarRise {
    from { transform: scaleY(0); opacity:0; }
    to   { transform: scaleY(1); opacity:1; }
  }

  .nasa-pop-in    { animation: nasaPopIn .4s cubic-bezier(.34,1.56,.64,1) forwards; }
  .nasa-fade-right{ animation: nasaFadeRight .4s ease-out forwards; }
  .bar-rise       { animation: nasaBarRise .6s ease-out forwards; }
  .wave-bar       { animation: nasaWave 1.1s ease-in-out infinite; }

  .dot-bounce-1 { animation: nasaTypingDot 1.2s ease-in-out infinite; }
  .dot-bounce-2 { animation: nasaTypingDot 1.2s ease-in-out .2s infinite; }
  .dot-bounce-3 { animation: nasaTypingDot 1.2s ease-in-out .4s infinite; }

  .plan-card-highlight {
    background: linear-gradient(145deg, rgba(124,58,237,.12) 0%, rgba(168,85,247,.06) 100%);
    border-color: rgba(124,58,237,.5) !important;
    box-shadow: 0 0 40px rgba(124,58,237,.2), 0 0 80px rgba(124,58,237,.08);
  }
  .stars-card {
    background: linear-gradient(135deg, rgba(250,204,21,.07) 0%, rgba(124,58,237,.05) 100%);
    border: 1px solid rgba(250,204,21,.15);
  }
  .rank-row:nth-child(1) { animation-delay: 0s; }
  .rank-row:nth-child(2) { animation-delay: .06s; }
  .rank-row:nth-child(3) { animation-delay: .12s; }
  .rank-row:nth-child(4) { animation-delay: .18s; }
  .rank-row:nth-child(5) { animation-delay: .24s; }
  .rank-row:nth-child(6) { animation-delay: .30s; }
  .rank-row:nth-child(7) { animation-delay: .36s; }
  .rank-row:nth-child(8) { animation-delay: .42s; }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #7C3AED;
    cursor: pointer;
    border: 3px solid #fff;
    box-shadow: 0 0 12px rgba(124,58,237,.6);
  }
  input[type=range]::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 99px;
    background: linear-gradient(to right, #7C3AED var(--track-pct, 50%), rgba(255,255,255,.1) var(--track-pct, 50%));
  }
`;
