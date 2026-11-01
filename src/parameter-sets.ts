import { MATERIALS, MATERIAL_LABELS, isMaterial, ValidationError } from "./model.ts";
import type { Material } from "./model.ts";

export const CUSTOM_PARAMETER_NAME = "Parameter khusus";
export type ParameterSetId = "warm16-us-average-r1" | "warm16-no-lfg-r1"
  | "places-id-pet-sanitary-20261024-r1" | "places-id-pet-open-dump-20261024-r1"
  | "warm16-drywall-us-average-r1";

export const DEFAULT_PARAMETER_SET_IDS: Readonly<Record<Material, ParameterSetId>> = {
  pet: "warm16-us-average-r1",
  cardboard: "warm16-us-average-r1",
  drywall: "warm16-drywall-us-average-r1",
};

export const WARM_REFERENCE = {
  title: "US EPA WARM v16 (Desember 2023)",
  workbookUrl: "https://www.epa.gov/system/files/documents/2023-12/warm_v16.xls",
  versionsUrl: "https://www.epa.gov/waste-reduction-model/versions-waste-reduction-model",
  explanationUrl: "https://www.epa.gov/waste-reduction-model/basic-information-about-waste-reduction-model",
  workbookSha256: "5886bef6721735efdb95ffd904c1c50ff1d6f0ea567b2c8c7f8ee4633d519f22",
  verifiedDate: "2026-10-24",
  sourceUnit: "MTCO2e / US short ton material",
  targetUnit: "kg CO2e / kg material",
  shortTonKg: 907.18474,
};

export const PLACES_REFERENCE = {
  title: "TCI/SIMTech PLACES - Indonesia/PET (akses 24 Oktober 2026)",
  toolUrl: "https://places.thecirculateinitiative.org/",
  overviewUrl: "https://www.thecirculateinitiative.org/plastic-lifecycle-assessment-calculator-for-the-environment-and-society/",
  methodologyUrl: "https://www.thecirculateinitiative.org/wp-content/uploads/The-Circulate-Initiative-PLACES-SSEA-Methodology-and-Results_Oct-2025.pdf",
  methodologySha256: "5063ec73fa7ce9e09f9238658c8bf0683cc3de383b95fb629a9d152080615b7b",
  methodologyUpdated: "Oktober 2025",
  verifiedDate: "2026-10-24",
  queryQuantityTonnes: 1_000_000,
};

interface ParameterReference {
  title: string;
  sourceUrl: string;
  sourceLabel: string;
  co2eUnitKg: number;
  materialQuantityKg: number;
  unitNote: string;
  locationNote: string;
  snapshotSuffix: string;
  links: readonly { label: string; url: string }[];
}

const WARM_PARAMETER_REFERENCE: ParameterReference = {
  title: WARM_REFERENCE.title,
  sourceUrl: WARM_REFERENCE.workbookUrl,
  sourceLabel: "Summary Data",
  co2eUnitKg: 1000,
  materialQuantityKg: WARM_REFERENCE.shortTonKg,
  unitNote: "Satuan kg CO2e/kg material. Nilai WARM asli (MTCO2e/US short ton) dikali 1000/907,18474 lalu dibulatkan 6 desimal. Faktor negatif adalah nilai neto model daur hidup, bukan penyerapan CO2 langsung.",
  locationNote: "Rujukan Amerika Serikat, bukan faktor resmi Indonesia. Kardus berarti Corrugated Containers. WARM adalah alat perbandingan tingkat penyaringan, bukan inventori GRK atau kredit karbon.",
  snapshotSuffix: "Satuan telah dikonversi dari MTCO2e/US short ton ke kg CO2e/kg dan dibulatkan 6 desimal. Bukan faktor Indonesia atau pengurangan emisi terverifikasi.",
  links: [
    { label: `${WARM_REFERENCE.title} - workbook resmi`, url: WARM_REFERENCE.workbookUrl },
    { label: "Versi dan pembaruan WARM", url: WARM_REFERENCE.versionsUrl },
    { label: "Metode dan batasan resmi EPA", url: WARM_REFERENCE.explanationUrl },
  ],
};

function placesParameterReference(fate: "Sanitary Landfill" | "Open Dump"): ParameterReference {
  const url = new URL(PLACES_REFERENCE.toolUrl);
  url.search = new URLSearchParams({
    lang: "en", countries: "id", pt_0_id: "0", pt_0_type: "PET",
    pt_0_qt: String(PLACES_REFERENCE.queryQuantityTonnes), pt_0_eol: fate, pt_ct: "1",
  }).toString();
  return {
    title: PLACES_REFERENCE.title,
    sourceUrl: url.href,
    sourceLabel: "GHG emissions - Details",
    co2eUnitKg: 1000,
    materialQuantityKg: PLACES_REFERENCE.queryQuantityTonnes * 1000,
    unitNote: "Satuan kg CO2e/kg PET. Angka Initial impact dan Recycling impact (tonnes CO2e) dari kueri 1.000.000 metric tonnes PET dibagi 1.000.000. Kueri besar dipakai untuk mengurangi pembulatan tampilan, bukan jumlah sampel proyek. Enam desimal bukan ketelitian pengukuran; faktor negatif mencakup produksi baru yang dihindari.",
    locationNote: "Model PLACES berkonteks Indonesia untuk PET saja, bukan faktor resmi pemerintah atau hasil ukur fasilitas Anda. Kardus tidak didukung dan tidak dihitung. Metode berbeda dari WARM; selisih hasil bukan semata-mata efek negara. Sumber PLACES dapat meminta login.",
    snapshotSuffix: "Kueri Indonesia/PET 1.000.000 metric tonnes; keluaran tonnes CO2e dibagi 1.000.000 menjadi kg CO2e/kg. Angka berasal dari tampilan yang dibulatkan, diverifikasi 24 Oktober 2026; bukan faktor resmi pemerintah atau pengurangan emisi terverifikasi. Kardus tidak didukung.",
    links: [
      { label: `Kueri sumber PLACES - Indonesia/PET, ${fate}, 1.000.000 ton`, url: url.href },
      { label: "Metodologi PLACES SSEA - Oktober 2025", url: PLACES_REFERENCE.methodologyUrl },
      { label: "Cakupan dan penjelasan PLACES (TCI/SIMTech)", url: PLACES_REFERENCE.overviewUrl },
    ],
  };
}

export interface ReferenceFactors {
  sourceMaterial: string;
  baselineOriginal: number;
  alternativeOriginal: number;
  baselineCell: string;
  alternativeCell: string;
}

export interface EmissionParameterSet {
  id: ParameterSetId;
  name: string;
  summary: string;
  baselineScenario: string;
  alternativeScenario: string;
  baselineDescription: string;
  alternativeDescription: string;
  assumptions: string;
  whenToUse: string;
  reference: ParameterReference;
  factors: Readonly<Partial<Record<Material, ReferenceFactors>>>;
}

// Versioned IDs keep historical snapshots tied to immutable reference values.
export const PARAMETER_SETS: readonly EmissionParameterSet[] = [
  {
    id: "warm16-us-average-r1",
    name: "Set 1 - WARM v16: landfill rata-rata AS",
    summary: "Membandingkan landfill dengan asumsi rata-rata nasional Amerika Serikat dan daur ulang material bekas.",
    baselineScenario: "Landfill - rata-rata nasional AS (WARM v16)",
    alternativeScenario: "Daur ulang material bekas (WARM v16)",
    baselineDescription: "Material diasumsikan dibuang ke landfill dengan campuran kondisi pengendalian gas rata-rata nasional AS. Ini bukan pernyataan bahwa sampel Anda benar-benar berakhir di TPA.",
    alternativeDescription: "Material yang sama diasumsikan didaur ulang. Faktor neto WARM dapat memasukkan produksi material baru yang dihindari dan penyimpanan karbon; bukan hanya emisi dari mesin daur ulang.",
    assumptions: "Referensi Amerika Serikat; listrik dan kelembapan rata-rata nasional; asumsi landfill National Average; jarak transportasi default 20 mil untuk landfill dan daur ulang; faktor dari Summary Data pada workbook asli tanpa penyesuaian lokal.",
    whenToUse: "Untuk perbandingan metode dengan asumsi default WARM. Jangan menganggap rata-rata AS sebagai kondisi Indonesia atau bukti jalur pengelolaan aktual.",
    reference: WARM_PARAMETER_REFERENCE,
    factors: {
      pet: { sourceMaterial: "PET", baselineOriginal: 0.020254519141196047, alternativeOriginal: -1.0357206316437553, baselineCell: "E8", alternativeCell: "C8" },
      cardboard: { sourceMaterial: "Corrugated Containers", baselineOriginal: 0.18162984857485934, alternativeOriginal: -3.1353369086789917, baselineCell: "E9", alternativeCell: "C9" },
    },
  },
  {
    id: "warm16-no-lfg-r1",
    name: "Set 2 - WARM v16: landfill tanpa sistem LFG",
    summary: "Membandingkan landfill tanpa sistem pengumpulan/pemulihan gas landfill dengan daur ulang material bekas.",
    baselineScenario: "Landfill tanpa sistem LFG - referensi AS (WARM v16)",
    alternativeScenario: "Daur ulang material bekas (WARM v16)",
    baselineDescription: "Material diasumsikan masuk landfill tanpa sistem pengendalian/pemulihan gas (No Recovery). Ini bukan skenario gas ditangkap lalu dibakar atau dimanfaatkan untuk energi.",
    alternativeDescription: "Material yang sama diasumsikan didaur ulang menggunakan faktor daur ulang WARM v16 yang sama dengan Set 1.",
    assumptions: "Referensi Amerika Serikat; skenario landfill No Recovery; listrik dan kelembapan rata-rata nasional; jarak transportasi default 20 mil untuk kedua jalur; faktor dari Summary Data pada workbook asli.",
    whenToUse: "Untuk menguji asumsi tanpa sistem LFG atau analisis sensitivitas. Tidak otomatis mewakili TPA Indonesia; kesesuaian dengan fasilitas nyata perlu dibuktikan.",
    reference: WARM_PARAMETER_REFERENCE,
    factors: {
      pet: { sourceMaterial: "PET", baselineOriginal: 0.020254519141196047, alternativeOriginal: -1.0357206316437553, baselineCell: "F8", alternativeCell: "C8" },
      cardboard: { sourceMaterial: "Corrugated Containers", baselineOriginal: 1.6634715021436628, alternativeOriginal: -3.1353369086789917, baselineCell: "F9", alternativeCell: "C9" },
    },
  },
  {
    id: "places-id-pet-sanitary-20261024-r1",
    name: "Set 3 - PLACES Indonesia: landfill saniter (PET)",
    summary: "Membandingkan PET ke Sanitary Landfill dengan daur ulang mekanis dalam model PLACES untuk Indonesia. Set ini hanya menyediakan faktor PET.",
    baselineScenario: "Landfill saniter - Indonesia/PET (PLACES)",
    alternativeScenario: "Daur ulang mekanis PET - Indonesia (PLACES)",
    baselineDescription: "PET diasumsikan masuk Sanitary Landfill pada pilihan PLACES Indonesia. Landfill saniter tidak sama dengan TPA terbuka dan tidak otomatis menggambarkan semua TPA Indonesia.",
    alternativeDescription: "Massa PET yang sama diasumsikan dialihkan ke daur ulang mekanis. Nilai neto memasukkan pemrosesan, transportasi, dan manfaat produksi material baru yang dihindari, termasuk asumsi substitusi PET virgin 95%.",
    assumptions: "Indonesia/PET; PLACES TCI/SIMTech, metodologi SSEA Oktober 2025; faktor dampak Ecoinvent v3.9; transport lokal 20 km antara pengumpulan dan fasilitas; substitusi PET virgin 95%; reject daur ulang mengikuti campuran jalur Indonesia dalam model; baseline Sanitary Landfill dipilih eksplisit, bukan campuran Default EOL Fates.",
    whenToUse: "Untuk kajian PET Indonesia dengan skenario landfill saniter yang dinyatakan secara eksplisit. Jika lokasi adalah TPA terbuka, gunakan Set 4. Kondisi fasilitas dan penerimaan daur ulang tetap perlu dibuktikan. Jangan gunakan untuk kardus, tutup PP, atau semua plastik.",
    reference: placesParameterReference("Sanitary Landfill"),
    factors: {
      pet: { sourceMaterial: "PET", baselineOriginal: 95_579, alternativeOriginal: -2_497_533, baselineCell: "Initial impact", alternativeCell: "Recycling impact" },
    },
  },
  {
    id: "places-id-pet-open-dump-20261024-r1",
    name: "Set 4 - PLACES Indonesia: TPA terbuka (PET)",
    summary: "Membandingkan PET ke Open Dump dengan daur ulang mekanis dalam model PLACES untuk Indonesia. Set ini hanya menyediakan faktor PET.",
    baselineScenario: "TPA terbuka (Open Dump) - Indonesia/PET (PLACES)",
    alternativeScenario: "Daur ulang mekanis PET - Indonesia (PLACES)",
    baselineDescription: "PET diasumsikan masuk Open Dump atau TPA terbuka pada pilihan PLACES Indonesia. Ini bukan sanitary landfill dan bukan skenario Open Burning atau pembakaran terbuka.",
    alternativeDescription: "Massa PET yang sama diasumsikan dialihkan ke daur ulang mekanis, dengan faktor daur ulang PLACES Indonesia yang sama dengan Set 3.",
    assumptions: "Indonesia/PET; PLACES TCI/SIMTech, metodologi SSEA Oktober 2025; faktor dampak Ecoinvent v3.9; transport lokal 20 km antara pengumpulan dan fasilitas; substitusi PET virgin 95%; reject daur ulang mengikuti campuran jalur Indonesia dalam model; baseline Open Dump dipilih eksplisit, bukan campuran Default EOL Fates atau Open Burning.",
    whenToUse: "Untuk kajian PET Indonesia bila baseline yang diuji adalah TPA terbuka. Bukan klaim bahwa seluruh TPA Indonesia beroperasi demikian. Dokumentasikan asumsi lokasi; jangan memilih set hanya karena estimasinya lebih besar. Kardus tidak didukung.",
    reference: placesParameterReference("Open Dump"),
    factors: {
      pet: { sourceMaterial: "PET", baselineOriginal: 101_700, alternativeOriginal: -2_497_533, baselineCell: "Initial impact", alternativeCell: "Recycling impact" },
    },
  },
  {
    id: "warm16-drywall-us-average-r1",
    name: "Set 5 - WARM v16: drywall, landfill rata-rata AS",
    summary: "Membandingkan landfill rata-rata AS dan daur ulang papan gipsum berlapis kertas. Angka landfill lebih rendah dalam model ini, bukan rekomendasi pembuangan.",
    baselineScenario: "Landfill drywall - rata-rata nasional AS (WARM v16)",
    alternativeScenario: "Daur ulang drywall (WARM v16)",
    baselineDescription: "Model memasukkan penyimpanan karbon lapisan kertas dan mengasumsikan hasil metana drywall dapat diabaikan. Ini bukan CO2 yang diserap mineral gipsum.",
    alternativeDescription: "Daur ulang dimodelkan menjadi drywall baru (19%) dan penggunaan pertanian (81%). Faktor ini bukan pengukuran fasilitas setempat.",
    assumptions: "AS; drywall biasa setebal setengah inci dengan lapisan kertas; National Average landfill dan transport default 20 mil; Summary Data E53/C53. Bukan papan semen, gipsum murni, atau semua puing. Risiko gas hidrogen sulfida (H2S) dan dampak non-GRK tidak menentukan peringkat angka CO2e ini.",
    whenToUse: "Untuk studi perbandingan emisi, bukan anjuran landfill. Periksa identitas bahan, kontaminasi, aturan, dan penerimaan fasilitas. Jangan memecah atau menangani puing berdebu/berbahaya untuk demo. Tidak ada faktor khusus Indonesia yang diverifikasi.",
    reference: {
      ...WARM_PARAMETER_REFERENCE,
      locationNote: "Rujukan AS khusus papan gipsum berlapis kertas, bukan faktor Indonesia. Nilai landfill negatif memasukkan penyimpanan karbon kertas. Ada risiko H2S; hasil GRK lebih rendah bukan rekomendasi lingkungan menyeluruh.",
      links: [
        { label: "US EPA WARM v16 - workbook resmi", url: WARM_REFERENCE.workbookUrl },
        { label: "Metodologi drywall: Exhibit 6-5, 6-17 dan batasan", url: "https://www.epa.gov/system/files/documents/2023-12/warm_construction_materials_v16_dec.pdf#page=55" },
        { label: "Metode dan batasan resmi EPA", url: WARM_REFERENCE.explanationUrl },
      ],
    },
    factors: {
      drywall: { sourceMaterial: "Drywall", baselineOriginal: -0.061041329359337294, alternativeOriginal: 0.02608665626869755, baselineCell: "E53", alternativeCell: "C53" },
    },
  },
];

export function isParameterSetId(value: unknown): value is ParameterSetId {
  return typeof value === "string" && PARAMETER_SETS.some((set) => set.id === value);
}

export function parameterSetsForMaterial(material: Material): EmissionParameterSet[] {
  if (!isMaterial(material)) throw new ValidationError("Material parameter set tidak dikenal.");
  const preferred = DEFAULT_PARAMETER_SET_IDS[material];
  return PARAMETER_SETS.filter((set) => set.factors[material] !== undefined)
    .sort((left, right) => Number(right.id === preferred) - Number(left.id === preferred));
}

export function getParameterSet(id: string): EmissionParameterSet {
  const definition = PARAMETER_SETS.find((set) => set.id === id);
  if (!definition) throw new ValidationError("Parameter set tidak dikenal.");
  return definition;
}

function normalizeReferenceFactor(value: number, co2eUnitKg: number, materialQuantityKg: number): number {
  if (!Number.isFinite(value)) throw new ValidationError("Faktor rujukan tidak valid.");
  const normalized = value * co2eUnitKg / materialQuantityKg;
  if (!Number.isFinite(normalized)) throw new ValidationError("Faktor rujukan berada di luar rentang yang didukung.");
  return Number(normalized.toFixed(6));
}

export function normalizeWarmFactor(value: number): number {
  return normalizeReferenceFactor(value, 1000, WARM_REFERENCE.shortTonKg);
}

export function normalizeParameterFactor(id: ParameterSetId, value: number): number {
  const reference = getParameterSet(id).reference;
  return normalizeReferenceFactor(value, reference.co2eUnitKg, reference.materialQuantityKg);
}

export function parameterSetMaterialLabel(id: ParameterSetId): string {
  return MATERIALS.filter((material) => getParameterSet(id).factors[material] !== undefined)
    .map((material) => MATERIAL_LABELS[material]).join(" / ");
}

export function parameterFactorInputs(id: ParameterSetId, material: Material) {
  if (!isMaterial(material)) throw new ValidationError("Material parameter set tidak dikenal.");
  const definition = getParameterSet(id);
  const factors = definition.factors[material];
  if (factors === undefined) throw new ValidationError("Parameter set ini tidak menyediakan faktor untuk material yang dipilih.");
  return {
    baseline: String(normalizeParameterFactor(id, factors.baselineOriginal)),
    alternative: String(normalizeParameterFactor(id, factors.alternativeOriginal)),
    baselineScenario: definition.baselineScenario,
    alternativeScenario: definition.alternativeScenario,
    sourceTitle: `${definition.reference.title}; ${definition.reference.sourceLabel} ${factors.baselineCell}/${factors.alternativeCell}; ${factors.sourceMaterial}`,
    sourceUrl: definition.reference.sourceUrl,
    scope: `${definition.assumptions} ${definition.reference.snapshotSuffix}`,
  };
}
