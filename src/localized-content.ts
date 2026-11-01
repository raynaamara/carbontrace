import type { CatalogSample, Material } from "./model.ts";
import { MATERIALS } from "./model.ts";
import type { DocumentedFactors } from "./operational.ts";
import type { UploadedPhoto } from "./photos.ts";
import { getParameterSet, isParameterSetId } from "./parameter-sets.ts";
import type { EmissionParameterSet, ParameterSetId } from "./parameter-sets.ts";
import { getLanguage, messages, t } from "./i18n.ts";

const legacyEnglishNames: Readonly<Record<string, string>> = {
  "CT-001": "Small beverage bottle",
  "CT-002": "Water bottle",
  "CT-003": "Small shipping box",
  "CT-004": "Thin corrugated box",
  "CT-005": "Flattened cardboard",
  "CT-006": "Unlabelled bottle",
  "CT-007": "Large packaging bottle",
  "CT-008": "Medium cardboard box",
};
const sampleHintKeys = { pet: "samplePetHint", cardboard: "sampleCardboardHint", drywall: "sampleDrywallHint" } as const;

export function materialName(material: Material): string {
  return t(material);
}

export function sampleName(sample: CatalogSample): string {
  return materialName(sample.material);
}

export function sampleOptionLabel(sample: CatalogSample): string {
  return `${sample.id} / ${sampleName(sample)}`;
}

export function sampleSearchText(sample: CatalogSample, confirmedMaterial: Material): string {
  const displayNames = messages[sample.material].map((name) => `${name} ${sample.id.slice(-3)}`).join(" ");
  return `${sample.id} ${sample.name} ${legacyEnglishNames[sample.id] ?? ""} ${displayNames} ${messages[confirmedMaterial].join(" ")}`;
}

export function uploadedPhotoSearchText(photo: UploadedPhoto, confirmedMaterial: Material): string {
  return `${photo.id} ${photo.originalName} ${messages[confirmedMaterial].join(" ")}`;
}

export function sampleDescription(sample: CatalogSample): string {
  const role = sample.role === "outside" ? t("roleDescriptionOutside")
    : sample.role === "train" ? t("roleDescriptionTrain")
    : sample.testCohort === "previous-test" ? t("roleDescriptionOld") : t("roleDescriptionNew");
  return `${t("sampleDatasetDescription", { material: materialName(sample.material), role })} ${t(sampleHintKeys[sample.material])}`;
}

type ParameterCopy = Pick<EmissionParameterSet,
  "name" | "summary" | "baselineScenario" | "alternativeScenario"
  | "baselineDescription" | "alternativeDescription" | "assumptions" | "whenToUse"> & {
  referenceTitle: string;
  unitNote: string;
  locationNote: string;
  snapshotSuffix: string;
  linkLabels: readonly [string, string, string];
};

export interface ParameterView extends Omit<ParameterCopy, "linkLabels"> {
  links: readonly { label: string; url: string }[];
}

const warmReference = {
  referenceTitle: "US EPA WARM v16 (December 2023)",
  unitNote: "Units: kg CO2e/kg of material. Original WARM values (MTCO2e/US short ton) are multiplied by 1000/907.18474 and rounded to six decimal places. Negative values are net life-cycle results, not direct CO2 removal.",
  locationNote: "US reference, not an official Indonesian factor. Cardboard means Corrugated Containers. WARM is a screening-level comparison tool, not a GHG inventory or carbon-credit methodology.",
  snapshotSuffix: "Converted from MTCO2e/US short ton to kg CO2e/kg and rounded to six decimal places. Not an Indonesian factor or a verified emission reduction.",
  linkLabels: ["US EPA WARM v16 (December 2023) - official workbook", "WARM versions and updates", "Official EPA methodology and limitations"] as const,
};
const placesReference = {
  referenceTitle: "TCI/SIMTech PLACES - Indonesia/PET (accessed 24 October 2026)",
  unitNote: "Units: kg CO2e/kg PET. Initial impact and Recycling impact (tonnes CO2e) from a query for 1,000,000 metric tonnes of PET are divided by 1,000,000. The large query reduces display rounding; it is not the project's sample quantity. Six decimal places do not imply measurement precision. Negative factors include avoided virgin production.",
  locationNote: "PLACES uses an Indonesian context for PET only; these are not official government factors or measurements of your facility. Cardboard is unsupported and is not estimated. The methodology differs from WARM, so differences are not solely country effects. PLACES may require sign-in.",
  snapshotSuffix: "Indonesia/PET query for 1,000,000 metric tonnes; tonnes CO2e output divided by 1,000,000 gives kg CO2e/kg. Values are derived from rounded displays, checked on 24 October 2026; not official government factors or verified emission reductions. Cardboard is unsupported.",
};

const englishParameters: Readonly<Record<ParameterSetId, ParameterCopy>> = {
  "warm16-drywall-us-average-r1": {
    ...warmReference,
    name: "Set 5 - WARM v16: drywall, US-average landfill",
    summary: "Compares US-average landfill and paper-faced drywall recycling. Landfill has a lower modeled GHG result, not an overall disposal recommendation.",
    baselineScenario: "Drywall landfill - US national average (WARM v16)",
    alternativeScenario: "Drywall recycling (WARM v16)",
    baselineDescription: "The model includes paper-facing carbon storage and assumes negligible drywall methane yield. Mineral gypsum does not directly absorb this CO2.",
    alternativeDescription: "Recycling is modeled into new drywall (19%) and agricultural uses (81%). This is not a measurement of a local facility.",
    assumptions: "US reference; regular half-inch paper-faced gypsum board; National Average landfill; default transport 20 miles; Summary Data E53/C53. Not cement board, pure gypsum or all construction debris. Hydrogen sulfide (H2S) and non-GHG impacts are not ranked by this CO2e comparison.",
    whenToUse: "For an emission comparison, not landfill advice. Check material identity, contamination, local rules and facility acceptance. Do not break or handle dusty or hazardous debris for a demo. No Indonesian site-specific factor has been verified.",
    locationNote: "US paper-faced drywall reference, not an Indonesian factor. Negative landfill values include paper carbon storage. H2S risks remain; lower GHG is not an overall environmental recommendation.",
    linkLabels: ["US EPA WARM v16 - official workbook", "Drywall methods: Exhibits 6-5, 6-17 and limitations", "Official EPA methodology and limitations"],
  },
  "warm16-us-average-r1": {
    ...warmReference,
    name: "Set 1 - WARM v16: US-average landfill",
    summary: "Compares landfilling under US national-average assumptions with recycling used material.",
    baselineScenario: "Landfill - US national average (WARM v16)",
    alternativeScenario: "Recycling used material (WARM v16)",
    baselineDescription: "Material is assumed to enter a landfill with the US national-average mix of gas-control conditions. This does not establish where your sample actually ends up.",
    alternativeDescription: "The same material is assumed to be recycled. Net WARM factors may include avoided virgin-material production and carbon storage, not just recycling machinery emissions.",
    assumptions: "US reference; national-average electricity and moisture; National Average landfill assumptions; default transport of 20 miles for landfill and recycling; factors from Summary Data in the original workbook without local adjustment.",
    whenToUse: "For method comparisons under default WARM assumptions. Do not treat US averages as Indonesian conditions or evidence of actual treatment.",
  },
  "warm16-no-lfg-r1": {
    ...warmReference,
    name: "Set 2 - WARM v16: landfill without an LFG system",
    summary: "Compares landfilling without landfill-gas collection/recovery with recycling used material.",
    baselineScenario: "Landfill without an LFG system - US reference (WARM v16)",
    alternativeScenario: "Recycling used material (WARM v16)",
    baselineDescription: "Material is assumed to enter a landfill without gas control/recovery (No Recovery). This is not captured gas being flared or used for energy.",
    alternativeDescription: "The same material is assumed to be recycled using the same WARM v16 recycling factors as Set 1.",
    assumptions: "US reference; No Recovery landfill scenario; national-average electricity and moisture; default transport of 20 miles for both pathways; factors from Summary Data in the original workbook.",
    whenToUse: "For testing no-LFG assumptions or sensitivity analysis. This does not automatically represent Indonesian landfills; facility suitability needs evidence.",
  },
  "places-id-pet-sanitary-20261024-r1": {
    ...placesReference,
    name: "Set 3 - PLACES Indonesia: sanitary landfill (PET)",
    summary: "Compares PET sent to Sanitary Landfill with mechanical recycling in the PLACES Indonesia model. This set provides PET factors only.",
    baselineScenario: "Sanitary landfill - Indonesia/PET (PLACES)",
    alternativeScenario: "Mechanical PET recycling - Indonesia (PLACES)",
    baselineDescription: "PET is assumed to enter the Sanitary Landfill pathway in PLACES Indonesia. A sanitary landfill is not an open dump and does not represent all Indonesian disposal sites.",
    alternativeDescription: "The same PET mass is assumed to be diverted to mechanical recycling. Net values include processing, transport, and avoided virgin production, including a 95% virgin-PET substitution assumption.",
    assumptions: "Indonesia/PET; TCI/SIMTech PLACES, SSEA methodology updated October 2025; Ecoinvent v3.9 impact factors; local transport of 20 km between collection and facilities; 95% virgin-PET substitution; recycling rejects follow the model's Indonesian pathway mix; Sanitary Landfill explicitly selected, not Default EOL Fates.",
    whenToUse: "For Indonesian PET studies explicitly considering sanitary landfill. Use Set 4 for an open-dump baseline. Facility conditions and recycling acceptance still need evidence. Do not use for cardboard, PP caps, or all plastics.",
    linkLabels: ["PLACES source query - Indonesia/PET, Sanitary Landfill, 1,000,000 tonnes", "PLACES SSEA methodology - October 2025", "PLACES scope and explanation (TCI/SIMTech)"],
  },
  "places-id-pet-open-dump-20261024-r1": {
    ...placesReference,
    name: "Set 4 - PLACES Indonesia: open dump (PET)",
    summary: "Compares PET sent to Open Dump with mechanical recycling in the PLACES Indonesia model. This set provides PET factors only.",
    baselineScenario: "Open dump - Indonesia/PET (PLACES)",
    alternativeScenario: "Mechanical PET recycling - Indonesia (PLACES)",
    baselineDescription: "PET is assumed to enter the Open Dump pathway in PLACES Indonesia. This is neither sanitary landfill nor the separate Open Burning pathway.",
    alternativeDescription: "The same PET mass is assumed to be diverted to mechanical recycling, using the same PLACES Indonesia recycling factor as Set 3.",
    assumptions: "Indonesia/PET; TCI/SIMTech PLACES, SSEA methodology updated October 2025; Ecoinvent v3.9 impact factors; local transport of 20 km between collection and facilities; 95% virgin-PET substitution; recycling rejects follow the model's Indonesian pathway mix; Open Dump explicitly selected, not Default EOL Fates or Open Burning.",
    whenToUse: "For Indonesian PET studies testing an open-dump baseline. This does not assert that all Indonesian sites operate this way. Document the site assumption; do not choose a set merely because the estimate is larger. Cardboard is unsupported.",
    linkLabels: ["PLACES source query - Indonesia/PET, Open Dump, 1,000,000 tonnes", "PLACES SSEA methodology - October 2025", "PLACES scope and explanation (TCI/SIMTech)"],
  },
};

export function parameterView(id: ParameterSetId): ParameterView {
  const definition = getParameterSet(id);
  if (getLanguage() === "id") {
    return {
      name: definition.name, summary: definition.summary,
      baselineScenario: definition.baselineScenario, alternativeScenario: definition.alternativeScenario,
      baselineDescription: definition.baselineDescription, alternativeDescription: definition.alternativeDescription,
      assumptions: definition.assumptions, whenToUse: definition.whenToUse,
      referenceTitle: definition.reference.title, unitNote: definition.reference.unitNote,
      locationNote: definition.reference.locationNote, snapshotSuffix: definition.reference.snapshotSuffix,
      links: definition.reference.links,
    };
  }
  const copy = englishParameters[id];
  if (definition.reference.links.length !== copy.linkLabels.length) throw new Error("Reference link translations are incomplete.");
  return {
    ...copy,
    links: definition.reference.links.map((link, index) => {
      const label = copy.linkLabels[index];
      if (label === undefined) throw new Error("Missing reference link translation.");
      return { label, url: link.url };
    }),
  };
}

export function coverageName(id: ParameterSetId): string {
  return t(id === "warm16-drywall-us-average-r1" ? "coverageDrywall"
    : getParameterSet(id).factors.cardboard === undefined ? "coveragePet" : "coverageBoth");
}

export function unsupportedMaterialNames(id: ParameterSetId): string {
  return MATERIALS.filter((material) => getParameterSet(id).factors[material] === undefined)
    .map(materialName).join(" / ");
}

export function factorName(factors: DocumentedFactors | null): string {
  if (factors === null) return t("unconfigured");
  if (isParameterSetId(factors.parameterSetId)) return parameterView(factors.parameterSetId).name;
  return t(factors.parameterSetId === undefined ? "customLegacyParameter" : "customParameter");
}

export function factorSource(factors: DocumentedFactors): string {
  if (!isParameterSetId(factors.parameterSetId)) return factors.sourceTitle;
  const definition = getParameterSet(factors.parameterSetId);
  const reference = definition.factors[factors.material];
  if (reference === undefined) throw new Error("The reference does not cover this material.");
  return `${parameterView(definition.id).referenceTitle}; ${definition.reference.sourceLabel} ${reference.baselineCell}/${reference.alternativeCell}; ${reference.sourceMaterial}`;
}

export function factorScope(factors: DocumentedFactors): string {
  if (!isParameterSetId(factors.parameterSetId)) return factors.scope;
  const view = parameterView(factors.parameterSetId);
  return `${view.assumptions} ${view.snapshotSuffix}`;
}

const historyScopeKeys = {
  "warm16-us-average-r1": "historyWarmAverageScope",
  "warm16-no-lfg-r1": "historyWarmNoGasScope",
  "warm16-drywall-us-average-r1": "historyDrywallScope",
  "places-id-pet-sanitary-20261024-r1": "historyPlacesSanitaryScope",
  "places-id-pet-open-dump-20261024-r1": "historyPlacesOpenDumpScope",
} as const;

export function factorScopeParagraphs(factors: DocumentedFactors): string[] {
  if (!isParameterSetId(factors.parameterSetId)) return [factors.scope];
  return [
    t(historyScopeKeys[factors.parameterSetId]),
    t(factors.parameterSetId.startsWith("warm16-") ? "historyWarmConversion" : "historyPlacesConversion"),
  ];
}

export function factorScenarios(factors: DocumentedFactors): { baseline: string; alternative: string } {
  if (!isParameterSetId(factors.parameterSetId)) {
    return { baseline: factors.baselineScenario, alternative: factors.alternativeScenario };
  }
  const view = parameterView(factors.parameterSetId);
  return { baseline: view.baselineScenario, alternative: view.alternativeScenario };
}

export function factorFormText(factors: DocumentedFactors | null): Pick<DocumentedFactors, "baselineScenario" | "alternativeScenario" | "sourceTitle" | "scope"> {
  if (factors === null) return { baselineScenario: "", alternativeScenario: "", sourceTitle: "", scope: "" };
  const scenarios = factorScenarios(factors);
  return {
    baselineScenario: scenarios.baseline, alternativeScenario: scenarios.alternative,
    sourceTitle: factorSource(factors), scope: factorScope(factors),
  };
}
