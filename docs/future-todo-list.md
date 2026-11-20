# 3D Model Vault — Future Additions & Phase 2 TODO

> [!NOTE]
> Items **#4, #5, #6, #8, and #9 (QA/QC File-Metadata Reconciliation)** have been implemented in `index.html` and `backend/Code.gs`. Remaining items are queued for future implementation.

---

## 1. Full Vault Backups (Files + Metadata)
- [ ] **Backup actual files, not just metadata:** Extend backup/export beyond Firebase JSON metadata so the underlying 3D files in Google Drive are included.
- [ ] **Explore backup formats & targets:**
  - Manual or scheduled full-vault archive (e.g., Drive files + metadata JSON bundled together).
  - Incremental local mirror / secondary cloud backup so large libraries don't require re-downloading everything each time.
  - Restore / import verification path to confirm a backup can rebuild both Drive files and Firebase links.

## 2. Slicer File Storage & Print-Ready Assets
- [ ] **Evaluate what slicer files are needed for printing:** Identify which artifacts add real value to store alongside raw `STL`s (e.g., `.3mf` slicer project files with supports/orientation/plate layouts, `.gcode` / `.bgcode`, or exported printer/filament profiles).
- [ ] **Attach slicer files to model records:** Support storing multiple slicer/output variants under a single model (e.g., tagged by printer, nozzle size, material, or date).
- [ ] **Surface slicer metadata in the UI (optional):** Extract/display useful details like estimated print time, filament usage, or layer height when available.

## 3. Phase 2: Local Print Queue Workflow & Cleanup
*Turning the vault from a cloud archive into an active day-to-day printing workspace on the computer.*

- [ ] **Download for printing:** Simple action to pull a model (and its associated slicer/project files) down to the local computer when ready to slice or print.
- [ ] **Local working queue folder:** Maintain a dedicated local folder for models currently in `queued` / `printing` status so the slicer can open them directly without manual hunting.
- [ ] **Cleanup & post-print removal:**
  - Functions to delete/purge local working files after a print finishes (`printed`) or when removed from the queue, keeping the local drive tidy while preserving everything in the cloud vault.
  - Guardrails against accidental deletion of unsaved local slicer edits (e.g., prompt or upload updated `.3mf`/slicer file back to the vault before local cleanup).
- [ ] **Evaluate local folder integration approach:**
  - Browser File System Access API (zero-install, user grants folder permission in Chromium browsers) vs. a lightweight local companion script/agent for automated sync and cleanup.

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

## 7. UI Polish: Field Values vs. Placeholders (Watermarks)
- [ ] **Clearer visual distinction:** Improve contrast, opacity, and styling (e.g., muted/italicized placeholder watermarks vs. crisp, high-contrast entered values) across form inputs and detail fields so empty vs. populated fields are immediately distinguishable.
- [ ] **Audit all forms & modals:** Review ingestion forms, model edit panels, settings/config inputs, and print log fields for consistent placeholder vs. value styling.

## 8. Clarify / Unify Material vs. Target Filament ✅ *(Completed)*
- [x] **Resolve overlap between `Material` and `Target Filament`:** Clearly distinguished `Material Type` (e.g., `PETG / PLA / ASA`) from `Target Filament Spool (Optional)` (e.g., `Polymaker PETG Dark Grey`), and added editable fields for both in the model drawer.
- [x] **Surface `Target Filament` consistently:** Unified display across Library Archive cards, Print Queue cards, and the detail drawer via `formatFilamentSummary()`, and removed the silent `'PETG'` fallback on blank target filament inputs.
- [x] **Import auto-fill:** Updated `.gcode` and `.3mf` parsers to also extract filament profile / color metadata (`filament_settings_id` and `<filament color="...">`) into `Target Filament`.

## 9. QA/QC: Metadata Without Files & Files Without Metadata ✅ *(Completed)*
- [x] **Detect & resolve metadata records missing associated files:** Flags URL-only / `needs_files` records and placeholder entries in the **QA/QC** tab and Library cards, with 1-click file attachment (`.STL`/`.3MF`/`.GCODE`) or record deletion.
- [x] **Detect & resolve orphaned files with no metadata:**
  - **Local File Scan:** Select multiple local files/folders to compare against vault metadata; unmatched files can be turned into new model records in 1 click or linked to an existing model.
  - **Google Drive Scan:** Added `auditDrive` in `backend/Code.gs` to inspect `/3D Model Vault/Models`, detect orphaned Drive folders not referenced by any metadata record, and recover them into the vault in 1 click.
