/**
 * Biblioteca de objetos do Map Editor — assets reais do LimeZu Modern Interior
 * (WorkAdventure), pixel art 16x16 em PNG.
 *
 * Base URL: https://limezu.workadventu.re/
 * Coleção:  https://limezu.workadventu.re/LimeZu_Modern_Interior.json
 * Total:    ~216 objetos em 12 categorias
 */

export interface LibraryItem {
  id:            string;
  name:          string;
  url:           string;
  tags?:         string[];
  defaultScale?: number;
}

export interface LibraryCategory {
  id:     string;
  name:   string;
  icon?:  string;
  items:  LibraryItem[];
}

const BASE = "https://limezu.workadventu.re/LimeZu_Modern_Interior/";
const u = (path: string) => BASE + path;

/* ──────────────────────── ACTIVITIES ──────────────────────── */
const ACTIVITIES: LibraryItem[] = [
  { id: "act-tennis-blue",       name: "Mesa de Tênis (Azul)",       tags: ["tennis","jogo","lazer"],    url: u("Tennis_table__Down__478BD2__Activities.png"),               defaultScale: 1 },
  { id: "act-tennis-teal",       name: "Mesa de Tênis (Verde-azul)", tags: ["tennis","jogo"],            url: u("Tennis_table__Down__5A8B97__Activities.png"),               defaultScale: 1 },
  { id: "act-tennis-green",      name: "Mesa de Tênis (Verde)",      tags: ["tennis","jogo"],            url: u("Tennis_table__Down__6C957E__Activities.png"),               defaultScale: 1 },
  { id: "act-pool-blue",         name: "Mesa de Sinuca (Azul)",      tags: ["sinuca","pool","jogo"],     url: u("Pool_table__Right__478BD2__Activities.png"),                defaultScale: 1 },
  { id: "act-pool-teal",         name: "Mesa de Sinuca (Verde-azul)",tags: ["sinuca","pool"],            url: u("Pool_table__Right__5A8B97__Activities.png"),                defaultScale: 1 },
  { id: "act-pool-green",        name: "Mesa de Sinuca (Verde)",     tags: ["sinuca","pool"],            url: u("Pool_table__Right__6C957E__Activities.png"),                defaultScale: 1 },
  { id: "act-synth-purple",      name: "Sintetizador (Roxo)",        tags: ["música","sintetizador"],    url: u("Synthetiser__Down__7C86CC__Activities_Electronics.png"),    defaultScale: 1 },
  { id: "act-synth-gray",        name: "Sintetizador (Cinza)",       tags: ["música","sintetizador"],    url: u("Synthetiser__Down__9DA3B7__Activities_Electronics.png"),    defaultScale: 1 },
  { id: "act-synth-red",         name: "Sintetizador (Vermelho)",    tags: ["música","sintetizador"],    url: u("Synthetiser__Down__B53E40__Activities_Electronics.png"),    defaultScale: 1 },
  { id: "act-piano-upright-1",   name: "Piano (Branco)",             tags: ["piano","música"],           url: u("Upright_piano__Down__C8B394__Activities.png"),              defaultScale: 1 },
  { id: "act-piano-upright-2",   name: "Piano (Caramelo)",           tags: ["piano","música"],           url: u("Upright_piano__Down__CA8854__Activities.png"),              defaultScale: 1 },
  { id: "act-piano-upright-3",   name: "Piano (Madeira)",            tags: ["piano","música"],           url: u("Upright_piano__Down__DAA463__Activities.png"),              defaultScale: 1 },
  { id: "act-grand-piano-1",     name: "Piano de Cauda (Branco)",    tags: ["piano","cauda","música"],   url: u("Grand_piano__Down__C8B394__Activities.png"),               defaultScale: 1 },
  { id: "act-grand-piano-2",     name: "Piano de Cauda (Caramelo)",  tags: ["piano","cauda","música"],   url: u("Grand_piano__Down__CA8854__Activities.png"),               defaultScale: 1 },
  { id: "act-grand-piano-3",     name: "Piano de Cauda (Madeira)",   tags: ["piano","cauda","música"],   url: u("Grand_piano__Down__DAA463__Activities.png"),               defaultScale: 1 },
  { id: "act-guitar-1",          name: "Guitarra (Branco)",          tags: ["guitarra","música"],        url: u("Guitar__Down__C8B394__Activities.png"),                    defaultScale: 1 },
  { id: "act-guitar-2",          name: "Guitarra (Caramelo)",        tags: ["guitarra","música"],        url: u("Guitar__Down__CA8854__Activities.png"),                    defaultScale: 1 },
  { id: "act-guitar-3",          name: "Guitarra (Madeira)",         tags: ["guitarra","música"],        url: u("Guitar__Down__DAA463__Activities.png"),                    defaultScale: 1 },
  { id: "act-arcade-down",       name: "Arcade (Frente)",            tags: ["arcade","jogo","fliperama"],url: u("Arcade_machine__Down__9DA3B7__Activities_Electronics.png"), defaultScale: 1 },
  { id: "act-arcade-left",       name: "Arcade (Esquerda)",          tags: ["arcade","jogo"],            url: u("Arcade_machine__Left__9DA3B7__Activities_Electronics.png"), defaultScale: 1 },
  { id: "act-arcade-right",      name: "Arcade (Direita)",           tags: ["arcade","jogo"],            url: u("Arcade_machine__Right__9DA3B7__Activities_Electronics.png"),defaultScale: 1 },
  { id: "act-arcade-up",         name: "Arcade (Atrás)",             tags: ["arcade","jogo"],            url: u("Arcade_machine__Up__9DA3B7__Activities_Electronics.png"),  defaultScale: 1 },
];

/* ──────────────────────── BATHROOM ──────────────────────── */
const BATHROOM: LibraryItem[] = [
  { id: "bath-wc-1",  name: "Vaso Sanitário (Azul)",    tags: ["banheiro","wc","vaso"],   url: u("WC__Down__81AFB8__Bathroom.png"),         defaultScale: 1 },
  { id: "bath-wc-2",  name: "Vaso Sanitário (Roxo)",    tags: ["banheiro","wc"],          url: u("WC__Down__8B829E__Bathroom.png"),         defaultScale: 1 },
  { id: "bath-wc-3",  name: "Vaso Sanitário (Bege)",    tags: ["banheiro","wc"],          url: u("WC__Down__BDB987__Bathroom.png"),         defaultScale: 1 },
  { id: "bath-wc-4",  name: "Vaso Sanitário (Creme)",   tags: ["banheiro","wc"],          url: u("WC__Down__CFC1A6__Bathroom.png"),         defaultScale: 1 },
  { id: "bath-wc-5",  name: "Vaso Sanitário (Mel)",     tags: ["banheiro","wc"],          url: u("WC__Down__DEBF85__Bathroom.png"),         defaultScale: 1 },
  { id: "bath-wc-6",  name: "Vaso Sanitário (Branco)",  tags: ["banheiro","wc"],          url: u("WC__Down__E4E4E4__Bathroom.png"),         defaultScale: 1 },
  { id: "bath-wco-1", name: "Vaso Aberto (Azul)",       tags: ["banheiro","wc","aberto"], url: u("WC_(open)__Down__81AFB8__Bathroom.png"),  defaultScale: 1 },
  { id: "bath-wco-2", name: "Vaso Aberto (Roxo)",       tags: ["banheiro","wc"],          url: u("WC_(open)__Down__8B829E__Bathroom.png"),  defaultScale: 1 },
  { id: "bath-wco-3", name: "Vaso Aberto (Bege)",       tags: ["banheiro","wc"],          url: u("WC_(open)__Down__BDB987__Bathroom.png"),  defaultScale: 1 },
  { id: "bath-wco-4", name: "Vaso Aberto (Creme)",      tags: ["banheiro","wc"],          url: u("WC_(open)__Down__CFC1A6__Bathroom.png"),  defaultScale: 1 },
  { id: "bath-wco-5", name: "Vaso Aberto (Mel)",        tags: ["banheiro","wc"],          url: u("WC_(open)__Down__DEBF85__Bathroom.png"),  defaultScale: 1 },
  { id: "bath-wco-6", name: "Vaso Aberto (Branco)",     tags: ["banheiro","wc"],          url: u("WC_(open)__Down__E4E4E4__Bathroom.png"),  defaultScale: 1 },
  { id: "bath-tub",   name: "Banheira",                 tags: ["banheiro","banheira"],    url: u("Bathtub__Down__C7C0CE__Bathroom.png"),    defaultScale: 1 },
  { id: "bath-can-1", name: "Lixeira (Verde)",          tags: ["lixo","lixeira"],         url: u("Trash_can__Down__5E9B4D__Bathroom_Other.png"), defaultScale: 1 },
  { id: "bath-can-2", name: "Lixeira (Bege)",           tags: ["lixo","lixeira"],         url: u("Trash_can__Down__AC947E__Bathroom_Other.png"), defaultScale: 1 },
  { id: "bath-can-3", name: "Lixeira (Azul)",           tags: ["lixo","lixeira"],         url: u("Trash_can__Down__ADC3CF__Bathroom_Other.png"), defaultScale: 1 },
  { id: "bath-can-4", name: "Lixeira (Lilás)",          tags: ["lixo","lixeira"],         url: u("Trash_can__Down__B8B0C5__Bathroom_Other.png"), defaultScale: 1 },
  { id: "bath-can-5", name: "Lixeira (Rosa)",           tags: ["lixo","lixeira"],         url: u("Trash_can__Down__D684A1__Bathroom_Other.png"), defaultScale: 1 },
];

/* ──────────────────────── BED ──────────────────────── */
const BED: LibraryItem[] = [
  { id: "bed-1", name: "Cama (Verde)",         tags: ["cama","quarto","bed"],   url: u("Bed__Left__61867A__Bed.png"),  defaultScale: 1 },
  { id: "bed-2", name: "Cama (Roxo)",          tags: ["cama","quarto"],         url: u("Bed__Left__776E95__Bed.png"),  defaultScale: 1 },
  { id: "bed-3", name: "Cama (Marrom)",        tags: ["cama","quarto"],         url: u("Bed__Left__A48873__Bed.png"),  defaultScale: 1 },
  { id: "bed-4", name: "Cama (Azul Claro)",    tags: ["cama","quarto"],         url: u("Bed__Left__ABC1CE__Bed.png"),  defaultScale: 1 },
  { id: "bed-5", name: "Cama (Dourado)",       tags: ["cama","quarto"],         url: u("Bed__Left__AF965D__Bed.png"),  defaultScale: 1 },
];

/* ──────────────────────── CADEIRAS (SEAT) ──────────────────────── */
const CHAIR: LibraryItem[] = [
  // Task chair
  { id: "chair-task-d-blue",   name: "Cadeira Task (Azul)",      tags: ["cadeira","escritório","task"],  url: u("Task_chair__Down__3C71DB__Seat_Office.png"),   defaultScale: 1 },
  { id: "chair-task-d-green",  name: "Cadeira Task (Verde)",     tags: ["cadeira","escritório","task"],  url: u("Task_chair__Down__4EB235__Seat_Office.png"),   defaultScale: 1 },
  { id: "chair-task-d-yellow", name: "Cadeira Task (Amarela)",   tags: ["cadeira","escritório","task"],  url: u("Task_chair__Down__C4BA71__Seat_Office.png"),   defaultScale: 1 },
  { id: "chair-task-d-red",    name: "Cadeira Task (Vermelha)",  tags: ["cadeira","escritório","task"],  url: u("Task_chair__Down__D15E67__Seat_Office.png"),   defaultScale: 1 },
  { id: "chair-task-d-orange", name: "Cadeira Task (Laranja)",   tags: ["cadeira","escritório","task"],  url: u("Task_chair__Down__F6BF29__Seat_Office.png"),   defaultScale: 1 },
  { id: "chair-task-l-blue",   name: "Cadeira Task Esq. (Azul)", tags: ["cadeira","task"],               url: u("Task_chair__Left__3C71DB__Seat_Office.png"),   defaultScale: 1 },
  { id: "chair-task-l-green",  name: "Cadeira Task Esq. (Verde)",tags: ["cadeira","task"],               url: u("Task_chair__Left__4EB235__Seat_Office.png"),   defaultScale: 1 },
  { id: "chair-task-r-blue",   name: "Cadeira Task Dir. (Azul)", tags: ["cadeira","task"],               url: u("Task_chair__Right__3C71DB__Seat_Office.png"),  defaultScale: 1 },
  { id: "chair-task-r-green",  name: "Cadeira Task Dir. (Verde)",tags: ["cadeira","task"],               url: u("Task_chair__Right__4EB235__Seat_Office.png"),  defaultScale: 1 },
  // Office chair
  { id: "chair-office-d-blue", name: "Cadeira Executiva (Azul)", tags: ["cadeira","escritório","office"],url: u("Office_chair__Down__4C7BA7__Seat_Office.png"), defaultScale: 1 },
  { id: "chair-office-d-grn",  name: "Cadeira Executiva (Verde)",tags: ["cadeira","escritório"],         url: u("Office_chair__Down__6FA74F__Seat_Office.png"), defaultScale: 1 },
  { id: "chair-office-d-pur",  name: "Cadeira Executiva (Roxo)", tags: ["cadeira","escritório"],         url: u("Office_chair__Down__82829F__Seat_Office.png"), defaultScale: 1 },
  { id: "chair-office-u-blue", name: "Cadeira Exec. Atrás (Azul)",tags: ["cadeira"],                    url: u("Office_chair__Up__4C7BA7__Seat_Office.png"),  defaultScale: 1 },
  { id: "chair-office-u-grn",  name: "Cadeira Exec. Atrás (Verde)",tags: ["cadeira"],                   url: u("Office_chair__Up__6FA74F__Seat_Office.png"),  defaultScale: 1 },
  { id: "chair-office-u-pur",  name: "Cadeira Exec. Atrás (Roxo)",tags: ["cadeira"],                    url: u("Office_chair__Up__82829F__Seat_Office.png"),  defaultScale: 1 },
  // Couch
  { id: "chair-couch-d-1", name: "Sofá Frente (Azul Ardósia)",  tags: ["sofá","sala","couch"],  url: u("Couch__Down__868CA4__Seat.png"),  defaultScale: 1 },
  { id: "chair-couch-d-2", name: "Sofá Frente (Marrom)",        tags: ["sofá","sala"],          url: u("Couch__Down__A47A5E__Seat.png"),  defaultScale: 1 },
  { id: "chair-couch-d-3", name: "Sofá Frente (Cinza)",         tags: ["sofá","sala"],          url: u("Couch__Down__A7A7A7__Seat.png"),  defaultScale: 1 },
  { id: "chair-couch-d-4", name: "Sofá Frente (Lilás)",         tags: ["sofá","sala"],          url: u("Couch__Down__B7AFC4__Seat.png"),  defaultScale: 1 },
  { id: "chair-couch-l-1", name: "Sofá Esq. (Azul Ardósia)",   tags: ["sofá","sala"],          url: u("Couch__Left__868CA4__Seat.png"),  defaultScale: 1 },
  { id: "chair-couch-l-2", name: "Sofá Esq. (Marrom)",         tags: ["sofá","sala"],          url: u("Couch__Left__A47A5E__Seat.png"),  defaultScale: 1 },
  { id: "chair-couch-l-3", name: "Sofá Esq. (Cinza)",          tags: ["sofá","sala"],          url: u("Couch__Left__A7A7A7__Seat.png"),  defaultScale: 1 },
  { id: "chair-couch-l-4", name: "Sofá Esq. (Lilás)",          tags: ["sofá","sala"],          url: u("Couch__Left__B7AFC4__Seat.png"),  defaultScale: 1 },
  { id: "chair-couch-r-1", name: "Sofá Dir. (Azul Ardósia)",   tags: ["sofá","sala"],          url: u("Couch__Right__868CA4__Seat.png"), defaultScale: 1 },
  { id: "chair-couch-r-2", name: "Sofá Dir. (Marrom)",         tags: ["sofá","sala"],          url: u("Couch__Right__A47A5E__Seat.png"), defaultScale: 1 },
  { id: "chair-couch-r-3", name: "Sofá Dir. (Cinza)",          tags: ["sofá","sala"],          url: u("Couch__Right__A7A7A7__Seat.png"), defaultScale: 1 },
  { id: "chair-couch-r-4", name: "Sofá Dir. (Lilás)",          tags: ["sofá","sala"],          url: u("Couch__Right__B7AFC4__Seat.png"), defaultScale: 1 },
  { id: "chair-couch-u-1", name: "Sofá Atrás (Azul Ardósia)",  tags: ["sofá","sala"],          url: u("Couch__Up__868CA4__Seat.png"),   defaultScale: 1 },
  { id: "chair-couch-u-2", name: "Sofá Atrás (Cinza)",         tags: ["sofá","sala"],          url: u("Couch__Up__A7A7A7__Seat.png"),   defaultScale: 1 },
  // Lounge chair
  { id: "chair-lounge-d-1", name: "Poltrona Frente (Azul)",    tags: ["poltrona","lounge"],    url: u("Lounge_chair__Down__ACC2CE__Seat.png"),  defaultScale: 1 },
  { id: "chair-lounge-d-2", name: "Poltrona Frente (Vermelho)",tags: ["poltrona","lounge"],    url: u("Lounge_chair__Down__C46262__Seat.png"),  defaultScale: 1 },
  { id: "chair-lounge-d-3", name: "Poltrona Frente (Lilás)",   tags: ["poltrona","lounge"],    url: u("Lounge_chair__Down__C8C1CF__Seat.png"),  defaultScale: 1 },
  { id: "chair-lounge-d-4", name: "Poltrona Frente (Amarelo)", tags: ["poltrona","lounge"],    url: u("Lounge_chair__Down__D4A23A__Seat.png"),  defaultScale: 1 },
  { id: "chair-lounge-l-1", name: "Poltrona Esq. (Azul)",     tags: ["poltrona"],             url: u("Lounge_chair__Left__ACC2CE__Seat.png"),  defaultScale: 1 },
  { id: "chair-lounge-l-2", name: "Poltrona Esq. (Vermelho)", tags: ["poltrona"],             url: u("Lounge_chair__Left__C46262__Seat.png"),  defaultScale: 1 },
  { id: "chair-lounge-r-1", name: "Poltrona Dir. (Azul)",     tags: ["poltrona"],             url: u("Lounge_chair__Right__ACC2CE__Seat.png"), defaultScale: 1 },
  { id: "chair-lounge-r-2", name: "Poltrona Dir. (Vermelho)", tags: ["poltrona"],             url: u("Lounge_chair__Right__C46262__Seat.png"), defaultScale: 1 },
  { id: "chair-lounge-u-1", name: "Poltrona Atrás (Azul)",    tags: ["poltrona"],             url: u("Lounge_chair__Up__ACC2CE__Seat.png"),   defaultScale: 1 },
  { id: "chair-lounge-u-2", name: "Poltrona Atrás (Vermelho)",tags: ["poltrona"],             url: u("Lounge_chair__Up__C46262__Seat.png"),   defaultScale: 1 },
  // Armchair
  { id: "chair-arm-1", name: "Poltrona Clássica (Roxo)", tags: ["poltrona","armchair"],  url: u("Armchair__Down__82829E__Seat.png"),  defaultScale: 1 },
  { id: "chair-arm-2", name: "Poltrona Clássica (Lilás)", tags: ["poltrona","armchair"], url: u("Armchair__Down__A5A1BB__Seat.png"),  defaultScale: 1 },
  { id: "chair-arm-3", name: "Poltrona Clássica (Bege)",  tags: ["poltrona","armchair"], url: u("Armchair__Down__AB937D__Seat.png"),  defaultScale: 1 },
  { id: "chair-arm-4", name: "Poltrona Clássica (Caramelo)",tags: ["poltrona"],          url: u("Armchair__Down__B88254__Seat.png"),  defaultScale: 1 },
  // Canteen chair
  { id: "chair-cant-d-1", name: "Cadeira Refeitório (Azul)",       tags: ["cadeira","refeitório"], url: u("Canteen_chair__Down__BCD4D9__Seat.png"),  defaultScale: 1 },
  { id: "chair-cant-d-2", name: "Cadeira Refeitório (Vermelho)",    tags: ["cadeira","refeitório"], url: u("Canteen_chair__Down__E75743__Seat.png"),  defaultScale: 1 },
  { id: "chair-cant-l-1", name: "Cadeira Refeitório Esq. (Azul)",  tags: ["cadeira"],              url: u("Canteen_chair__Left__BCD4D9__Seat.png"),  defaultScale: 1 },
  { id: "chair-cant-l-2", name: "Cadeira Refeitório Esq. (Verm.)", tags: ["cadeira"],              url: u("Canteen_chair__Left__E75743__Seat.png"),  defaultScale: 1 },
  { id: "chair-cant-r-1", name: "Cadeira Refeitório Dir. (Azul)",  tags: ["cadeira"],              url: u("Canteen_chair__Right__BCD4D9__Seat.png"), defaultScale: 1 },
  { id: "chair-cant-r-2", name: "Cadeira Refeitório Dir. (Verm.)", tags: ["cadeira"],              url: u("Canteen_chair__Right__E75743__Seat.png"), defaultScale: 1 },
  { id: "chair-cant-u-1", name: "Cadeira Refeitório Atrás (Azul)", tags: ["cadeira"],              url: u("Canteen_chair__Up__BCD4D9__Seat.png"),   defaultScale: 1 },
  { id: "chair-cant-u-2", name: "Cadeira Refeitório Atrás (Verm.)",tags: ["cadeira"],              url: u("Canteen_chair__Up__E75743__Seat.png"),   defaultScale: 1 },
  // Bar stool
  { id: "chair-bar-1", name: "Banqueta de Bar (Azul)",    tags: ["banqueta","bar"],  url: u("Bar_stool__Down__4280dd__Seat.png"),  defaultScale: 1 },
  { id: "chair-bar-2", name: "Banqueta de Bar (Bege)",    tags: ["banqueta","bar"],  url: u("Bar_stool__Down__B9A78B__Seat.png"),  defaultScale: 1 },
  { id: "chair-bar-3", name: "Banqueta de Bar (Marrom)",  tags: ["banqueta","bar"],  url: u("Bar_stool__Down__BA7F50__Seat.png"),  defaultScale: 1 },
  { id: "chair-bar-4", name: "Banqueta de Bar (Caramelo)",tags: ["banqueta","bar"],  url: u("Bar_stool__Down__C69D62__Seat.png"),  defaultScale: 1 },
  { id: "chair-bar-5", name: "Banqueta de Bar (Verm.)",   tags: ["banqueta","bar"],  url: u("Bar_stool__Down__d93232__Seat.png"),  defaultScale: 1 },
  { id: "chair-bar-6", name: "Banqueta de Bar (Amarelo)", tags: ["banqueta","bar"],  url: u("Bar_stool__Down__f2b22b__Seat.png"),  defaultScale: 1 },
  // Counter stool
  { id: "chair-ctr-1", name: "Banqueta Balcão (Azul)",    tags: ["banqueta","balcão"], url: u("Counter_stool__Down__4078CC__Seat.png"), defaultScale: 1 },
  { id: "chair-ctr-2", name: "Banqueta Balcão (Verde)",   tags: ["banqueta","balcão"], url: u("Counter_stool__Down__4E8C5B__Seat.png"), defaultScale: 1 },
  { id: "chair-ctr-3", name: "Banqueta Balcão (Verm.)",   tags: ["banqueta","balcão"], url: u("Counter_stool__Down__C83131__Seat.png"), defaultScale: 1 },
  // Misc seats
  { id: "chair-plain-l", name: "Cadeira Simples (Esq.)",  tags: ["cadeira","simples"], url: u("Chair__Left__D8D0E0__Seat.png"),           defaultScale: 1 },
  { id: "chair-plain-r", name: "Cadeira Simples (Dir.)",  tags: ["cadeira","simples"], url: u("Chair__Right__D8D0E0__Seat.png"),          defaultScale: 1 },
  { id: "chair-piano-1", name: "Banco de Piano (Preto)",  tags: ["banco","piano"],     url: u("Piano_bench__Down__62647B__Seat.png"),     defaultScale: 1 },
  { id: "chair-piano-2", name: "Banco de Piano (Bordô)",  tags: ["banco","piano"],     url: u("Piano_bench__Down__93284B__Seat.png"),     defaultScale: 1 },
  { id: "chair-foot-1",  name: "Pufe (Bege)",             tags: ["pufe","puff"],       url: u("Footstool__Down__BCA787__Seat.png"),       defaultScale: 1 },
  { id: "chair-foot-2",  name: "Pufe (Cinza)",            tags: ["pufe","puff"],       url: u("Footstool__Down__C6C0B7__Seat.png"),       defaultScale: 1 },
];

/* ──────────────────────── MESAS (TABLE) ──────────────────────── */
const TABLE: LibraryItem[] = [
  // Regular tables
  { id: "tbl-1",  name: "Mesa (Verde-oliva)",      tags: ["mesa","table"],  url: u("Table__Down__BCB986__Table.png"),  defaultScale: 1 },
  { id: "tbl-2",  name: "Mesa (Bege)",             tags: ["mesa","table"],  url: u("Table__Down__BDA88A__Table.png"),  defaultScale: 1 },
  { id: "tbl-3",  name: "Mesa (Lilás)",            tags: ["mesa","table"],  url: u("Table__Down__C7C0CE__Table.png"),  defaultScale: 1 },
  { id: "tbl-4",  name: "Mesa (Caramelo)",         tags: ["mesa","table"],  url: u("Table__Down__D5B375__Table.png"),  defaultScale: 1 },
  // Coffee tables
  { id: "tbl-coffee-1", name: "Mesa de Centro (Marrom)",     tags: ["mesa","centro"],  url: u("Coffee_table__Down__BA7F50__Table.png"),               defaultScale: 1 },
  { id: "tbl-coffee-2", name: "Mesa de Centro (Dourado)",    tags: ["mesa","centro"],  url: u("Coffee_table__Down__CEAA69__Table.png"),               defaultScale: 1 },
  { id: "tbl-re-1",     name: "Mesa Cantos Arredondados",    tags: ["mesa","centro"],  url: u("Coffee_table_(round_edges)__Down__8B829E__Table.png"),  defaultScale: 1 },
  { id: "tbl-re-2",     name: "Mesa Cantos Arred. (Dir.)",   tags: ["mesa"],           url: u("Coffee_table_(round_edges)__Right__8B829E__Table.png"), defaultScale: 1 },
  { id: "tbl-res",      name: "Mesa Pequena Arredondada",    tags: ["mesa","pequena"], url: u("Coffee_table_(round_edges_small)__Down__8B829E__Table.png"),  defaultScale: 1 },
  { id: "tbl-rel",      name: "Mesa Grande Arredondada",     tags: ["mesa","grande"],  url: u("Coffee_table_(round_edges_large)__Down__8B829E__Table.png"),  defaultScale: 1 },
  // Wooden round tables
  { id: "tbl-wr-1", name: "Mesa Redonda (Caramelo)",  tags: ["mesa","redonda"],   url: u("Wooden_table_(round)__Down__B35E3F__Table.png"),  defaultScale: 1 },
  { id: "tbl-wr-2", name: "Mesa Redonda (Creme)",     tags: ["mesa","redonda"],   url: u("Wooden_table_(round)__Down__D0BE9C__Table.png"),  defaultScale: 1 },
  { id: "tbl-wr-3", name: "Mesa Redonda (Dourado)",   tags: ["mesa","redonda"],   url: u("Wooden_table_(round)__Down__D7A968__Table.png"),  defaultScale: 1 },
  // Dining tables
  { id: "tbl-din-1", name: "Mesa de Jantar (Caramelo)", tags: ["mesa","jantar","dining"], url: u("Dining_table__Down__B6774B__Table.png"),  defaultScale: 1 },
  { id: "tbl-din-2", name: "Mesa de Jantar (Bege)",     tags: ["mesa","jantar"],          url: u("Dining_table__Down__BAA88B__Table.png"),  defaultScale: 1 },
  { id: "tbl-din-3", name: "Mesa de Jantar (Dourado)",  tags: ["mesa","jantar"],          url: u("Dining_table__Down__C9A165__Table.png"),  defaultScale: 1 },
  // Glass dining tables
  { id: "tbl-gla-1", name: "Mesa de Vidro (Caramelo / Frente)", tags: ["mesa","vidro"],   url: u("Glass_dining_table__Down__B6774B__Table.png"),  defaultScale: 1 },
  { id: "tbl-gla-2", name: "Mesa de Vidro (Bege / Frente)",     tags: ["mesa","vidro"],   url: u("Glass_dining_table__Down__BAA88B__Table.png"),  defaultScale: 1 },
  { id: "tbl-gla-3", name: "Mesa de Vidro (Dourado / Frente)",  tags: ["mesa","vidro"],   url: u("Glass_dining_table__Down__C9A165__Table.png"),  defaultScale: 1 },
  { id: "tbl-gla-4", name: "Mesa de Vidro (Caramelo / Dir.)",   tags: ["mesa","vidro"],   url: u("Glass_dining_table__Right__B6774B__Table.png"), defaultScale: 1 },
  { id: "tbl-gla-5", name: "Mesa de Vidro (Bege / Dir.)",       tags: ["mesa","vidro"],   url: u("Glass_dining_table__Right__BAA88B__Table.png"), defaultScale: 1 },
  { id: "tbl-gla-6", name: "Mesa de Vidro (Dourado / Dir.)",    tags: ["mesa","vidro"],   url: u("Glass_dining_table__Right__C9A165__Table.png"), defaultScale: 1 },
  // Cabinets
  { id: "tbl-cab-1",  name: "Armário Baixo (Caramelo)",  tags: ["armário","baixo"], url: u("Cabinet__Down__B5794F__Table_Storage.png"),       defaultScale: 1 },
  { id: "tbl-cab-2",  name: "Armário Baixo (Dourado)",   tags: ["armário","baixo"], url: u("Cabinet__Down__C9985D__Table_Storage.png"),       defaultScale: 1 },
  { id: "tbl-cabl-1", name: "Armário Largo (Caramelo)",  tags: ["armário"],         url: u("Cabinet_(large)__Down__B5794F__Table_Storage.png"),defaultScale: 1 },
  { id: "tbl-cabl-2", name: "Armário Largo (Dourado)",   tags: ["armário"],         url: u("Cabinet_(large)__Down__C9985D__Table_Storage.png"),defaultScale: 1 },
  // Bedside tables
  { id: "tbl-bed-1", name: "Criado-Mudo (Caramelo)", tags: ["criado-mudo","quarto"], url: u("Bedside_table__Down__B5794F__Table_Storage.png"), defaultScale: 1 },
  { id: "tbl-bed-2", name: "Criado-Mudo (Bege)",     tags: ["criado-mudo","quarto"], url: u("Bedside_table__Down__BAA78B__Table_Storage.png"), defaultScale: 1 },
  { id: "tbl-bed-3", name: "Criado-Mudo (Dourado)",  tags: ["criado-mudo","quarto"], url: u("Bedside_table__Down__C9985D__Table_Storage.png"), defaultScale: 1 },
  // TV tables
  { id: "tbl-tv-1", name: "Rack de TV (Cinza Escuro / Frente)", tags: ["rack","tv"],  url: u("TV_table__Down__99979B__Table_Storage.png"),  defaultScale: 1 },
  { id: "tbl-tv-2", name: "Rack de TV (Azul Claro / Frente)",   tags: ["rack","tv"],  url: u("TV_table__Down__CAD2E0__Table_Storage.png"),  defaultScale: 1 },
  { id: "tbl-tv-3", name: "Rack de TV (Lilás / Frente)",        tags: ["rack","tv"],  url: u("TV_table__Down__D8D2DE__Table_Storage.png"),  defaultScale: 1 },
  { id: "tbl-tv-4", name: "Rack de TV (Cinza / Dir.)",          tags: ["rack","tv"],  url: u("TV_table__Right__99979B__Table_Storage.png"), defaultScale: 1 },
  { id: "tbl-tv-5", name: "Rack de TV (Azul Claro / Dir.)",     tags: ["rack","tv"],  url: u("TV_table__Right__CAD2E0__Table_Storage.png"), defaultScale: 1 },
  { id: "tbl-tv-6", name: "Rack de TV (Lilás / Dir.)",          tags: ["rack","tv"],  url: u("TV_table__Right__D8D2DE__Table_Storage.png"), defaultScale: 1 },
];

/* ──────────────────────── ELETRÔNICOS ──────────────────────── */
const ELECTRONICS: LibraryItem[] = [
  { id: "elec-tv-d-1",  name: "TV (Escuro / Frente)",     tags: ["tv","televisão"],         url: u("TV__Down__67687D__Electronics.png"),              defaultScale: 1 },
  { id: "elec-tv-d-2",  name: "TV (Claro / Frente)",      tags: ["tv","televisão"],         url: u("TV__Down__A6A2BC__Electronics.png"),              defaultScale: 1 },
  { id: "elec-tv-r-1",  name: "TV (Escuro / Dir.)",       tags: ["tv"],                     url: u("TV__Right__67687D__Electronics.png"),             defaultScale: 1 },
  { id: "elec-tv-r-2",  name: "TV (Claro / Dir.)",        tags: ["tv"],                     url: u("TV__Right__A6A2BC__Electronics.png"),             defaultScale: 1 },
  { id: "elec-tv-u-1",  name: "TV (Escuro / Atrás)",      tags: ["tv"],                     url: u("TV__Up__67687D__Electronics.png"),                defaultScale: 1 },
  { id: "elec-tv-u-2",  name: "TV (Claro / Atrás)",       tags: ["tv"],                     url: u("TV__Up__A6A2BC__Electronics.png"),                defaultScale: 1 },
  { id: "elec-spk-1",   name: "Caixa de Som",             tags: ["som","speaker","áudio"],  url: u("Speaker__Down__565972__Electronics.png"),         defaultScale: 1 },
  { id: "elec-spk-2",   name: "Caixa de Som Grande",      tags: ["som","speaker","áudio"],  url: u("Speaker_(big)__Down__565972__Electronics.png"),   defaultScale: 1 },
  { id: "elec-comp-1",  name: "Computador (Ligado)",      tags: ["computador","pc","desk"], url: u("Computer__Down__B8B5CB__Electronics_Office.png"), defaultScale: 1 },
  { id: "elec-comp-2",  name: "Computador (Desligado)",   tags: ["computador","pc"],        url: u("Computer_(off)__Down__B8B5CB__Electronics_Office.png"), defaultScale: 1 },
  { id: "elec-vend-1",  name: "Máquina de Café (Cinza)",  tags: ["café","máquina","venda"], url: u("Coffee_vending_machine__Down__9297A9__Electronics_Office.png"), defaultScale: 1 },
  { id: "elec-vend-2",  name: "Máquina de Café (Lilás)",  tags: ["café","máquina"],         url: u("Coffee_vending_machine__Down__D8D0E0__Electronics_Office.png"), defaultScale: 1 },
];

/* ──────────────────────── COZINHA ──────────────────────── */
const KITCHEN: LibraryItem[] = [
  { id: "kit-cup",    name: "Xícara de Café",       tags: ["café","xícara","cozinha"],    url: u("Coffee_cup__Down__A0A0B5__Kitchen_Office.png"),           defaultScale: 1 },
  { id: "kit-mach",   name: "Cafeteira",             tags: ["café","cafeteira","cozinha"], url: u("Coffee_machine__Down__82829E__Kitchen_Office_Electronics.png"), defaultScale: 1 },
  { id: "kit-fridge", name: "Geladeira (Fechada)",   tags: ["geladeira","cozinha","fridge"],url: u("Fridge__Down__B8B0C5__Storage_Kitchen_Electronics.png"),  defaultScale: 1 },
  { id: "kit-fridge2",name: "Geladeira (Aberta)",    tags: ["geladeira","cozinha"],        url: u("Fridge_(open)__Down__B8B0C5__Storage_Kitchen_Electronics.png"), defaultScale: 1 },
];

/* ──────────────────────── ILUMINAÇÃO ──────────────────────── */
const LIGHTING: LibraryItem[] = [
  { id: "light-floor-bl",   name: "Luminária de Chão (Azul)",    tags: ["luminária","chão","luz"],   url: u("Floor_lamp__Down__468BD1__Lighting.png"),        defaultScale: 1 },
  { id: "light-floor-rd",   name: "Luminária de Chão (Vermelho)",tags: ["luminária","chão","luz"],   url: u("Floor_lamp__Down__D23B36__Lighting.png"),        defaultScale: 1 },
  { id: "light-table-bl",   name: "Abajur de Mesa (Azul)",       tags: ["abajur","mesa","luz"],      url: u("Table_lamp__Down__468BD1__Lighting.png"),        defaultScale: 1 },
  { id: "light-table-rd",   name: "Abajur de Mesa (Vermelho)",   tags: ["abajur","mesa","luz"],      url: u("Table_lamp__Down__D23B36__Lighting.png"),        defaultScale: 1 },
  { id: "light-wfloor-bl",  name: "Luminária Madeira Chão (Azul)",tags: ["luminária","madeira"],     url: u("Wooden_floor_lamp__Down__468BD1__Lighting.png"), defaultScale: 1 },
  { id: "light-wfloor-rd",  name: "Luminária Madeira Chão (Verm.)",tags: ["luminária","madeira"],    url: u("Wooden_floor_lamp__Down__D23B36__Lighting.png"), defaultScale: 1 },
  { id: "light-wtable-bl",  name: "Abajur Madeira Mesa (Azul)",  tags: ["abajur","madeira","luz"],   url: u("Wooden_table_lamp__Down__468BD1__Lighting.png"), defaultScale: 1 },
  { id: "light-wtable-rd",  name: "Abajur Madeira Mesa (Verm.)", tags: ["abajur","madeira"],         url: u("Wooden_table_lamp__Down__D23B36__Lighting.png"), defaultScale: 1 },
];

/* ──────────────────────── PLANTAS ──────────────────────── */
const PLANTS: LibraryItem[] = [
  { id: "plant-ficus",       name: "Ficus",            tags: ["planta","planta","ficus"],    url: u("Ficus__Down__52855B__Plants.png"),            defaultScale: 1 },
  { id: "plant-pygmy",       name: "Palmeira Anã",     tags: ["planta","palmeira"],          url: u("Pygmy_date_palm__Down__5D994C__Plants.png"),  defaultScale: 1 },
  { id: "plant-strel",       name: "Estrelícia",       tags: ["planta","estrelícia"],        url: u("Strelitzia__Down__5D994C__Plants.png"),       defaultScale: 1 },
  { id: "plant-strel-big",   name: "Estrelícia Grande",tags: ["planta","estrelícia"],        url: u("Strelitzia_(big)__Down__5D994C__Plants.png"),  defaultScale: 1 },
  { id: "plant-strel-sm",    name: "Estrelícia Pequena",tags: ["planta","estrelícia"],       url: u("Strelitzia_(small)__Down__5D994C__Plants.png"),defaultScale: 1 },
  { id: "plant-yucca",       name: "Iúca",             tags: ["planta","yucca","palmeira"],  url: u("Yucca_palm__Down__5D994C__Plants.png"),       defaultScale: 1 },
  { id: "plant-yucca-big",   name: "Iúca Grande",      tags: ["planta","yucca"],             url: u("Yucca_palm_(Big)__Down__5D994C__Plants.png"),  defaultScale: 1 },
  { id: "plant-yucca-sm",    name: "Iúca Pequena",     tags: ["planta","yucca"],             url: u("Yucca_palm_(small)__Down__5D994C__Plants.png"),defaultScale: 1 },
];

/* ──────────────────────── DECORAÇÃO ──────────────────────── */
const DECORATION: LibraryItem[] = [
  { id: "deco-paint-1", name: "Quadro (Escuro)",    tags: ["quadro","parede","arte"],  url: u("Painting__Down__39394C__Decoration.png"), defaultScale: 1 },
  { id: "deco-paint-2", name: "Quadro (Azul Teal)", tags: ["quadro","parede","arte"],  url: u("Painting__Down__4A7778__Decoration.png"), defaultScale: 1 },
  { id: "deco-paint-3", name: "Quadro (Azul)",      tags: ["quadro","parede"],         url: u("Painting__Down__517B90__Decoration.png"), defaultScale: 1 },
  { id: "deco-paint-4", name: "Quadro (Marrom)",    tags: ["quadro","parede"],         url: u("Painting__Down__92683F__Decoration.png"), defaultScale: 1 },
  { id: "deco-paint-5", name: "Quadro (Cinza Azul)",tags: ["quadro","parede"],         url: u("Painting__Down__98A7B8__Decoration.png"), defaultScale: 1 },
  { id: "deco-rug-1",   name: "Tapete (Bege)",      tags: ["tapete","chão"],           url: u("Rug__Down__AC985F__Decoration.png"),      defaultScale: 1 },
  { id: "deco-rug-2",   name: "Tapete (Rosa)",      tags: ["tapete","chão"],           url: u("Rug__Down__D684A1__Decoration.png"),      defaultScale: 1 },
  { id: "deco-rug-3",   name: "Tapete (Branco)",    tags: ["tapete","chão"],           url: u("Rug__Down__E3E3E3__Decoration.png"),      defaultScale: 1 },
];

/* ──────────────────────── ESCRITÓRIO / OFFICE ──────────────────────── */
const OFFICE: LibraryItem[] = [
  { id: "off-stage",     name: "Palco de Conferência",      tags: ["palco","conferência","auditório"], url: u("Conference_hall_stage__Down__C49E62__Office.png"),      defaultScale: 1 },
  { id: "off-book",      name: "Livro (Marrom)",            tags: ["livro","escritório"],              url: u("School/School_office_book.png"),                        defaultScale: 1 },
  { id: "off-book-grn",  name: "Livro (Verde)",             tags: ["livro","escritório"],              url: u("School/School_office_green_book.png"),                  defaultScale: 1 },
  { id: "off-paper",     name: "Papel",                     tags: ["papel","escritório","documento"],  url: u("School/School_office_papper.png"),                      defaultScale: 1 },
  { id: "off-pencil",    name: "Lápis",                     tags: ["lápis","escritório"],              url: u("School/School_office_pencil.png"),                      defaultScale: 1 },
  { id: "off-board-w",   name: "Quadro Branco",             tags: ["quadro","whiteboard","lousa"],     url: u("School/School_whiteboard.png"),                         defaultScale: 1 },
  { id: "off-desk-d",    name: "Mesa de Trabalho (Verde)",  tags: ["mesa","escritório","estação"],     url: u("School/School_office_green_down.png"),                  defaultScale: 1 },
  { id: "off-desk-l",    name: "Mesa de Trabalho Esq.",     tags: ["mesa","escritório"],               url: u("School/School_office_green_left_1x3.png"),              defaultScale: 1 },
  { id: "off-desk-r",    name: "Mesa de Trabalho Dir.",     tags: ["mesa","escritório"],               url: u("School/School_office_green_right_1x3.png"),             defaultScale: 1 },
  { id: "off-chair-f",   name: "Cadeira Escolar (Frente)",  tags: ["cadeira","escola"],                url: u("School/School_chair_front.png"),                        defaultScale: 1 },
  { id: "off-chair-b",   name: "Cadeira Escolar (Atrás)",   tags: ["cadeira","escola"],                url: u("School/School_chair_back.png"),                         defaultScale: 1 },
  { id: "off-chair-l",   name: "Cadeira Escolar (Esq.)",    tags: ["cadeira","escola"],                url: u("School/School_chair_left.png"),                         defaultScale: 1 },
  { id: "off-chair-r",   name: "Cadeira Escolar (Dir.)",    tags: ["cadeira","escola"],                url: u("School/School_chair_right.png"),                        defaultScale: 1 },
  { id: "off-box",       name: "Caixa Escolar",             tags: ["caixa","escola"],                  url: u("School/School_box.png"),                                defaultScale: 1 },
  { id: "off-1x1",       name: "Bloco 1x1",                 tags: ["bloco","referência"],              url: u("School/School_1x1.png"),                                defaultScale: 1 },
];

/* ──────────────────────── ARMAZENAMENTO ──────────────────────── */
const STORAGE: LibraryItem[] = [
  { id: "stor-ward",       name: "Guarda-Roupa",             tags: ["guarda-roupa","armário","quarto"], url: u("Wardrobe__Down__8B829E__Storage.png"),              defaultScale: 1 },
  { id: "stor-book",       name: "Estante (Com Livros)",     tags: ["estante","livros"],                url: u("Bookshelf__Down__EBE4F2__Storage.png"),             defaultScale: 1 },
  { id: "stor-book-empty", name: "Estante (Vazia)",          tags: ["estante","vazia"],                 url: u("Bookshelf_(empty)__Down__EBE4F2__Storage.png"),     defaultScale: 1 },
];

/* ══════════════════ CATÁLOGO PRINCIPAL ══════════════════ */
export const LIBRARY: LibraryCategory[] = [
  { id: "activities",  name: "Atividades",   icon: "🎮", items: ACTIVITIES  },
  { id: "seat",        name: "Assentos",     icon: "🪑", items: CHAIR       },
  { id: "table",       name: "Mesas",        icon: "🪵", items: TABLE       },
  { id: "office",      name: "Escritório",   icon: "💼", items: OFFICE      },
  { id: "electronics", name: "Eletrônicos",  icon: "📺", items: ELECTRONICS },
  { id: "kitchen",     name: "Cozinha",      icon: "☕", items: KITCHEN     },
  { id: "bathroom",    name: "Banheiro",     icon: "🚿", items: BATHROOM    },
  { id: "bed",         name: "Quarto",       icon: "🛏️", items: BED         },
  { id: "plants",      name: "Plantas",      icon: "🌿", items: PLANTS      },
  { id: "lighting",    name: "Iluminação",   icon: "💡", items: LIGHTING    },
  { id: "decoration",  name: "Decoração",    icon: "🖼️", items: DECORATION  },
  { id: "storage",     name: "Armazenamento",icon: "📦", items: STORAGE     },
];

/** Total de itens */
export const LIBRARY_TOTAL = LIBRARY.reduce((s, c) => s + c.items.length, 0);

/**
 * Busca no catálogo por nome, tags ou categoria.
 * Retorna lista de LibraryItem.
 */
export function searchLibrary(query: string): LibraryItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: LibraryItem[] = [];
  LIBRARY.forEach(cat => {
    cat.items.forEach(item => {
      if (
        item.name.toLowerCase().includes(q) ||
        item.tags?.some(t => t.toLowerCase().includes(q)) ||
        cat.name.toLowerCase().includes(q)
      ) {
        results.push(item);
      }
    });
  });
  return results;
}
