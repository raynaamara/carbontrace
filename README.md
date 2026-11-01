# CarbonTrace

[English](#english) | [Bahasa Indonesia](#bahasa-indonesia)

## English

CarbonTrace records material data using a local AI model for PET bottles, cardboard, and paper-faced drywall, with human confirmation, manually entered weights, and documented emission factors. The classifier is trained on the supplied dataset. The active workflow has no fixture predictions, default weights, or invented carbon factors. Image classification does not verify chemical composition or material hazards.

### Running locally

Use Node.js 22.18 or later; Node.js 24 is recommended.

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173. The development server accepts local connections only.

```powershell
npm test
npm run build
npm run preview
```

The production-build preview is available at http://127.0.0.1:4173.

### Apache / cPanel shared hosting

Run `npm run build`, then upload the contents of the build directory directly to the domain or subdomain's Document Root. Do not upload the entire project or put the build inside an extra dist directory. The index page, favicon, assets directory, and models directory must be directly under the Document Root.

Vite copies the [Apache configuration](public/.htaccess) to `.htaccess` at the build root:

```apache
DirectoryIndex index.html
Options -Indexes
```

These directives select the index page and disable directory listings. The application uses URL hashes for navigation and does not require an SPA rewrite rule.

If the main address shows "Index of /" while opening index.html directly works, check that `.htaccess` is in the same Document Root. Enable hidden-file or dotfile visibility in cPanel File Manager. If a configuration already exists, merge the required directives without overwriting SSL or other rules. Include dotfiles in the upload archive and remove the public ZIP after extraction.

Install a valid SSL certificate for the subdomain before enforcing HTTP-to-HTTPS redirects. Image fingerprinting and uploaded-photo storage require HTTPS or localhost. Localhost, HTTP, and HTTPS have separate browser-storage origins; preserve the CSV and original photos before moving between addresses. Hosting serves the application and model files. Records and uploaded photos remain in the browser, not in a server database.

### Language selection

The **Bahasa / Language** selector offers **Bahasa Indonesia** by default and **English**. The preference is saved under `carbontrace.language.v1`. Switching languages does not reload the page, replace the photo, remove AI results, or reset weight and custom-parameter drafts.

- Navigation, labels, guidance, validation, storage and AI messages, dialogs, catalog entries, archives, and WARM/PLACES explanations have both language variants.
- Numbers, percentages, and dates use `id-ID` or `en-US`. Decimal input accepts a comma or a period, without thousands separators.
- Material and sample IDs, numeric data, model weights, inference metadata, and saved factor snapshots do not change. Versioned r1 reference names remain canonical in storage; localization affects presentation.
- Reference defaults in Emission parameters, including scenario names, source title, and system scope, follow the interface language when loaded into Custom parameters. A language change updates only unedited defaults. User-written text, deliberately cleared fields, numeric inputs, and draft URLs are preserved. Saved custom text is not translated merely because it resembles a preset.
- User-authored text and source documents are not automatically translated. CSV exports retain their column codes, canonical names, and sources. Technical browser or library messages outside the application's translations retain their original details within the localized error context.
- Downloadable Word and Markdown guides remain in Indonesian; English download labels identify that language. The training-report JSON remains original source data.
- Preference-read failures are reported and use Indonesian without overwriting data. If a new language preference cannot be saved, the previous language remains active and the error is shown.

### Theme colours

The **Theme colour** selector offers five light themes: **Green** by default, **Blue**, **Purple**, **Teal**, and **Orange**. Themes change accents, backgrounds, text, borders, and focus indicators. Warning/error colours and material distinctions retain their meanings.

The preference is stored separately under `carbontrace.theme.v1`. Changing a theme does not reload the page or alter language, photos, drafts, AI results, records, or emission parameters. Browser theme metadata follows the selected palette. Invalid or unreadable preferences produce an explicit error and use green without overwriting storage. If saving fails, the previous theme remains active.

Additional palettes have complete colour tokens and contrast tests, including at least 4.5:1 contrast for white text on primary buttons, plus text, link, and focus-indicator checks. Existing green values remain fallbacks. These checks are not a full accessibility audit.

### Navigation and guided workflow

The menu displays one view at a time instead of scrolling through a single long page. Existing URL hashes remain available for deep links:

| View | Purpose |
|---|---|
| Overview (`#overview`) | Introduces the problem and purpose, invites photo analysis, and shows the four-step flow, statistics, and mass composition. |
| Record material (`#workspace`) | Four recording steps: Photo & AI, Material & weight, Review estimate, and Save. |
| History & exports (`#records`) | Review, search/filter, edit, delete, and export active records; demonstration archives remain separate. |
| Emission parameters (`#factor-settings`) | Select/apply references or open Custom parameters (advanced). |
| Guide & AI testing (`#methodology`) | Short guidance, an upload shortcut to Record material, model/data reports, methods, and claim boundaries. |

Overview explains why material and weight records are needed to compare landfill and recycling estimates. **Try a photo** opens the existing recording workflow; **See how it works** opens Guide & AI testing. Both catalog and user uploads remain available. Opening the workflow neither clears a draft nor saves a record automatically. The introduction supports both languages and all five themes without claiming verified emission reductions.

**How to use CarbonTrace** appears before the statistics. Four connected cards follow the recording steps, with icons and short explanations. Labels distinguish optional AI, required material/weight checks, optional estimates, and local persistence after Save. The flow is informational and does not bypass validation. Cards run horizontally on wide screens and stack vertically with downward arrows on small screens. Native HTML/SVG follows language and theme without an added diagram dependency. Active parameter status and its settings link remain available.

Guide cards separate their content and actions with consistent spacing. Desktop cards have aligned heights and action groups; mobile cards stack with full-width buttons. The desktop sidebar can scroll when the screen is too short for its contents.

#### Interaction cues

Editable fields, selectors, secondary buttons, and expandable sections have clearer boundaries and focus indicators in all themes. **Required** labels identify uploads, material confirmation, weight, and fields needed to save custom factors. **Optional** identifies additional choices, and **Automatic** marks the read-only sample ID. An existing image is labelled **Photo ready**, so reopening a record does not require another upload. These are interaction and accessibility cues, not new validation rules.

Parameter actions appear in **Your action**. Status distinguishes a reference that has not been applied from one already active; selection alone does not change preferences. Parameters remain optional for recording material. History filters have persistent labels, and expandable sections have `+`/`-` indicators and keyboard support. Required labels apply to their particular workflow, not to every setting before recording can begin.

#### Recording a material

1. Open **Record material**, then **Photo & AI**. Choose **Choose from catalog** or **Upload your own photo**. The catalog groups 78 training photos and 54 test-menu photos: 42 formal evaluation photos and 12 exploratory CT examples. The CT photos do not contribute to formal metrics. Uploaded photos receive `UPL-<UUID>` IDs and do not automatically enter the dataset.
2. AI analysis is optional. Select **Analyse photo** when needed. Once inference starts, wait for its result before continuing. **Use suggestion after inspection** explicitly confirms the suggestion and opens Material & weight. If the model fails, continue with a manual check, without a substitute prediction.
3. In **Material & weight**, confirm or correct the material and enter a positive weight in grams. Both are required, and there is no default weight. Validation prevents progression and focuses the relevant field when an input is invalid.
4. Human confirmation applies missing defaults: **WARM Set 1 for PET/cardboard and Set 5 for drywall**. Inference alone does not apply factors. Existing custom, preset, and legacy choices are preserved. These US defaults do not verify Indonesian conditions or a particular facility.
5. In **Review estimate**, inspect the source and use **Choose / change parameters** if needed. The confirmed material is carried into this view without another selection. Only supported references are shown, with the default first and Custom parameters last. Applying a set changes that material only; other factors and historical snapshots remain intact. Standalone settings retain the material selector. Disable **Calculate an emission estimate for this record** to save without factors or CO2e values while retaining factor preferences. Missing estimates are not zero.
6. In **Save**, review the summary and select **Save record**. Before this explicit action, the draft is not a persisted record. Success identifies the saved sample and offers History or the next photo.
7. Use **History & exports** to inspect AI/source metadata or edit a record. **Edit** opens Material & weight. Filters affect presentation only; **Export all records (CSV)** includes every active record, not just filtered results.

Back navigation and menu changes preserve the draft while the page stays open. Changing photos with unsaved edits requests confirmation; cancelling retains the previous photo and inputs. Drafts are not automatically restored after closing or reloading the page. Language and theme changes preserve the active step and draft.

Catalog labels use **ID / material name**, with no extra number in the description, such as `CT-007 / PET bottle`. Within the training/test groups, photos are alphabetized by their full filenames, not material or numeric suffix. CT files precede SYN files; `CT-009_01.png` and `CT-012_01.png` precede `SYN-DRYWALL-008.png`. Language and saved-record status do not change this ordering.

Photo descriptions follow a common pattern: reference material, dataset role, verification status, and material-specific inspection guidance. Exploratory roles remain outside training/evaluation and are not suffixes on the displayed name. History, alt text, and archives share the display naming. Canonical and former names remain searchable; CSV names, IDs, snapshots, dataset assignments, and model weights are unchanged.

Saving the same sample ID updates its record without increasing the count. Reopened analyses are labelled historical; rerun analysis if the photo changes. **Record without AI results** removes the analysis from the form before saving.

**Upload your own photo** belongs to Photo & AI. JPG, PNG, and WebP files are checked for format and content, with limits of 10 MB and 24 megapixels. The application prepares a JPEG with a longest side of at most 1024 pixels. Preview, inference, and persisted photo use that same copy; the original device file is unchanged.

Uploads follow the same material-confirmation, weight, estimate, and Save workflow. Uploading or analysing alone does not persist a photo or record. Photos can be recorded without AI. For a classification-only experiment, do not press Save. Guide & AI testing points to this workflow rather than a separate upload form.

**Edit** restores the stored image and ID, including after reload. Weight/material changes update the same ID; uploading another image creates a new ID to keep historical images and inferences distinct. Deleting an uploaded-photo record also deletes its browser-held copy, not the original device file. Uploads and corrections do not automatically retrain the model or become training/evaluation data.

Model-load failures are shown with **Reload model** available. Manual recording remains usable without replacement predictions. Analysis and RGB fingerprints require HTTPS or localhost.

#### Interpreting estimates

Review estimate and Save use the same factors and mass as the preview. A positive difference means the alternative has a lower modeled impact; a negative difference means the baseline is lower. Negative net scenario values are explained separately because they may include avoided virgin-material production rather than CO2 physically absorbed by the item.

An exact zero indicates no modeled advantage. Nonzero values that round to zero at six decimals receive a separate explanation; they are not treated as equal or as automatic reasons to recycle. Incomplete inputs, unsupported factors, or invalid calculations do not produce an emission conclusion.

WARM/PLACES recycling suggestions remain conditional on local facility acceptance and applicable conditions. Custom parameters require checking scenarios, facilities, and source scope. These explanations do not alter factors, formulas, validation, snapshots, CSV structure, or the AI model. Saving a record does not establish emission reductions or carbon credits.

#### History insights

History & exports summarizes the records currently displayed after search/filter, not the complete catalog or demonstration archive. Insights cover recorded mass, material composition, saved-factor coverage, and saved AI suggestions/category corrections. User agreement is not model accuracy; mass and material remain user-reported.

Comparisons use saved factor snapshots, not current preferences. Groups distinguish material, numeric factors, scenario names, source title/URL, scope, and reference identity. Application time alone does not split identical calculation bases. A single group can provide a direct conclusion; incompatible groups remain separate, without a cross-basis CO2e grand total. Opening source details does not modify records.

Reference details use one full-width card per group, stacked vertically at every viewport. Cards separate material/reference, record count and mass, comparison, next action, scenarios, and source assumptions. Built-in explanations use plain-language paragraphs while retaining numbers, units, scope, and methodological limits. Custom or legacy scope text is shown literally. Original metadata and research exports are not rewritten.

**Show records without factors** changes only the estimate-availability filter, preserving search and material selection. To add an estimate to an old record, use Edit, choose a suitable reference, and explicitly resave. CSV exports still include all active records. Table and insight differences use six decimals while stored/exported numbers remain unchanged. Tiny nonzero differences are distinguished from exact equality; load or summary failures produce explicit unavailable/error states.

### Model and dataset

- One formal dataset contains **120 photos**, 40 each under `SYN-PET`, `SYN-CRD`, and `SYN-DRYWALL`, suffixes 001-040. CT-001 through CT-012 are exploratory, making **132 catalog photos**. CT images are outside training, formal metrics, and the confusion matrix.
- On 26 October 2026, the supplied drywall photos and CT-009 through CT-012 were declared to show real, distinct paper-faced gypsum-board objects. Origin, material labels, object independence, and absence of contamination are not independently verified. `SYN` is an ID prefix, not evidence of authenticity.
- **Training uses 78 source photos, 26 per class.** All 52 PET/cardboard training assignments were retained. Drywall IDs are ranked by SHA-256 of `20261026:<ID>`; the first 26 enter training and the other 14 enter evaluation. Assignments and hashes were frozen before one fitting run, without evaluation-driven tuning or reshuffling.
- **The evaluation set has 42 photos, 14 per class.** Its 28 PET/cardboard photos had been evaluated previously and serve as regression checks. The 14 drywall photos were first-time holdouts at this model update. They remain parts of the same formal dataset; the combined evidence is not 42 entirely new tests.
- The first-time drywall portion alone lacks PET/cardboard reference cases and cannot establish all-class precision or discrimination. The combined matrix is balanced but mixes first-time and previously evaluated evidence.
- Several images share similar backgrounds. Different hashes do not establish independent objects or scenes. This internal convenience collection is not an external or randomly sampled real-world evaluation.
- Four variants per training photo, original, horizontal flip, and brightness x0.9/x1.1, produce **312 feature vectors**, not 312 independent physical objects. Original and JPEG hashes are checked for exact duplicates.
- Frozen MobileNetV1 0.25 supplies 256 features through `conv_pw_13_relu`, global average pooling, and L2 normalization. The three-class softmax head has **771 trainable parameters** and runs for 200 epochs. Initializer seed 20261024, learning rate 0.03, kernel L2 0.001, full batch 312, and shuffle false are retained. There is no separate validation set or holdout-based tuning.
- The active model is **`ct-mobilenet-913cfe5aa706`**. All **42/42** predictions match their supplied labels, with matrix diagonal 14/14/14. The first-time/regression portions are 14/14 and 28/28. This is not universal accuracy or 42 new independent trials.
- Report scores come from the evaluation script. Each browser inference computes its own scores from decoded pixels; it does not copy the report.
- The browser reads natural-dimension JPEG pixels through a canvas rather than the CSS preview size. Changing viewport width preserves input dimensions, scores, and RGB digests for the same image in the same browser. Decoder differences between runtimes can still differ from Node.js results. Historical analyses are not automatically recalculated.
- The classifier compares only three classes. Cement board or unrelated inputs can receive incorrect high scores. Softmax outputs are not calibrated probabilities, material-composition checks, or hazard assessments.
- The interface labels an individual result **Photo score**, separately from labeled-photo accuracy. Users still check material and weight. Do not break or handle hazardous debris for demonstrations.

Artifacts are in [public/models](public/models). The [active report](public/models/carbontrace/report.json) uses schema v3, explicit `pet/cardboard/drywall` label order, data/weight hashes, all IDs, split assignments, hyperparameters, and image-level results. Its `new-holdout` field contains drywall; `previous-test` identifies PET/cardboard regressions. Model versions follow the head-weight hash.

The head loads from the [active version directory](public/models/carbontrace/ct-mobilenet-913cfe5aa706). The [80-photo version](public/models/carbontrace/ct-mobilenet-414f2c4df422), [40-photo version](public/models/carbontrace/ct-mobilenet-b090d45c6b58), and [initial version](public/models/carbontrace/ct-mobilenet-4aa1cd74741b) remain archived. Earlier two-class analyses retain their original two scores and version, without invented drywall outputs. Earlier factor settings receive an empty drywall slot in memory without automatic storage rewriting.

Training prepares and validates a candidate in cache, then publishes the version directory before atomically replacing the active report. Failure before publication leaves the active head intact. Publication rejects concurrent report changes or conflicting artifacts with the same version.

#### Retraining locally

```powershell
.\scripts\prepare-sample-photos.ps1
npm run train
npm test
npm run build
```

Training uses TensorFlow.js CPU without an external classifier service or native `tfjs-node`. The public MobileNet checkpoint is downloaded and cached when first needed. User images are not sent to the checkpoint source. Exported models and weights load from the application's own origin; inference does not fetch a model from a CDN.

Reload the page after retraining. The model directory retains the checkpoint source and Apache-2.0 license. The backbone comes from the [TensorFlow.js MobileNet checkpoint](https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json), using feature extraction similar to the [TensorFlow.js transfer-learning example](https://github.com/tensorflow/tfjs-examples/tree/master/webcam-transfer-learning).

### Factors and sources

- App load does not silently fill factors. Missing defaults are applied only after explicit material confirmation. Existing custom/preset choices remain. Estimate opt-out affects that draft/record; old records without factors stay opted out unless the user enables estimation.
- **Set 1:** EPA WARM v16, US-average landfill versus recycling.
- **Set 2:** WARM v16, landfill without gas collection/recovery, No Recovery, versus recycling. It is not captured-gas flaring or energy use.
- **Set 3:** TCI/SIMTech PLACES Indonesia/PET, Sanitary Landfill versus mechanical recycling. Factors are `0.095579` and `-2.497533` kg CO2e/kg PET.
- **Set 4:** PLACES Indonesia/PET, Open Dump versus mechanical recycling. Factors are `0.101700` and `-2.497533`. Open Dump is not Open Burning.
- Sets 3/4 support PET, Sets 1/2 support PET/cardboard, and Set 5 supports drywall. Material-filtered lists show defaults first. Applying a reference changes only that material, so PET PLACES, cardboard WARM, and drywall WARM can coexist with distinct source identities. Historical records change only after explicit edit/resave.
- **Set 5**, `warm16-drywall-us-average-r1`, uses **E53/C53**, with factors **-0.067287 / +0.028756 kg CO2e/kg** and a 1 kg difference of **-0.096043** using the six-decimal application coefficients. Negative landfill values include paper-facing carbon storage, not CO2 absorption by gypsum. Lower GHG is not landfill advice; H2S risk, contamination, local rules, and facility acceptance remain relevant. Scope is regular paper-faced drywall, not cement board or mixed debris. No Indonesian site-specific drywall factor has been verified.
- **Custom parameters** are user-entered and stored per material. Editing preset numbers creates custom status rather than retaining preset identity.
- Each reference has assumptions, intended use, factor tables, source locations, and links to EPA workbooks or PLACES source queries/methodology.
- Sets 1/2 use US assumptions. Sets 3/4 use an Indonesian model context, not official government factors or verified facility measurements. Local applicability and actual treatment are unverified.
- Factor units are **kg CO2e/kg material** and must match the source and recorded scenarios.
- WARM factors are converted from MTCO2e/US short ton using `x 1000 / 907.18474`, then rounded to six decimals. Source cells are E8/C8 and E9/C9 for Set 1; F8/C8 and F9/C9 for Set 2.
- PLACES values come from **GHG emissions - Details**, using Indonesia/PET queries for 1,000,000 metric tonnes checked on 24 October 2026. Sanitary Landfill source impacts are 95,579 / -2,497,533 tonnes CO2e; Open Dump uses 101,700 / -2,497,533. Dividing each by 1,000,000 gives kg CO2e/kg. This large query reduces display-rounding effects; it is not a project sample mass or six-decimal physical accuracy. One-ton queries were also checked, with displayed differences `2.59` and `2.60 tonnes CO2e`.
- PLACES uses downstream waste-management boundaries, Ecoinvent v3.9 impacts, 20 km local Indonesian transport, 95% virgin-PET substitution, and model-specific reject pathways. The SSEA methodology was updated in October 2025; access dates are not the collection year of all source data. WARM and PLACES differ methodologically, so differences do not isolate geography.
- Zero is valid. Negative net factors are allowed when supported by their documented source.
- Formula: `massa_g / 1000 * (faktor_awal - faktor_alternatif)`. Negative differences are not converted into positive savings.
- WARM/PLACES baselines assume landfill/disposal conditions and alternatives assume recycling of the same mass. Net values may include avoided virgin production and, in WARM, carbon storage. They are not direct gas measurements.
- Source and scope are required. Saving a title or link does not mean the application verified its method.
- Each estimated record snapshots its factors, source, scope, date, set ID, and set name. Changing/clearing preferences does not rewrite history. Versioned r1 presets retain immutable reference identity; their numbers cannot be edited while keeping preset identity.
- Summaries distinguish missing estimates from valid zero results and show factor coverage. Incompatible material/reference bases remain separate; there is no cross-basis CO2e total.

Original numbers, conversions, assumptions, use cases, and references are documented in the [Emission parameter guide](src/assets/guides/Parameter-Set-Emisi.md). Indonesian Markdown and Word guides are bundled as application assets and downloadable from Emission parameters.

### Storage and demonstration archives

Earlier demonstration records are preserved rather than promoted to actual-use data. `carbontrace.demo.v1` data are copied to the demonstration archive in `carbontrace.records.v2`; the original key remains intact. Active summaries exclude the archive. Earlier manual records are readable without invented AI scores.

Active records and archives use localStorage key `carbontrace.records.v2`. Catalog records remain compatible. Uploads add optional photo metadata: ID, original filename, dimensions, size, JPEG hash, and upload time. JPEG Blobs use IndexedDB database `carbontrace.photos.v1`, object store `photos`, not Base64 in localStorage. Current-model analyses retain three scores, model version, RGB fingerprint, and analysis time; legacy analyses keep their original score fields. Factor preferences use `carbontrace.factors.v1`. Storage belongs to the browser and origin, with no account or server synchronization.

Photo persistence waits for IndexedDB completion before writing record metadata. Metadata failure rolls back a newly stored image; rollback errors are reported. Missing images and hash mismatches are explicit failures, not successful-save fallbacks. Catalog recording remains available without upload-storage access.

Format, permission, and storage-capacity errors are explicit. Photo capacity follows browser quotas and is not unlimited. Failed reads are not automatically overwritten, and failed writes are not reported as success. After resolving storage problems, use **Reload storage**. Clearing site data can remove records and photos. Keep CSV and original photos separately because exports omit image files.

### Sample photos

Originals are in [src/assets/samples](src/assets/samples): 12 CT photos and 40 each under `SYN-PET`, `SYN-CRD`, and `SYN-DRYWALL`. Preparation scripts do not change original PNG contents or names.

Display, training, and thumbnails use JPEGs in [src/assets/samples/optimized](src/assets/samples/optimized), named `<ID>_01.jpg`, at most 1024 pixels and quality 85. The 132 JPEGs total 24,419,473 bytes, approximately 23.29 MiB. Each file is below 512 KiB; the test's aggregate limit is 30 MiB.

To regenerate copies after changing source photos, run PowerShell on Windows:

```powershell
.\scripts\prepare-sample-photos.ps1
```

The script preserves aspect ratios, validates display-size limits, and checks that original hashes do not change. Tests also check mapping and existence for every image. Missing or unloadable images produce visible errors without silent illustration fallbacks.

**User-provided photo** identifies the declared file origin, not authenticated material or photo content. Labels for the 120 formal photos are internal references; record material still requires human confirmation.

The companion 132-photo example-weight workbook is kept locally, outside this repository. It follows the application's 78 training and 54 test-menu photos, with per-ID thumbnails and links. Previous 88-photo values are retained. The 44 drywall catalog examples use an assumed 1,000 g per target group, not an image-derived or measured weight. Measured-mass cells remain empty. Example weights do not train the classifier or count as paper observations. The earlier 88-photo and 48-photo workbooks are also kept locally as archives.

Catalog display photos are published with a deployed application. Check that they contain no addresses, phone numbers, or other private information before publication.

### Limitations to retain

- Weights are user-reported. The application neither weighs objects nor independently verifies mass.
- Inference uses saved trained weights. Model/image failures are reported, not replaced with fixture results.
- The 42-photo evaluation includes 14 first-time drywall tests and 28 previously evaluated PET/cardboard regressions. It does not establish 42 new independent tests or performance in all conditions. All-class independent evaluation needs checked labels and varied scenes. Photo counts do not establish physical-object counts.
- Factors are documented reference-model values or sourced user inputs, not official factors certified by the application.
- Human confirmation does not verify treatment or emission reductions.
- Actual recycling, additionality, carbon-credit issuance, trading value, and registry integration are not demonstrated.
- Photos, material identity, physical weights, factor applicability, and actual treatment have not been independently audited.

### Exports

Active CSV keeps the initial 24 columns and six AI metadata fields, followed by `factor_parameter_set_id` and `factor_parameter_set_name`, for **32 columns**. Methods are `MANUAL` or `AI_ASSISTED_HUMAN_CONFIRMED`; AI status is `NOT_ANALYZED` or `MODEL_INFERENCE_RECORDED`, not a claim that every record was analysed.

The six AI columns are `ai_predicted_material`, `ai_score_not_accuracy`, `ai_model_version`, `ai_input_rgb_sha256`, `ai_analyzed_at`, and `ai_human_correction`. RGB fingerprints hash decoded dimensions and pixels, not the original PNG file, and do not authenticate photos.

Weight status remains `USER_REPORTED_NOT_VERIFIED`. Factor columns contain the saved source snapshot, and missing factors leave estimates blank. Custom factors are `USER_SUPPLIED_NOT_VERIFIED`; WARM/PLACES presets are `REFERENCE_MODEL_NOT_SITE_VERIFIED`. Legacy factors without set metadata remain custom, without automatic preset promotion.

For uploads, `sample_name` is the original filename, `current_sample_image_file` is `<UPL-ID>.jpg`, and `current_sample_image_source` is `USER_UPLOADED_UNVERIFIED`. Catalog sources remain `USER_PROVIDED_UNVERIFIED`. CSV contains no photo Blobs. JPEG-file hashes and decoded-RGB hashes are distinct, and neither verifies physical authenticity.

Archives export in the earlier format with explicit demonstration status and never mix into active CSV. Catalog-image fields describe the catalog at export time, not proof of the historical photo. Image-content, treatment, and credit-issuance verification stay `NO`.

The [Word usage guide](src/assets/guides/CarbonTrace-Skenario-dan-Panduan-Penggunaan.docx) is available in Indonesian as a bundled application asset.

The research paper is available as the [v2 submission PDF](<docs/CarbonTrace-GENIUS-AI-Research-Paper v2.pdf>). It uses model `ct-mobilenet-913cfe5aa706` and a single 42-photo matrix, with first-time/regression history documented as a limitation. Factor guidance follows per-material defaults and optional estimation. The exploratory CT-009 failure remains outside formal accuracy. Excel weights remain examples. Deploy the current build before submission so the hosted model-report links match.

### Repository contents

The repository includes only the v2 submission PDF under `docs`. Additional local documents and deployment packages are excluded from Git. The two guides required by the application are included under [src/assets/guides](src/assets/guides), so a fresh clone can build the application and retain both download options. Excluded files remain on the author's computer; they are not inputs required for training or building this repository.

### Further development

Collect varied objects and scenes, independently check labels and photo relationships, and evaluate unsupported inputs. Independent evidence is needed before broad accuracy/generalization claims. AI and interface descriptions must match tested capabilities. Hardware integration remains optional.

## Bahasa Indonesia

Aplikasi analisis dan pencatatan material dengan model AI lokal untuk botol PET, kardus, dan papan gipsum berlapis kertas (drywall), konfirmasi pengguna, berat manual, dan faktor emisi bersumber. Classifier dilatih pada dataset pengguna; tidak ada prediksi contoh, berat bawaan, atau faktor karbon buatan pada alur aktif. AI bukan identifikasi kimia atau pemeriksaan bahaya material.

### Menjalankan

Gunakan Node.js 22.18 atau lebih baru (direkomendasikan Node.js 24).

```powershell
npm install
npm run dev
```

Buka http://127.0.0.1:5173. Server hanya mendengarkan koneksi lokal.

```powershell
npm test
npm run build
npm run preview
```

Preview hasil build tersedia di http://127.0.0.1:4173.

### Shared hosting Apache / cPanel

Jalankan `npm run build`, lalu unggah seluruh isi folder hasil build ke Document Root domain/subdomain, bukan seluruh proyek atau satu folder tambahan bernama dist. Halaman utama, favicon, folder assets, dan folder models harus berada langsung di Document Root.

[Konfigurasi Apache](public/.htaccess) ikut disalin Vite menjadi `.htaccess` di akar hasil build:

```apache
DirectoryIndex index.html
Options -Indexes
```

Konfigurasi ini memilih halaman utama dan menonaktifkan daftar isi direktori. Menu aplikasi memakai hash URL, sehingga tidak memerlukan aturan rewrite SPA.

Jika alamat utama menampilkan "Index of /" tetapi akses langsung ke index.html berhasil, pastikan `.htaccess` tersebut berada di Document Root yang sama. Aktifkan tampilan hidden files/dotfiles pada File Manager cPanel. Jika server sudah memiliki `.htaccess`, gabungkan arahan yang diperlukan tanpa menimpa konfigurasi SSL atau aturan lain. Pastikan dotfile ikut masuk arsip unggahan; hapus arsip ZIP dari folder publik setelah ekstraksi.

Aktifkan sertifikat SSL yang valid untuk nama subdomain sebelum memaksakan pengalihan HTTP ke HTTPS. Analisis sidik foto serta penyimpanan unggahan memerlukan HTTPS atau localhost. Data browser pada localhost, HTTP, dan HTTPS berada pada origin berbeda; simpan CSV dan foto asli sebelum berpindah alamat. Hosting ini hanya menyajikan aplikasi/model; catatan dan foto unggahan tetap lokal pada browser, bukan database server.

### Pilihan bahasa

Pemilih **Bahasa / Language** di bagian atas menyediakan **Bahasa Indonesia** (bawaan) dan **English**. Pilihan disimpan pada browser dengan key `carbontrace.language.v1`. Bahasa berubah langsung tanpa memuat ulang halaman, mengganti foto, menghapus hasil AI, atau mengisi ulang draft berat dan parameter khusus.

- Navigasi, label, petunjuk, validasi, pesan penyimpanan/AI, dialog, katalog, arsip, dan penjelasan parameter WARM/PLACES memiliki tampilan kedua bahasa.
- Angka, persentase, dan tanggal menggunakan `id-ID` atau `en-US`. Input desimal tetap menerima koma maupun titik tanpa pemisah ribuan.
- ID material/sampel, nilai numerik, bobot model, metadata inferensi, dan snapshot faktor tidak berubah. Nama rujukan versi r1 tetap disimpan dalam bentuk kanonis; terjemahan hanya untuk tampilan.
- Pada Parameter emisi, isian bawaan dari rujukan (nama kedua skenario, judul sumber, serta konteks/batas sistem) mengikuti bahasa antarmuka, termasuk saat dimuat ke Parameter khusus. Pergantian bahasa hanya memperbarui isian bawaan yang belum diedit; teks yang diketik pengguna, isian kosong yang sengaja dihapus, angka, dan tautan draft tetap dipertahankan. Teks parameter khusus tersimpan tidak diterjemahkan berdasarkan kemiripannya dengan rujukan.
- Teks yang ditulis pengguna dan dokumen sumber tidak diterjemahkan otomatis. CSV mempertahankan kode kolom, nama, dan sumber aslinya agar data penelitian tetap konsisten. Pesan teknis browser/library yang tidak dimiliki aplikasi mempertahankan detail aslinya di dalam konteks pesan yang diterjemahkan.
- Panduan Word dan Markdown unduhan masih berbahasa Indonesia; label unduh pada antarmuka Inggris menyebutkan bahasanya. Laporan pelatihan JSON tetap merupakan data sumber asli.
- Kegagalan membaca preferensi ditampilkan dan memakai bahasa Indonesia tanpa menimpa data. Jika pilihan bahasa tidak dapat disimpan, bahasa sebelumnya tetap aktif dan kesalahannya diberitahukan.

### Warna tema

Pemilih **Warna tema / Theme colour** di bagian atas menyediakan lima tema terang: **Hijau / Green** (bawaan), **Biru / Blue**, **Ungu / Purple**, **Toska / Teal**, dan **Jingga / Orange**. Tema mengubah warna aksen, latar, teks, border, serta fokus kontrol secara konsisten. Warna semantik peringatan/kesalahan dan pembeda material tetap dipertahankan agar maknanya tidak berubah.

Preferensi disimpan terpisah pada `carbontrace.theme.v1`; mengganti tema tidak memuat ulang halaman atau mengubah bahasa, foto, draft, hasil AI, catatan, maupun parameter emisi. Warna metadata browser ikut menyesuaikan. Jika pembacaan preferensi gagal atau tidak valid, kesalahan ditampilkan dan hijau digunakan tanpa menimpa data. Jika penyimpanan gagal, tema sebelumnya tetap aktif.

Palet tambahan memiliki token lengkap dan tes kontras: teks putih tombol utama minimal 4,5:1, dengan pemeriksaan teks, tautan, dan indikator fokus. Nilai hijau lama menjadi fallback agar tampilan bawaan tetap terjaga; ini bukan klaim audit aksesibilitas menyeluruh.

### Menu dan alur terpandu

Menu sekarang membuka **satu tampilan pada satu waktu**, bukan menggulir seluruh halaman panjang. URL lama tetap digunakan agar deep link tetap bekerja:

| Menu | Fungsi |
|---|---|
| Ringkasan (`#overview`) | Pengantar masalah dan manfaat CarbonTrace, ajakan mencoba foto, diagram alur empat langkah, statistik, dan komposisi massa. |
| Catat material (`#workspace`) | Formulir empat langkah: Foto & AI, Material & berat, Tinjau estimasi, Simpan. |
| Riwayat & ekspor (`#records`) | Tinjau, cari/filter, ubah, hapus, dan ekspor seluruh catatan; arsip contoh terpisah. |
| Parameter emisi (`#factor-settings`) | Pilih/terapkan rujukan atau buka Parameter khusus (lanjutan). |
| Panduan & uji AI (`#methodology`) | Panduan singkat, pintasan unggah di Catat material, dataset/laporan model, serta metode dan batas klaim. |

Pengantar Ringkasan menjelaskan mengapa catatan material dan berat diperlukan untuk membandingkan estimasi emisi TPA dan daur ulang. Tombol **Coba dengan satu foto / Try a photo** membuka alur Catat material yang sudah ada, sedangkan **Lihat cara kerjanya / See how it works** membuka Panduan & uji AI. Foto katalog maupun unggahan sendiri tetap tersedia; membuka alur tidak menghapus draft atau menyimpan catatan otomatis. Pengantar tersedia dalam kedua bahasa dan kelima tema, tanpa mengubah batasan estimasi atau mengklaim pengurangan emisi yang sudah terbukti.

Diagram **Alur penggunaan CarbonTrace / How to use CarbonTrace** berada sebelum statistik. Empat kartu terhubung mengikuti urutan Foto & AI, Material & berat, Tinjau estimasi, dan Simpan; setiap kartu memiliki ikon dan penjelasan singkat. Penanda membedakan AI opsional, pemeriksaan/hasil timbang wajib, estimasi opsional, serta penyimpanan di browser setelah Simpan ditekan. Diagram bersifat informatif, bukan pintasan yang melewati validasi formulir. Pada layar lebar alur dibaca mendatar; pada layar sempit kartu tersusun vertikal dan panah mengarah ke bawah. Diagram memakai HTML/SVG yang mengikuti bahasa dan tema aplikasi tanpa dependensi diagram tambahan. Status parameter aktif dan tautan pengaturannya tetap tersedia.

Kartu panduan memisahkan isi dan kelompok tombol dengan jarak yang konsisten. Pada desktop, tinggi kartu dan posisi kelompok tombol sejajar; pada ponsel, kartu tersusun vertikal dan tombol memenuhi lebar kartu. Sidebar desktop dapat digulir jika tinggi layar tidak cukup untuk seluruh isinya.

#### Penanda interaksi

Isian yang dapat diedit, daftar pilihan, tombol sekunder, serta bagian yang dapat dibuka memiliki batas dan penanda fokus yang lebih tegas pada kelima tema. Label **Wajib / Required** menandai foto unggahan, konfirmasi material, berat, dan isian yang diperlukan untuk menyimpan faktor khusus; label **Opsional / Optional** menandai pilihan tambahan. **Otomatis / Automatic** menandai ID sampel yang hanya dapat dibaca. Foto yang sudah tersedia ditandai **Foto siap / Photo ready**; membuka ulang catatan tidak mengharuskan unggah ulang. Ini penjelasan visual dan aksesibilitas, bukan perubahan aturan validasi.

Pilihan parameter berada dalam panel **Tindakan Anda / Your action**. Status membedakan rujukan yang **belum diterapkan** dari set yang **sudah aktif**; memilih saja tetap tidak mengubah pengaturan. Parameter masih opsional untuk pencatatan material. Filter riwayat memiliki label yang selalu terlihat, dan bagian yang dapat dibuka memakai penanda `+`/`-` serta tetap mendukung keyboard. Label Wajib berlaku pada alur terkait, bukan berarti semua pengaturan wajib diisi sebelum mulai mencatat.

#### Cara mencatat

1. Buka **Catat material**, langkah **Foto & AI**. Pilih **Pilih dari katalog** atau **Unggah foto sendiri**. Katalog berisi **Dataset training** (78 foto) dan **Dataset test** (54 foto: 42 evaluasi formal dan 12 CT eksplorasi). CT bukan bagian skor evaluasi. Unggahan sendiri memperoleh ID `UPL-<UUID>` dan tidak menambah dataset otomatis.
2. Analisis AI **opsional**. Klik **Analisis foto** bila dibutuhkan; setelah analisis dimulai, tunggu hasilnya sebelum melanjutkan agar tidak menyimpan di tengah inferensi. **Gunakan saran setelah diperiksa** merupakan tindakan eksplisit dan membawa pengguna ke langkah material/berat. Jika model gagal, lanjutkan pemeriksaan manual tanpa prediksi pengganti.
3. Pada **Material & berat**, konfirmasikan/koreksi bahan dan isi hasil timbang positif dalam gram. Keduanya wajib; tidak ada berat bawaan. Kesalahan menghentikan kemajuan dan mengarahkan fokus ke isian terkait.
4. Setelah material dikonfirmasi pengguna, faktor yang belum ada diisi default: **WARM Set 1 untuk PET/kardus, Set 5 untuk drywall**. Hasil AI saja tidak menerapkan faktor. Pilihan tersimpan, termasuk parameter khusus dan data lama, tidak ditimpa. Default memakai asumsi AS, bukan faktor Indonesia atau bukti kondisi fasilitas.
5. Pada **Tinjau estimasi**, periksa sumber dan gunakan **Pilih / ubah parameter** bila diperlukan. Material mengikuti konfirmasi dan tidak dipilih ulang. Daftar hanya memuat rujukan yang mendukungnya, default di atas dan Parameter khusus terakhir. **Terapkan set** mengganti material tersebut saja, tanpa menghapus faktor material lain atau snapshot riwayat. Pengaturan umum tetap memiliki pemilih material. Matikan **Hitung estimasi emisi untuk catatan ini** untuk menyimpan material/berat tanpa faktor pada record; preferensi faktor tetap tersimpan dan CO2e kosong, bukan nol.
6. Pada **Simpan**, periksa ringkasan dan tekan **Simpan catatan**. Sebelum tombol ini ditekan, draft belum menjadi catatan. Keberhasilan menampilkan ID dan pilihan melihat riwayat atau memilih sampel berikutnya.
7. Gunakan **Riwayat & ekspor** untuk memeriksa metadata AI/sumber atau mengubah catatan. **Ubah** membuka langkah material/berat. Filter hanya memengaruhi tampilan; **Ekspor semua catatan (CSV)** mencakup seluruh catatan aktif, bukan hanya hasil filter.

Tombol Kembali dan perpindahan menu mempertahankan draft selama halaman tetap dibuka. Mengganti sampel ketika ada perubahan belum tersimpan meminta konfirmasi; batal mempertahankan foto dan input sebelumnya. Draft tidak disimpan otomatis untuk pemulihan setelah memuat ulang/menutup halaman. Bahasa dan tema tidak mengubah langkah aktif atau isi draft.

Label katalog memakai format **ID / nama material**, tanpa angka tambahan pada deskripsi, misalnya `CT-007 / Botol PET` atau `CT-007 / PET bottle`. Dalam masing-masing kelompok training/test, foto diurutkan alfabetis menurut nama file lengkap, bukan material atau nomor suffix. File CT tetap berurutan sebelum file SYN; `CT-009_01.png` dan `CT-012_01.png` mendahului `SYN-DRYWALL-008.png`. Urutan tidak berubah karena bahasa atau status tercatat.

Keterangan foto memakai pola yang sama: material referensi, peran data, status verifikasi, serta petunjuk pemeriksaan sesuai material. Peran eksplorasi tetap dinyatakan di luar pelatihan/evaluasi, tanpa menjadi akhiran nama. Riwayat, teks alternatif foto dan arsip memakai nama tampilan yang seragam. Nama kanonis dan nama lama tetap dapat dicari; nama pada CSV penelitian, ID, snapshot, pembagian dataset dan bobot model tidak diubah.

ID sampel yang sama diperbarui tanpa menambah hitungan. Hasil analisis tersimpan diberi label sebagai hasil historis ketika dibuka lagi; jalankan ulang bila foto berubah. **Catat tanpa hasil AI** melepaskan analisis dari formulir sebelum menyimpan.

**Unggah foto sendiri** berada langsung di langkah **Foto & AI**. JPG, PNG, atau WebP maksimal 10 MB dan 24 megapiksel diperiksa format dan isinya, lalu dibuatkan salinan JPEG dengan sisi terpanjang maksimal 1024 piksel. Pratinjau, inferensi, dan foto tersimpan memakai salinan yang sama. Foto asli di perangkat tidak diubah.

Unggahan dapat mengikuti seluruh alur pencatatan, termasuk pemeriksaan material, berat manual, estimasi, dan **Simpan catatan**. Unggah dan analisis saja belum menyimpan foto atau catatan secara persisten. Foto dapat dipakai tanpa AI; jika hanya ingin menguji klasifikasi, jangan tekan Simpan catatan. **Panduan & uji AI** menyediakan pintasan ke alur yang sama, bukan formulir unggahan terpisah.

**Ubah** dari riwayat membuka kembali foto dan ID yang tersimpan, termasuk setelah halaman dimuat ulang. Mengubah berat/material memperbarui ID yang sama; mengunggah foto lain membuat ID baru agar foto dan inferensi historis tidak tertukar. Menghapus catatan unggahan juga menghapus salinan fotonya dari browser, bukan file asli pada perangkat. Unggahan dan koreksi tidak melatih ulang model atau menjadi data latih/uji otomatis.

Jika model gagal dimuat, kesalahan ditampilkan dan **Muat ulang model** tersedia. Pencatatan manual tetap berjalan, tanpa prediksi pengganti. Analisis dan sidik piksel membutuhkan HTTPS atau localhost.

#### Membaca hasil estimasi

Langkah **Tinjau estimasi** dan **Simpan** menampilkan kesimpulan dari faktor aktif dan berat yang sama dengan angka pratinjau. Selisih positif berarti alternatif diperkirakan lebih rendah; selisih negatif berarti skenario awal lebih rendah. Nilai neto skenario yang negatif dijelaskan terpisah karena dapat memasukkan manfaat penggantian produksi material baru, bukan pengukuran CO2 yang diserap benda.

Jika selisih tepat nol, tidak ada keunggulan emisi menurut parameter tersebut. Selisih yang tidak nol tetapi membulat menjadi nol pada tampilan enam desimal diberi keterangan khusus, bukan disebut sama atau dijadikan alasan otomatis memilih daur ulang. Data tidak lengkap, faktor yang tidak mendukung material, dan perhitungan tidak valid tetap tidak menghasilkan kesimpulan emisi.

Untuk rujukan WARM/PLACES yang memperkirakan alternatif daur ulang lebih rendah, saran tindak lanjut tetap bergantung pada penerimaan material oleh pengelola serta kesesuaian kondisi setempat. Parameter khusus meminta pemeriksaan skenario, fasilitas, dan batas sumber. Penjelasan ini tidak mengubah faktor, rumus, validasi, snapshot historis, format CSV, atau model AI; penyimpanan catatan bukan bukti pengurangan emisi atau kredit karbon.

#### Insight riwayat

**Riwayat & ekspor** merangkum catatan yang sedang ditampilkan setelah pencarian/filter, bukan seluruh katalog atau arsip. Insight mencakup massa tercatat, komposisi material, jumlah catatan dengan faktor tersimpan, serta hasil AI/koreksi kategori yang tersimpan. Persetujuan pengguna bukan pengukuran akurasi model; massa dan material tetap mengikuti isian pengguna.

Perbandingan memakai snapshot faktor pada catatan, tidak dihitung ulang dengan pengaturan terbaru. Catatan dikelompokkan berdasarkan material, angka faktor, nama skenario, judul/URL sumber, konteks/batas metode, serta identitas rujukan. Waktu penerapan faktor tidak membedakan basis jika semua unsur tersebut sama. Satu kelompok dapat memberikan kesimpulan langsung; kelompok berbeda ditampilkan terpisah dan tidak dibuatkan satu total CO2e lintas kelompok. Rincian sumber dapat dibuka tanpa mengubah catatan.

Rincian rujukan menampilkan satu kartu selebar area isi untuk setiap kelompok, tersusun vertikal pada semua ukuran layar. Setiap kartu memisahkan material/rujukan, jumlah catatan dan berat, hasil perbandingan, langkah berikutnya, kedua skenario, lalu sumber dan asumsi. Penjelasan rujukan bawaan menggunakan paragraf bahasa sederhana dengan angka, satuan, cakupan dan batas metode yang tetap sama. Teks konteks parameter khusus atau data lama ditampilkan apa adanya; metadata asli dan ekspor penelitian tidak ditulis ulang.

Tombol **Tampilkan catatan tanpa faktor** hanya mengganti filter kelengkapan sambil mempertahankan pencarian/material. Untuk menambahkan estimasi pada catatan lama, gunakan **Ubah**, pilih rujukan sesuai, lalu simpan ulang. Ekspor CSV tetap mencakup semua catatan aktif. Nilai selisih di tabel/insight ditampilkan enam desimal seperti pratinjau; angka tersimpan dan CSV tidak berubah. Selisih kecil yang membulat ke nol dibedakan dari kesamaan tepat, sedangkan data gagal dimuat/diringkas ditampilkan sebagai tidak tersedia dengan kesalahan yang jelas.

### Model dan dataset

- Dataset formal: **120 foto**, masing-masing 40 untuk `SYN-PET`, `SYN-CRD`, dan `SYN-DRYWALL`, suffix 001-040. Tambahan CT-001 sampai CT-012 adalah eksplorasi; katalog menjadi **132 foto**. CT tidak masuk latihan, skor evaluasi, atau confusion matrix.
- Pada 26 Oktober 2026 pengguna mengonfirmasi bahwa tambahan 40 drywall dan CT-009 sampai CT-012 adalah foto barang nyata, objeknya berbeda antar-ID, dan bahannya papan gipsum berlapis kertas. Asal, label bahan, independensi objek dan ketiadaan kontaminasi tidak diverifikasi independen; `SYN` tetap hanya nama ID.
- **Latih: 78 foto sumber, 26 per kelas.** Seluruh 52 foto latih PET/kardus dipertahankan. Tambahkan 26 drywall dari ranking SHA-256 `20261026:<ID>`; 14 sisanya ditahan untuk uji. Split dan hash disimpan sebelum satu pelatihan, tanpa tuning atau pengacakan ulang berdasarkan hasil.
- **Uji lama/regresi: 28 PET/kardus**, 14 per kelas. Semua ID yang pernah diuji versi sebelumnya tetap di luar latihan. Tidak disebut foto baru pada pembaruan tiga kelas.
- **Uji baru: 14 drywall saja.** Kelompok ini tidak memiliki referensi PET/kardus dan tidak dapat menetapkan precision umum untuk ketiga kelas. Matrix gabungan 42 foto seimbang (14 per kelas), tetapi mencampur bukti baru dan regresi.
- Latar drywall dan sebagian foto lain serupa. Hash yang berbeda tidak membuktikan objek atau adegan independen. Koleksi internal ini bukan evaluasi eksternal atau sampel acak kondisi penggunaan.
- Empat varian setiap foto latih (asli, cermin horizontal, kecerahan x0,9 dan x1,1) menghasilkan **312 vektor fitur**, bukan 312 benda independen. Hash sumber dan JPEG diperiksa untuk mencegah duplikat identik.
- MobileNetV1 0.25 beku menghasilkan 256 fitur dari `conv_pw_13_relu`, global average pooling dan normalisasi L2. Head softmax **tiga kelas, 771 parameter** dilatih 200 epoch. Seed inisialisasi 20261024, learning rate 0,03 dan L2 0,001 dipertahankan; batch penuh 312, shuffle false. Tidak ada validasi terpisah atau tuning pada holdout.
- Model aktif: **`ct-mobilenet-913cfe5aa706`**. Uji baru drywall **14/14** dan regresi PET/kardus **28/28** sesuai label. Matrix gabungan memiliki diagonal 14/14/14; hasil bukan 42 uji baru atau bukti akurasi universal.
- Angka skor dalam laporan berasal dari skrip evaluasi. Setiap analisis browser menghitung skornya sendiri dari piksel yang dibaca; skor tersimpan bukan salinan angka pada laporan.
- Browser membaca RGB pada resolusi alami JPEG melalui canvas, bukan ukuran pratinjau CSS. Mengubah lebar layar tidak mengubah dimensi piksel masukan, skor, atau sidik piksel untuk foto yang sama pada browser yang sama. Perbedaan decoder JPEG antar-runtime tetap dapat menghasilkan skor berbeda dari laporan Node.js. Hasil historis tidak dihitung ulang otomatis.
- Model hanya membandingkan tiga kelas. Papan semen dan bahan lain dapat mendapat skor tinggi yang keliru. Softmax bukan probabilitas terkalibrasi atau verifikasi komposisi bahan, keselamatan puing, atau ada/tidaknya zat berbahaya.
- Antarmuka menyebut hasil satu gambar **Skor foto / Photo score**, terpisah dari akurasi pada foto berlabel. Pengguna tetap memeriksa material dan hasil timbang. Jangan memecah atau menangani puing berbahaya untuk demonstrasi.

Artefak berada di [public/models](public/models). [Laporan aktif](public/models/carbontrace/report.json) memakai schema v3, urutan label eksplisit `pet/cardboard/drywall`, hash data/bobot, seluruh ID, split, hiperparameter dan hasil tiap foto. `new-holdout` hanya drywall; `previous-test` adalah regresi PET/kardus. Versi mengikuti hash bobot head.

Head model dimuat dari [folder versi aktif](public/models/carbontrace/ct-mobilenet-913cfe5aa706). Arsip [versi 80 foto](public/models/carbontrace/ct-mobilenet-414f2c4df422), [versi 40 foto](public/models/carbontrace/ct-mobilenet-b090d45c6b58), dan [versi awal](public/models/carbontrace/ct-mobilenet-4aa1cd74741b) dipertahankan. Analisis dua kelas lama tetap menyimpan dua skor dan versi aslinya, tanpa skor drywall buatan. Pengaturan faktor lama dibaca dengan slot drywall kosong, tidak ditulis ulang otomatis.

Pelatihan menyiapkan kandidat di cache, mengevaluasi dan memvalidasinya, lalu menerbitkan folder versi sebelum mengganti laporan aktif secara atomik. Kegagalan sebelum publikasi tidak mengganti head model aktif. Publikasi ditolak bila laporan aktif berubah selama proses atau artefak dengan versi yang sama berbeda isinya.

#### Melatih ulang secara lokal

```powershell
.\scripts\prepare-sample-photos.ps1
npm run train
npm test
npm run build
```

Pelatihan memakai TensorFlow.js CPU, tanpa layanan klasifikasi eksternal atau paket native `tfjs-node`. Checkpoint publik MobileNet diunduh saat pertama kali dibutuhkan dan disimpan di cache dependency. Gambar pengguna tidak dikirim ke sumber checkpoint. Model yang diekspor dan bobotnya dilayani dari origin aplikasi sendiri; tidak ada unduhan model dari CDN saat inferensi.

Setelah melatih ulang, muat ulang halaman agar model baru dimuat. Sumber checkpoint dan lisensi Apache-2.0 disertakan dalam folder model. Backbone berasal dari [checkpoint MobileNet TensorFlow.js](https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json), dengan pendekatan ekstraksi fitur seperti [contoh transfer learning TensorFlow.js](https://github.com/tensorflow/tfjs-examples/tree/master/webcam-transfer-learning).

### Faktor dan sumber

- Saat aplikasi dibuka, tidak ada faktor yang diisi diam-diam. Default baru diterapkan sesudah konfirmasi material oleh pengguna dan hanya bila slot material kosong. Preferensi lama/pilihan khusus dipertahankan. Menonaktifkan estimasi berlaku pada draft/record ini; record lama tanpa faktor tetap demikian ketika dibuka, sampai pengguna memilih mengaktifkan estimasi.
- **Set 1** memakai EPA WARM v16, landfill rata-rata nasional AS dibanding daur ulang.
- **Set 2** memakai WARM v16, landfill tanpa sistem pengumpulan/pemulihan gas (No Recovery) dibanding daur ulang. Ini bukan gas yang ditangkap lalu dibakar (flaring) atau digunakan untuk energi.
- **Set 3** memakai PLACES Indonesia (TCI/SIMTech), PET ke Sanitary Landfill dibanding daur ulang mekanis. Faktor kg CO2e/kg PET: awal `0.095579`, alternatif `-2.497533`.
- **Set 4** memakai PLACES Indonesia, PET ke Open Dump/TPA terbuka dibanding daur ulang mekanis. Faktor: awal `0.101700`, alternatif `-2.497533`. Open Dump tidak sama dengan Open Burning.
- Set 3/4 hanya PET; Set 1/2 PET/kardus; Set 5 hanya drywall. Daftar difilter menurut material yang diatur, dengan default terlebih dahulu. Penerapan mengubah satu material saja, sehingga PET PLACES, kardus WARM, dan drywall WARM dapat hidup berdampingan dengan identitas sumber masing-masing. Nilai pada record lama hanya berubah setelah edit dan simpan ulang.
- Set 5 `warm16-drywall-us-average-r1` memakai **E53/C53**, faktor **-0,067287 / +0,028756 kg CO2e/kg**. Selisih untuk 1 kg adalah **-0,096043** menggunakan faktor enam desimal aplikasi. Nilai negatif landfill mencakup penyimpanan karbon kertas, bukan penyerapan CO2 mineral gipsum. Hasil ini bukan anjuran landfill; risiko H2S, kontaminasi, aturan dan penerimaan fasilitas harus diperiksa. Cakupan hanya drywall biasa berlapis kertas, bukan papan semen atau puing campuran; tidak ada faktor Indonesia yang diverifikasi untuk drywall.
- **Parameter khusus** menyediakan isian sendiri dan disimpan per material. Mengedit angka rujukan membuatnya berstatus khusus, bukan tetap mengklaim preset.
- Masing-masing rujukan memiliki penjelasan asumsi, kegunaan, tabel faktor, lokasi angka sumber, serta tautan workbook EPA atau kueri kalkulator PLACES dan metodologinya di aplikasi.
- Set 1/2 memakai konteks Amerika Serikat. Set 3/4 memakai konteks model Indonesia, **bukan faktor resmi pemerintah Indonesia atau pengukuran fasilitas tertentu**. Kondisi fasilitas, jalur pengolahan aktual, dan kesesuaian lokasi belum diverifikasi.
- Satuan faktor adalah **kg CO2e/kg material**. Masukkan nilai yang konsisten dengan dokumen dan skenario yang dicatat.
- Nilai WARM dikonversi dari MTCO2e/US short ton dengan `x 1000 / 907.18474` dan dibulatkan enam desimal. Sel yang dipakai: E8/C8, E9/C9 untuk Set 1; F8/C8, F9/C9 untuk Set 2.
- Nilai PLACES diambil dari **GHG emissions - Details**, Indonesia/PET, kueri `1.000.000 metric tonnes` pada 24 Oktober 2026: Sanitary Landfill `95.579 / -2.497.533 tonnes CO2e`; Open Dump `101.700 / -2.497.533`. Masing-masing angka dibagi `1.000.000` menjadi kg CO2e/kg. Kueri besar mengurangi pembulatan tampilan dan bukan massa sampel proyek atau bukti akurasi enam desimal. Kueri satu ton juga diperiksa: penghematan tampil `2.59` dan `2.60 tonnes CO2e`.
- PLACES menggunakan batas hilir pengelolaan limbah, dampak Ecoinvent v3.9, asumsi transport lokal Indonesia 20 km, substitusi PET virgin 95%, dan jalur reject sesuai model. Metodologi SSEA diperbarui Oktober 2025; tanggal akses bukan tahun seluruh data lapangan. Metode PLACES dan WARM berbeda, sehingga perbedaan hasil tidak bisa ditafsirkan sebagai pengaruh negara saja.
- Angka nol valid. Faktor neto negatif diperbolehkan jika memang didukung oleh metode sumber.
- Rumus: `massa_g / 1000 * (faktor_awal - faktor_alternatif)`. Selisih negatif tidak diubah menjadi penghematan positif.
- Pada rujukan WARM/PLACES, skenario awal mengasumsikan material masuk landfill/TPA sesuai set dan alternatif mengasumsikan massa yang sama didaur ulang. Nilai neto dapat memasukkan produksi baru yang dihindari (serta penyimpanan karbon pada WARM); bukan pengukuran gas langsung.
- Sumber dan konteks wajib diisi. Menyimpan tautan atau judul tidak berarti aplikasi sudah memverifikasi metode tersebut.
- Setiap catatan menyimpan salinan faktor, sumber, konteks, waktu, ID set, dan nama set. Mengubah atau mengosongkan pengaturan tidak mengubah catatan lama otomatis. ID preset berversi r1 menjaga identitas rujukan historis; nilai rujukan tidak dapat diedit sambil mempertahankan identitas preset.
- Ringkasan membedakan catatan dengan faktor dari estimasi yang belum tersedia, serta hasil sah bernilai nol. Basis material/rujukan yang tidak sesuai tetap dipisahkan; tidak ada total CO2e lintas basis.

Dokumentasi angka asli, konversi, asumsi, kegunaan, dan rujukan masing-masing set terdapat di [Parameter Set Emisi](src/assets/guides/Parameter-Set-Emisi.md). Panduan Markdown dan Word disertakan sebagai aset aplikasi dan dapat diunduh melalui panel parameter.

### Penyimpanan dan arsip

Catatan lama tidak dihapus atau dipromosikan menjadi data nyata. Data dari `carbontrace.demo.v1` disalin ke bagian **Arsip data contoh** dalam `carbontrace.records.v2`; kunci lama tetap utuh. Ringkasan aktif tidak memakai contoh lama. Catatan manual versi sebelumnya tetap dapat dibaca tanpa diberi skor atau prediksi AI secara otomatis.

Catatan aktif dan arsip disimpan dalam `carbontrace.records.v2` di localStorage; catatan katalog lama tetap kompatibel. Catatan unggahan menambahkan metadata foto opsional (ID, nama asli, dimensi, ukuran, hash JPEG, dan waktu unggah). Blob JPEG disimpan di IndexedDB `carbontrace.photos.v1`, object store `photos`, bukan dimasukkan sebagai Base64 ke localStorage. Hasil inferensi model saat ini menyimpan tiga skor, versi model, sidik piksel RGB, dan waktu analisis; analisis lama mempertahankan skor aslinya. Pengaturan faktor memakai `carbontrace.factors.v1`. Semua penyimpanan berada pada browser dan origin yang sama; tidak ada akun atau sinkronisasi server.

Penyimpanan foto menunggu transaksi IndexedDB selesai sebelum metadata catatan ditulis. Jika penulisan metadata gagal, salinan foto yang baru dibuat dibersihkan; kegagalan pembersihan juga dilaporkan, bukan dianggap berhasil. Foto yang hilang atau hash-nya tidak sesuai ditampilkan sebagai kesalahan. Jika foto tidak dapat disimpan, tidak ada konfirmasi simpan palsu. Katalog tetap dapat dicatat tanpa akses penyimpanan foto unggahan.

Kesalahan format, izin, atau kapasitas penyimpanan ditampilkan secara eksplisit. Kapasitas foto mengikuti kuota browser, bukan tanpa batas. Data yang gagal dimuat tidak ditimpa otomatis, dan penulisan yang gagal tidak dianggap berhasil. Setelah memperbaiki penyimpanan, gunakan **Muat ulang penyimpanan**. Menghapus data situs dapat menghapus catatan dan foto; simpan CSV serta foto asli secara terpisah karena CSV tidak membawa berkas gambar.

### Foto sampel

File sumber berada di [src/assets/samples](src/assets/samples): 12 CT dan masing-masing 40 `SYN-PET`, `SYN-CRD`, `SYN-DRYWALL`. Script tidak mengubah isi atau nama PNG sumber.

Tampilan, pelatihan, dan thumbnail memakai JPEG di [src/assets/samples/optimized](src/assets/samples/optimized), pola `<ID>_01.jpg`, maksimal 1024 piksel dan kualitas 85. Total 132 JPEG adalah 24.419.473 byte (23,29 MiB). Setiap file tetap di bawah 512 KiB; batas total tes dinaikkan menjadi 30 MiB karena katalog bertambah. PNG sumber tidak ikut build. Hash seluruh foto dataset lama tetap sama.

Untuk membuat ulang salinan setelah mengganti foto sumber, jalankan melalui PowerShell di Windows:

```powershell
.\scripts\prepare-sample-photos.ps1
```

Script mempertahankan rasio gambar, memeriksa batas ukuran tampilan, dan memastikan hash file sumber tidak berubah. Pengujian juga memeriksa pemetaan dan keberadaan seluruh gambar. File gambar yang hilang atau gagal dimuat dilaporkan di aplikasi, tanpa ilustrasi pengganti diam-diam.

Label **Foto pengguna** menyatakan asal file, bukan jaminan keaslian atau bahan. Label 120 foto formal adalah referensi internal; kategori catatan tetap dikonfirmasi pengguna.

Tabel contoh berat 132 foto disimpan lokal, di luar repository ini. Isinya mengikuti 78 training dan 54 test pada aplikasi, dengan thumbnail dan tautan per ID. Seluruh nilai 88 foto sebelumnya dipertahankan. Tambahan 44 drywall memakai **contoh/asumsi 1.000 g per kelompok target**, bukan estimasi dari gambar atau hasil timbang. Kolom hasil ukur tetap kosong. Angka contoh tidak dipakai melatih classifier atau menjadi observasi paper. Workbook 88 foto dan 48 foto juga disimpan lokal sebagai arsip.

Foto tampilan akan ikut dipublikasikan jika aplikasi dideploy. Pastikan tidak ada alamat, nomor telepon, atau informasi pribadi sebelum publikasi.

### Batasan yang wajib dipertahankan

- Berat dilaporkan pengguna; aplikasi tidak menimbang benda atau memverifikasinya secara independen.
- Inferensi memakai bobot terlatih yang tersimpan. Kegagalan model atau gambar dilaporkan, bukan diganti hasil fixture.
- Empat belas uji drywall baru dan 28 regresi PET/kardus bukan 42 uji baru atau bukti kinerja pada semua kondisi. Perlu uji baru ketiga kelas dengan audit label dan variasi adegan. Jumlah objek fisik juga tidak ditetapkan dari jumlah foto.
- Faktor berasal dari rujukan model yang dipilih atau input pengguna dengan sumber dan konteks, bukan faktor resmi yang dijamin oleh aplikasi.
- Konfirmasi manusia tidak sama dengan verifikasi pengolahan atau pengurangan emisi.
- Tidak ada bukti daur ulang aktual, additionality, penerbitan kredit karbon, nilai perdagangan, atau integrasi registri.
- Foto, jenis material, hasil timbang, sumber faktor, dan pengolahan aktual belum diverifikasi independen.

### Ekspor

CSV aktif mempertahankan 24 kolom awal, enam kolom metadata AI, lalu menambahkan `factor_parameter_set_id` dan `factor_parameter_set_name` (total **32 kolom**). Metode berupa `MANUAL` atau `AI_ASSISTED_HUMAN_CONFIRMED`; status AI per catatan adalah `NOT_ANALYZED` atau `MODEL_INFERENCE_RECORDED`, bukan klaim bahwa semua catatan telah dianalisis.

Enam kolom tambahan adalah `ai_predicted_material`, `ai_score_not_accuracy`, `ai_model_version`, `ai_input_rgb_sha256`, `ai_analyzed_at`, dan `ai_human_correction`. Sidik piksel merupakan SHA-256 dari dimensi dan RGB yang dianalisis, bukan hash file PNG asli atau bukti keaslian foto.

Berat tetap `USER_REPORTED_NOT_VERIFIED`. Kolom faktor memuat salinan sumber yang dipakai saat catatan disimpan; estimasi kosong ketika faktor belum tersedia. Faktor khusus berstatus `USER_SUPPLIED_NOT_VERIFIED`; preset WARM/PLACES berstatus `REFERENCE_MODEL_NOT_SITE_VERIFIED`. Data lama tanpa metadata parameter tetap dibaca sebagai parameter khusus, tanpa dilabeli preset secara otomatis.

Untuk unggahan, `sample_name` menyimpan nama file asli, `current_sample_image_file` berisi nama salinan `<UPL-ID>.jpg`, dan `current_sample_image_source` adalah `USER_UPLOADED_UNVERIFIED`; katalog tetap `USER_PROVIDED_UNVERIFIED`. CSV tidak menyertakan blob foto. Hash JPEG pada metadata foto berbeda dari hash dimensi/RGB inferensi; keduanya bukan bukti keaslian fisik.

Ekspor arsip menggunakan format versi sebelumnya dan tetap menandai datanya sebagai contoh. Arsip tidak tercampur ke CSV aktif. Kolom foto katalog menjelaskan katalog saat ekspor, bukan bukti foto historis. Verifikasi isi gambar, pengolahan, dan penerbitan kredit tetap `NO`.

Panduan Word tersedia sebagai aset aplikasi di [dokumen penggunaan](src/assets/guides/CarbonTrace-Skenario-dan-Panduan-Penggunaan.docx).

Paper tersedia sebagai [PDF submission v2](<docs/CarbonTrace-GENIUS-AI-Research-Paper v2.pdf>). Model tetap `ct-mobilenet-913cfe5aa706`, dengan satu matrix 42 foto serta riwayat evaluasi baru/regresi pada bagian batasan. Dokumentasi alur faktor diselaraskan dengan default/per-material/opsi tanpa estimasi. Kesalahan CT-009 eksplorasi tetap dilaporkan di luar akurasi formal. Nilai berat Excel tetap contoh. Unggah build terbaru sebelum submission agar tautan laporan model sesuai dengan hosting.

### Isi repository

Dalam `docs`, hanya PDF submission v2 yang disertakan di repository. Dokumen lokal tambahan dan paket deployment dikecualikan dari Git. Dua panduan yang dibutuhkan aplikasi tersedia di [src/assets/guides](src/assets/guides), sehingga clone baru tetap dapat dibuild dan memiliki kedua pilihan unduhan. File yang dikecualikan tetap ada pada komputer penulis dan tidak diperlukan untuk pelatihan atau build repository ini.

### Pengembangan berikutnya

Perluas foto dari benda dan adegan yang beragam, audit label serta hubungan antar-foto, dan uji bahan di luar tiga kelas. Evaluasi independen diperlukan sebelum klaim generalisasi atau akurasi luas. Peran AI dan status antarmuka harus mengikuti kemampuan yang benar-benar diuji. Integrasi perangkat tetap opsional.
