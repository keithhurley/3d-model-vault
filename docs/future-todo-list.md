# 3D Model Vault — Future Additions & Phase 2 TODO

> [!NOTE]
> All planned items (**#1–#9**) have been implemented in `index.html` and `backend/Code.gs`.

---

## 1. Full Vault Backups (Files + Metadata) ✅ *(Completed)*
- [x] **Backup actual files, not just metadata:** Added **Export Full Backup (.ZIP)** (`exportFullVaultZip`) in **Setup → Cloud Sync & Backups**, bundling `vault-metadata.json` (models, categories, manifest) with all 3D model/slicer binaries from Google Drive.
- [x] **Incremental local mirror & full restore:**
  - **Incremental Mirror to Local Folder** (`mirrorVaultToLocalFolder`) syncs `vault-metadata.json` and only downloads new or changed Drive files into a local backup directory.
  - **Restore Full Backup (.ZIP)** (`restoreFullVaultZip`) restores metadata, custom categories, and re-uploads backed-up 3D files into Google Drive + Firebase.

## 2. Slicer File Storage & Print-Ready Assets ✅ *(Completed)*
- [x] **Non-perishable original file protection:** The primary ingested file (`isOriginal: true`, `locked: true`) is permanently locked as a non-perishable part of the model record (`🔒 ORIGINAL` badge on cards and `Protected` in the slideout drawer).
- [x] **Add & remove slicer files and project versions:** Users can attach and remove supplementary files (Slicer Project `.3MF`, Sliced `.GCODE`/`.BGCODE`, CAD Revisions `.F3D`/`.STEP`, Mesh Variants `.STL`, Printer Profiles) with custom version/printer notes and optional Google Drive trash sync (`action=trashFile`).
- [x] **Surface slicer metadata & file badges on cards and slideout drawer:** Library and Queue cards display distinct `🔒 <EXT>` + `+<N> <EXT>` version badges, and the slideout drawer lists each file's role, version note, and extracted print time / filament weight / material.

## 3. Phase 2: Local Print Queue Workflow & Cleanup ✅ *(Completed)*
*Turning the vault from a cloud archive into an active day-to-day printing workspace on the computer.*

- [x] **Download for printing:** Added 1-click **`⬇ Download All`** / **`⬇ Stage for Print`** in the slideout drawer and **`⬇ Stage`** / **`⬇ Download`** on Print Queue rows (bundles multi-file records into a `.zip` with `PRINT_NOTES.txt` when no local folder is linked).
- [x] **Local working queue folder:** Integrated the Browser File System Access API (`showDirectoryPicker`) with IndexedDB handle persistence so Chromium browsers can link a dedicated local working folder and sync `queued` / `printing` models into `NN_<slug>_<id>/` subfolders.
- [x] **Cleanup & post-print removal:**
  - Automatic and manual cleanup (`Clean Up Finished`, per-item `🧹`, and auto-clean on `Done` / unqueue) removes local working folders while preserving master files in Google Drive.
  - Guardrails detect new or modified local slicer files (`lastModified` / size / new file check) and prompt to **Upload to Vault & Clean** or **Discard Local & Clean** before deleting.

## 4. Model Pictures & Thumbnail Backfill ✅ *(Completed)*
- [x] **Audit existing downloads for missing pictures:** Added detection on Library cards and in the **QA/QC** tab for any model lacking a preview picture.
- [x] **Multi-path picture recovery:**
  - **Retrieve** OpenGraph preview images from the original source page URL via the `scrapeThumbnail` Apps Script endpoint.
  - **Extract** embedded thumbnails or preview images from downloaded `.3mf` / `.zip` archives.
  - **Generate** rendered 3D preview snapshots offscreen from `STL`/`3MF` geometry (or shape presets), plus a `📸 Snapshot` button in the 3D drawer viewer.

## 5. Source Reference / URL Integrity ✅ *(Completed)*
- [x] **Ensure every model has a proper source reference/URL:** Enforced source URLs on external model ingestion and added an `Origin Reference / Project URL` field (with automatic `local://` provenance URI fallback) for Personal CAD designs.
- [x] **Handle missing or broken source links:** Flagged models missing a source reference in the Library and **QA/QC** tab with inline backfill and a 1-click "Mark Personal CAD" option.

## 6. Archive Categorization System ✅ *(Completed)*
- [x] **Define categorization taxonomy:** Added structured archive categories (`Organizers & Gridfinity`, `Workshop & Tools`, `Printer Mods & Enclosures`, `Household & Desk`, `Electronics & Mounts`, `Mechanical & Replacement Parts`, `Miniatures & Decor`, `Uncategorized`).
- [x] **Customizable categories:** Added full category management in **Setup** (add, rename with automatic model reassignment, reorder, remove, reset defaults) plus inline `+ Custom` quick-add in the **+ Add** form and **Model Drawer**.
- [x] **Auto-categorization & bulk organization:** Keyword-based category suggestion during file drop/title entry, plus 1-click bulk **Auto-Categorize All** in the **QA/QC** tab.
- [x] **Filter & browse by category:** Added category badges on Library & Queue cards, category dropdown filtering in the Library, and category editing in the model drawer.

## 7. UI Polish: Field Values vs. Placeholders (Watermarks) ✅ *(Completed)*
- [x] **Clearer visual distinction:** Added theme-aware `--placeholder` tokens across Workshop, Daylight, and Blueprint themes; `.vault-input::placeholder` renders in muted italic (`font-weight: 400`), while populated inputs/textareas (`:not(:placeholder-shown)`) render in crisp `font-weight: 500` with stronger borders and an accent focus ring.
- [x] **Consistent across all forms & modals:** Applied globally via `.vault-input` across ingestion forms, quick-edit drawer inputs, print logs, QA/QC backfill, and Setup configuration.

## 8. Clarify / Unify Material vs. Target Filament ✅ *(Completed)*
- [x] **Resolve overlap between `Material` and `Target Filament`:** Clearly distinguished `Material Type` (e.g., `PETG / PLA / ASA`) from `Target Filament Spool (Optional)` (e.g., `Polymaker PETG Dark Grey`), and added editable fields for both in the model drawer.
- [x] **Surface `Target Filament` consistently:** Unified display across Library Archive cards, Print Queue cards, and the detail drawer via `formatFilamentSummary()`, and removed the silent `'PETG'` fallback on blank target filament inputs.
- [x] **Import auto-fill:** Updated `.gcode` and `.3mf` parsers to also extract filament profile / color metadata (`filament_settings_id` and `<filament color="...">`) into `Target Filament`.

## 9. QA/QC: Metadata Without Files & Files Without Metadata ✅ *(Completed)*
- [x] **Detect & resolve metadata records missing associated files:** Flags URL-only / `needs_files` records and placeholder entries in the **QA/QC** tab and Library cards, with 1-click file attachment (`.STL`/`.3MF`/`.GCODE`) or record deletion.
- [x] **Detect & resolve orphaned files with no metadata:**
  - **Local File Scan:** Select multiple local files/folders to compare against vault metadata; unmatched files can be turned into new model records in 1 click or linked to an existing model.
  - **Google Drive Scan:** Added `auditDrive` in `backend/Code.gs` to inspect `/3D Model Vault/Models`, detect orphaned Drive folders not referenced by any metadata record, and recover them into the vault in 1 click.
