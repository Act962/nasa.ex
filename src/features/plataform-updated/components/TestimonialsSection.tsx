import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Carlos Silva",
    company: "TechStart",
    avatar: "👨‍💼",
    rating: 5,
    text: "O NASACHAT revolucionou nosso atendimento. Triplicamos as vendas em 3 meses!",
  },
  {
    name: "Ana Costa",
    company: "Inova Marketing",
    avatar: "👩‍💻",
    rating: 5,
    text: "O ASTRO IA é incrível! Responde clientes 24h e nunca perde uma oportunidade.",
  },
  {
    name: "Roberto Lima",
    company: "DataSoft",
    avatar: "👨‍🔬",
    rating: 5,
    text: "Com o NERP, automatizamos tudo. Economizamos 20h por semana em processos!",
  },
];

const TestimonialsSection = () => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="w-full max-w-4xl mx-auto py-12"
    >
      <h2 className="font-display text-xl md:text-2xl font-bold text-center text-foreground mb-2 tracking-wider">
        O que dizem nossos astronautas
      </h2>
      <p className="text-muted-foreground text-sm text-center mb-8">
        Depoimentos reais de quem já decolou com a N.A.S.A
      </p>
      
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((testimonial, i) => (
          <motion.div
            key={testimonial.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 * i }}
            className="tool-card rounded-xl p-6 flex flex-col"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{testimonial.avatar}</span>
              <div>
                <p className="font-semibold text-foreground">{testimonial.name}</p>
                <p className="text-xs text-muted-foreground">{testimonial.company}</p>
              </div>
            </div>
            
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: testimonial.rating }).map((_, j) => (
                <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed italic">
              "{testimonial.text}"
            </p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
};

export default TestimonialsSection;
