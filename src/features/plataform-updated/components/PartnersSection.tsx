import { motion } from "framer-motion";

const partners = [
  { name: "TechCorp", logo: "🏢" },
  { name: "Inova Digital", logo: "💡" },
  { name: "StartupHub", logo: "🚀" },
  { name: "DataFlow", logo: "📊" },
  { name: "CloudNine", logo: "☁️" },
  { name: "NetSolutions", logo: "🌐" },
];

const PartnersSection = () => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-4xl mx-auto py-12"
    >
      <h2 className="font-display text-xl md:text-2xl font-bold text-center text-foreground mb-2 tracking-wider">
        Quem usa N.A.S.A
      </h2>
      <p className="text-muted-foreground text-sm text-center mb-8">
        Empresas que já transformaram seus negócios
      </p>
      
      <div className="flex flex-wrap justify-center gap-6 md:gap-10">
        {partners.map((partner, i) => (
          <motion.div
            key={partner.name}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 * i }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/30 transition-all hover:scale-105"
          >
            <span className="text-3xl">{partner.logo}</span>
            <span className="text-xs text-muted-foreground font-medium">{partner.name}</span>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default PartnersSection;
