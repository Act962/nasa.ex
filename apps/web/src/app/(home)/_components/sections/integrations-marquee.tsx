export function IntegrationsMarquee() {
  const items = [
    "WhatsApp Business",
    "Instagram DM",
    "Telegram",
    "Facebook Messenger",
    "Gmail",
    "Google Forms",
    "Typeform",
    "JotForm",
    "Tally",
    "Stripe",
    "Mercado Pago",
    "PagSeguro",
    "PayPal",
    "Zapier",
    "Make",
    "n8n",
    "Slack",
    "Discord",
    "Microsoft Teams",
    "LinkedIn",
    "TikTok",
    "Meta Ads",
    "RD Station",
    "HubSpot",
    "Pipedrive",
    "ClickSign",
    "DocuSign",
    "D4Sign",
    "Intercom",
    "Chatwoot",
    "Crisp",
  ];
  return (
    <section className="py-16 px-4 border-y border-white/5 overflow-hidden">
      <p className="text-center text-white/20 text-xs font-medium uppercase tracking-widest mb-8">
        +200 integrações disponíveis no marketplace
      </p>
      <div className="relative">
        <div className="flex nasa-marquee whitespace-nowrap gap-3">
          {[...items, ...items].map((name, i) => (
            <div
              key={i}
              className="inline-flex items-center gap-2 nasa-glass rounded-full px-4 py-2 shrink-0 border border-white/6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]/70" />
              <span className="text-white/50 text-sm font-medium">{name}</span>
            </div>
          ))}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent pointer-events-none z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black to-transparent pointer-events-none z-10" />
      </div>
    </section>
  );
}
