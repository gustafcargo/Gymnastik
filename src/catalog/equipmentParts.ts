/**
 * Definierar färgsättningsbara delar per redskapstyp.
 * Nyckel matchar EquipmentDetail.kind.
 * Värde = Record<partKey, defaultHexColor>
 */
export const EQUIPMENT_PARTS: Partial<Record<string, Record<string, string>>> = {
  "parallel-bars": {
    räcken: "#B8824A",
    ram: "#CDD2DA",
  },
  "high-bar": {
    stång: "#CDD2DA",
    stommar: "#CDD2DA",
    vajrar: "#A8B0BA",
  },
  beam: {
    bom: "#8C6240",
    stöd: "#CC2020",
  },
  "pommel-horse": {
    kropp: "#8C6240",
    byglar: "#CDD2DA",
    ben: "#CDD2DA",
  },
  rings: {
    ringar: "#CDD2DA",
    remmar: "#8C6240",
  },
  vault: {
    kropp: "#8C6240",
    sockel: "#CDD2DA",
  },
  trampette: {
    ram: "#252D3A",
    matta: "#B82020",
  },
  "mini-tramp": {
    ram: "#252D3A",
    matta: "#B82020",
  },
  buck: {
    kropp: "#8C6240",
    sockel: "#CDD2DA",
  },
};
