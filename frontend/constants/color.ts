export const light = {
  background: "#EFE3D1",
  primary:    "#151210",
  secondary:  "#666666",
  tertiary:   "#999999",
  quaternary: "#DDD2C6",
  surface:    "#FFF8EF",
  surfaceAlt: "#F8F3EC",
  border:     "#DDD2C6",
  borderStrong: "#151210",
} as const;

export const dark = {
  background: "#0d1110",
  primary:    "#f6efe6",
  secondary:  "#d1c5ba",
  tertiary:   "#a89d91",
  quaternary: "#2A2520",
  surface:    "#18201D",
  surfaceAlt: "#191c1a",
  border:     "#2A2520",
  borderStrong: "#312d29",
} as const;

export type ColorToken = keyof typeof light;
