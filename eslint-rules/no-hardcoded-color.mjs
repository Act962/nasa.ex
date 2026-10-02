/**
 * Avisa quando uma tela usa cor fixa em vez dos tokens do tema (docs/design-system-overview.md).
 * Cor fixa não acompanha o modo escuro nem uma troca de tema; use bg-card, text-muted-foreground,
 * text-destructive, bg-chart-1… Cor que vem do dado (etapa, tag, temperatura) não é literal e passa.
 */

const COLOR_UTILITY = "(?:bg|text|border|ring|fill|stroke|from|via|to|outline|divide|decoration|accent|caret|shadow|placeholder)";
const PALETTE = "(?:zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";

const PALETTE_CLASS = new RegExp(`(?:^|[\\s:])${COLOR_UTILITY}(?:-[trblxy])?-${PALETTE}-\\d{2,3}(?:/\\d{1,3})?(?=$|[\\s"'\`])`);
const ARBITRARY_HEX_CLASS = new RegExp(`(?:^|[\\s:])${COLOR_UTILITY}(?:-[trblxy])?-\\[#[0-9a-fA-F]{3,8}\\]`);
const HEX_OR_RGB_VALUE = /^\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))\s*$/;

const CLASS_HELPERS = new Set(["cn", "cva", "clsx", "twMerge"]);
const COLOR_STYLE_PROPS = new Set([
  "color",
  "background",
  "backgroundColor",
  "borderColor",
  "outlineColor",
  "fill",
  "stroke",
]);

const MAX_PARENT_DEPTH = 8;

function findAncestor(node, predicate) {
  let current = node.parent;
  for (let depth = 0; current && depth < MAX_PARENT_DEPTH; depth++) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return null;
}

function isInClassContext(node) {
  return Boolean(
    findAncestor(
      node,
      (ancestor) =>
        (ancestor.type === "JSXAttribute" && ancestor.name?.name === "className") ||
        (ancestor.type === "CallExpression" &&
          ancestor.callee.type === "Identifier" &&
          CLASS_HELPERS.has(ancestor.callee.name)),
    ),
  );
}

function isInStyleAttribute(node) {
  return Boolean(
    findAncestor(node, (ancestor) => ancestor.type === "JSXAttribute" && ancestor.name?.name === "style"),
  );
}

function readPropertyName(property) {
  if (property.key.type === "Identifier") return property.key.name;
  if (property.key.type === "Literal") return String(property.key.value);
  return null;
}

export const noHardcodedColor = {
  meta: {
    type: "suggestion",
    docs: { description: "Proíbe cor fixa nas telas; use os tokens do Design System Órbita." },
    messages: {
      paletteClass:
        "Cor fixa '{{match}}': use um token do tema (bg-card, text-muted-foreground, text-destructive, bg-chart-1…). Ver docs/design-system-overview.md.",
      styleColor:
        "Cor fixa em style ({{prop}}: {{value}}): use var(--token) do tema, ou a cor que vem do dado. Ver docs/design-system-overview.md.",
    },
    schema: [],
  },
  create(context) {
    function checkClassString(node, rawValue) {
      if (typeof rawValue !== "string" || !isInClassContext(node)) return;
      const match = rawValue.match(PALETTE_CLASS) ?? rawValue.match(ARBITRARY_HEX_CLASS);
      if (match) context.report({ node, messageId: "paletteClass", data: { match: match[0].trim() } });
    }

    return {
      Literal(node) {
        checkClassString(node, node.value);
      },
      TemplateElement(node) {
        checkClassString(node, node.value.raw);
      },
      Property(node) {
        const propName = readPropertyName(node);
        if (!propName || !COLOR_STYLE_PROPS.has(propName)) return;
        if (node.value.type !== "Literal" || typeof node.value.value !== "string") return;
        if (!HEX_OR_RGB_VALUE.test(node.value.value) || !isInStyleAttribute(node)) return;
        context.report({ node, messageId: "styleColor", data: { prop: propName, value: node.value.value } });
      },
    };
  },
};

export const orbitaPlugin = {
  rules: { "no-hardcoded-color": noHardcodedColor },
};
