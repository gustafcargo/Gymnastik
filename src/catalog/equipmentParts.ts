/**
 * Definierar färgsättningsbara delar per redskapstyp.
 * Nyckel matchar EquipmentDetail.kind.
 * Värde = Record<partKey, defaultHexColor>
 *
 * Varje nyckel måste ha en matchande pc()-anrop i Equipment3D.tsx.
 */
export const EQUIPMENT_PARTS: Partial<Record<string, Record<string, string>>> = {
  "parallel-bars": {
    räcken:  "#B8824A",   // the two rails
    ram:     "#CDD2DA",   // posts + cross-braces
    sockel:  "#252D3A",   // base plates
  },
  "high-bar": {
    stång:   "#CDD2DA",   // the bar
    stommar: "#CDD2DA",   // uprights
    vajrar:  "#A8B0BA",   // cable stays
    sockel:  "#252D3A",   // base plates
  },
  beam: {
    stöd:    "#CC2020",   // pedestal tubes
    bom:     "#4A2810",   // beam structural body
    yta:     "#B8875A",   // leather/suede top surface
    sockel:  "#252D3A",   // base plates
  },
  "pommel-horse": {
    kropp:   "#7A5230",   // saddle body
    yta:     "#A07848",   // leather top surface
    byglar:  "#CDD2DA",   // pommels (U-shaped handles)
    ben:     "#CDD2DA",   // legs
    sockel:  "#252D3A",   // base plates
  },
  rings: {
    ram:     "#8B3030",   // A-frame / posts
    ringar:  "#CDD2DA",   // the rings
    remmar:  "#6B4A2A",   // leather straps
  },
  "rings-free": {
    ringar:  "#CDD2DA",   // the rings
    remmar:  "#6B4A2A",   // leather straps
  },
  "uneven-bars": {
    räcken:  "#CDD2DA",   // rails (high + low bar)
    ram:     "#CDD2DA",   // posts + braces
    sockel:  "#252D3A",   // base plates
  },
  vault: {
    kropp:   "#4A2810",   // padding body
    yta:     "#C8A878",   // leather top surface
    stommar: "#252D3A",   // metal legs + frame
  },
  trampette: {
    ram:     "#232C3A",   // steel frame
    matta:   "#B02020",   // jump surface
  },
  "mini-tramp": {
    ram:     "#232C3A",   // steel frame
    matta:   "#B02020",   // jump surface
  },
  plinth: {
    kropp:   "#7A5330",   // main body colour
  },
  buck: {
    kropp:   "#8C6240",   // padded body
    stommar: "#CDD2DA",   // legs/stand
    sockel:  "#252D3A",   // base plates
  },
};
