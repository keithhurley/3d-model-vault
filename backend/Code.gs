/**
 * 3D Model Vault — Google Apps Script Serverless Backend
 *
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone) on https://script.google.com
 *
 * Script Properties (Project Settings -> Script Properties):
 *   FIREBASE_DB_URL        e.g. https://your-project-default-rtdb.firebaseio.com
 *   VAULT_ROOT_FOLDER      Optional root folder name (default: "3D Model Vault")
 *   API_SECRET             Optional shared secret token checked against payload.secret or ?secret=
 *   TELEGRAM_BOT_TOKEN     Optional Telegram Bot token if using Telegram ingestion
 */

const DEFAULT_ROOT_FOLDER = '3D Model Vault';
const MAX_RETRIES = 4;

// ============================================================================
// HTTP ENTRYPOINTS (doGet / doPost)
// ============================================================================

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (!isAuthorized_(params.secret)) {
      return jsonResponse_({ ok: false, error: 'Unauthorized: invalid API secret' }, 401);
    }

    const action = params.action || 'ping';

    if (action === 'ping') {
      const props = getConfig_();
      return jsonResponse_({
        ok: true,
        service: '3D Model Vault Apps Script API',
        firebaseConfigured: Boolean(props.firebaseDbUrl),
        rootFolder: props.rootFolderName,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'getFile') {
      if (!params.driveFileId) {
        return jsonResponse_({ ok: false, error: 'Missing driveFileId' }, 400);
      }
      const file = DriveApp.getFileById(params.driveFileId);
      const bytes = file.getBlob().getBytes();
      return jsonResponse_({
        ok: true,
        fileName: file.getName(),
        mimeType: file.getMimeType(),
        sizeBytes: file.getSize(),
        base64: Utilities.base64Encode(bytes)
      });
    }

    return jsonResponse_({ ok: false, error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message, stack: err.stack });
  }
}

function doPost(e) {
  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const payload = JSON.parse(rawBody);

    // Handle Telegram Bot webhook updates automatically if message.text is present
    if (payload.message && payload.message.text) {
      return handleTelegramWebhook_(payload);
    }

    const params = (e && e.parameter) || {};
    if (!isAuthorized_(payload.secret || params.secret)) {
      return jsonResponse_({ ok: false, error: 'Unauthorized: invalid API secret' });
    }

    const action = payload.action || params.action || 'uploadFile';

    if (action === 'uploadFile') {
      return jsonResponse_(handleUploadFile_(payload));
    }

    if (action === 'initResumableUpload') {
      return jsonResponse_(handleInitResumableUpload_(payload));
    }

    if (action === 'uploadChunk') {
      return jsonResponse_(handleUploadChunk_(payload));
    }

    if (action === 'ingestUrl') {
      return jsonResponse_(handleIngestUrl_(payload));
    }

    if (action === 'saveMetadata') {
      const record = payload.model;
      if (!record || !record.id) {
        return jsonResponse_({ ok: false, error: 'Missing model object with id' });
      }
      writeFirebaseModel_(record);
      return jsonResponse_({ ok: true, id: record.id });
    }

    return jsonResponse_({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

// ============================================================================
// CORE HANDLERS: UPLOAD FILE & INGEST URL
// ============================================================================

/**
 * Uploads a 3D file (base64) into /3D Model Vault/Models/<folderName>
 * using Drive REST v3 resumable upload with exponential backoff.
 */
function handleUploadFile_(payload) {
  const modelId = payload.modelId || ('m_' + Utilities.getUuid().slice(0, 8));
  const title = payload.title || 'Untitled 3D Model';
  const fileName = payload.fileName || 'model.stl';
  const mimeType = payload.mimeType || 'application/octet-stream';
  const base64Data = payload.base64;

  if (!base64Data) {
    return { ok: false, error: 'Missing base64 file content' };
  }

  const folder = getOrCreateModelFolder_(modelId, title, payload.driveFolderId);
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);

  // Use resumable upload for reliability on large STL/3MF/G-code files
  const driveFile = uploadToDriveResumable_(blob, folder.getId(), fileName, mimeType);

  let thumbnailDriveId = null;
  if (payload.thumbnailBase64) {
    const thumbBytes = Utilities.base64Decode(payload.thumbnailBase64);
    const thumbBlob = Utilities.newBlob(thumbBytes, 'image/png', 'thumbnail.png');
    const thumbFile = uploadToDriveResumable_(thumbBlob, folder.getId(), 'thumbnail.png', 'image/png');
    thumbnailDriveId = thumbFile.id;
  }

  // Optionally persist or update the Firebase metadata record
  if (payload.model) {
    const model = payload.model;
    model.id = modelId;
    model.storage = model.storage || {};
    model.storage.driveFolderId = folder.getId();
    model.storage.driveFolderUrl = folder.getUrl();
    if (thumbnailDriveId) model.storage.thumbnailDriveId = thumbnailDriveId;
    model.updatedAt = new Date().toISOString();
    writeFirebaseModel_(model);
  }

  return {
    ok: true,
    modelId: modelId,
    driveFolderId: folder.getId(),
    driveFolderUrl: folder.getUrl(),
    driveFileId: driveFile.id,
    driveFileName: driveFile.name,
    thumbnailDriveId: thumbnailDriveId
  };
}

/**
 * Step 1 of large-file upload: creates the Drive folder, uploads any thumbnail,
 * and initiates a Google Drive v3 resumable upload session.
 * When `payload.origin` is an http(s) origin, Drive binds CORS headers to the
 * returned `uploadUrl` so the browser can stream large ZIP/STL files directly.
 */
function handleInitResumableUpload_(payload) {
  const modelId = payload.modelId || ('m_' + Utilities.getUuid().slice(0, 8));
  const title = payload.title || 'Untitled 3D Model';
  const fileName = payload.fileName || 'model.stl';
  const mimeType = payload.mimeType || 'application/octet-stream';
  const fileSize = Number(payload.fileSize || 0);

  const folder = getOrCreateModelFolder_(modelId, title, payload.driveFolderId);

  let thumbnailDriveId = null;
  if (payload.thumbnailBase64) {
    const thumbBytes = Utilities.base64Decode(payload.thumbnailBase64);
    const thumbBlob = Utilities.newBlob(thumbBytes, 'image/png', 'thumbnail.png');
    const thumbFile = uploadToDriveResumable_(thumbBlob, folder.getId(), 'thumbnail.png', 'image/png');
    thumbnailDriveId = thumbFile.id;
  }

  const token = ScriptApp.getOAuthToken();
  const headers = {
    Authorization: 'Bearer ' + token,
    'X-Upload-Content-Type': mimeType
  };
  if (fileSize > 0) {
    headers['X-Upload-Content-Length'] = String(fileSize);
  }
  if (payload.origin && /^https?:\/\//i.test(payload.origin)) {
    headers.Origin = payload.origin;
  }

  const initRes = withBackoff_(() =>
    UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: headers,
      payload: JSON.stringify({
        name: fileName,
        parents: [folder.getId()]
      }),
      muteHttpExceptions: true
    })
  );

  if (initRes.getResponseCode() >= 400) {
    return { ok: false, error: 'Drive resumable init failed: ' + initRes.getContentText() };
  }

  const resHeaders = initRes.getHeaders();
  const uploadUrl = resHeaders['Location'] || resHeaders['location'];
  if (!uploadUrl) {
    return { ok: false, error: 'Drive did not return a resumable upload Location header' };
  }

  return {
    ok: true,
    modelId: modelId,
    driveFolderId: folder.getId(),
    driveFolderUrl: folder.getUrl(),
    thumbnailDriveId: thumbnailDriveId,
    uploadUrl: uploadUrl
  };
}

/**
 * Fallback chunk proxy for file:// origins or when direct browser PUT is blocked.
 * Forwards a single base64-encoded chunk (must be a multiple of 256 KiB except final)
 * to the Google Drive resumable upload session URI.
 */
function handleUploadChunk_(payload) {
  const uploadUrl = payload.uploadUrl;
  const chunkBase64 = payload.chunkBase64;
  const startByte = Number(payload.startByte);
  const endByte = Number(payload.endByte);
  const totalBytes = Number(payload.totalBytes);
  const mimeType = payload.mimeType || 'application/octet-stream';

  if (!uploadUrl || !chunkBase64 || isNaN(startByte) || isNaN(endByte) || !totalBytes) {
    return { ok: false, error: 'Missing required chunk upload parameters' };
  }

  const bytes = Utilities.base64Decode(chunkBase64);
  const putRes = withBackoff_(() =>
    UrlFetchApp.fetch(uploadUrl, {
      method: 'put',
      contentType: mimeType,
      headers: {
        'Content-Range': 'bytes ' + startByte + '-' + endByte + '/' + totalBytes
      },
      payload: bytes,
      muteHttpExceptions: true
    })
  );

  const code = putRes.getResponseCode();
  if (code === 308) {
    return { ok: true, done: false, nextOffset: endByte + 1 };
  }
  if (code >= 200 && code < 300) {
    const driveFile = JSON.parse(putRes.getContentText());
    return {
      ok: true,
      done: true,
      driveFileId: driveFile.id,
      driveFileName: driveFile.name
    };
  }
  return { ok: false, error: 'Drive chunk upload failed (' + code + '): ' + putRes.getContentText() };
}

/**
 * Ingests a model URL (from Bookmarklet, Android Share Sheet, or Telegram Bot).
 * Scrapes OpenGraph / page metadata, creates the Drive folder, attempts to
 * fetch public files if available, and writes the normalized record to Firebase.
 */
function handleIngestUrl_(payload) {
  const url = (payload.url || '').trim();
  if (!url) return { ok: false, error: 'Missing url' };

  const modelId = 'm_' + Utilities.getUuid().slice(0, 8);
  const sourceType = detectSourceType_(url);
  const scraped = scrapePageMetadata_(url);

  const title = payload.title || scraped.title || ('Model from ' + sourceType);
  const author = payload.author || scraped.author || 'Community Designer';
  const license = payload.license || scraped.license || 'See Source Page';
  const thumbnailUrl = payload.thumbnailUrl || scraped.image || '';

  const folder = getOrCreateModelFolder_(modelId, title);

  // Save a quick HTML shortcut inside the Drive folder linking back to the source page
  const shortcutHtml = `<html><head><meta http-equiv="refresh" content="0;url=${url}"></head><body><a href="${url}">${title}</a></body></html>`;
  folder.createFile('source_link.html', shortcutHtml, MimeType.HTML);

  let thumbnailDriveId = null;
  if (thumbnailUrl) {
    try {
      const imgRes = withBackoff_(() => UrlFetchApp.fetch(thumbnailUrl, { muteHttpExceptions: true }));
      if (imgRes.getResponseCode() === 200) {
        const thumbBlob = imgRes.getBlob().setName('thumbnail.png');
        const thumbFile = folder.createFile(thumbBlob);
        thumbnailDriveId = thumbFile.getId();
      }
    } catch (e) {
      // Non-fatal: keep thumbnailFallbackUrl
    }
  }

  const now = new Date().toISOString();
  const record = {
    id: modelId,
    title: title,
    description: scraped.description || '',
    sourceType: sourceType,
    ingestionState: 'needs_files', // Marked until STL/3MF/G-code is attached
    category: payload.category || 'Inbox',
    tags: payload.tags || [sourceType],
    createdAt: now,
    updatedAt: now,
    source: {
      isPersonalDesign: false,
      siteName: capitalize_(sourceType),
      url: url,
      externalId: sourceType + ':' + extractExternalId_(url),
      author: author,
      license: license
    },
    storage: {
      driveFolderId: folder.getId(),
      driveFolderUrl: folder.getUrl(),
      thumbnailDriveId: thumbnailDriveId,
      thumbnailFallbackUrl: thumbnailUrl
    },
    files: [],
    specs: {
      dimensionsDisplay: 'Pending file upload',
      estimatedPrintTimeDisplay: '—',
      filamentWeightGrams: 0,
      recommendedMaterial: 'PLA / PETG'
    },
    workflow: {
      status: payload.queueImmediately ? 'queued' : 'inbox',
      queueOrder: 99,
      priority: 'normal',
      targetFilament: ''
    },
    nextTimeSummary: payload.note || '',
    printLogs: []
  };

  writeFirebaseModel_(record);

  return {
    ok: true,
    modelId: modelId,
    title: title,
    sourceType: sourceType,
    driveFolderUrl: folder.getUrl(),
    record: record
  };
}

// ============================================================================
// TELEGRAM BOT WEBHOOK (Optional: Text a URL to your bot to queue it)
// ============================================================================

function handleTelegramWebhook_(update) {
  const msg = update.message;
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);

  if (!urlMatch) {
    sendTelegramReply_(chatId, 'Send me a Thingiverse, MakerWorld, or Printables URL to save it to your 3D Model Vault!');
    return jsonResponse_({ ok: true });
  }

  const res = handleIngestUrl_({
    url: urlMatch[0],
    queueImmediately: text.toLowerCase().includes('#queue')
  });

  if (res.ok) {
    sendTelegramReply_(chatId, `✅ Saved "${res.title}" (${res.sourceType}) to your 3D Model Vault!\n📁 Drive: ${res.driveFolderUrl}`);
  } else {
    sendTelegramReply_(chatId, `⚠️ Could not ingest URL: ${res.error}`);
  }
  return jsonResponse_({ ok: true });
}

function sendTelegramReply_(chatId, text) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return;
  UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ chat_id: chatId, text: text }),
    muteHttpExceptions: true
  });
}

// ============================================================================
// GOOGLE DRIVE RESUMABLE UPLOAD & FOLDER HELPERS
// ============================================================================

function getOrCreateModelFolder_(modelId, title, existingFolderId) {
  if (existingFolderId) {
    try {
      return DriveApp.getFolderById(existingFolderId);
    } catch (e) {}
  }

  const cfg = getConfig_();
  const root = getOrCreateChildFolder_(DriveApp.getRootFolder(), cfg.rootFolderName);
  const modelsDir = getOrCreateChildFolder_(root, 'Models');

  const datePrefix = new Date().toISOString().slice(0, 10);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'model';
  const folderName = `${datePrefix}_${slug}_${modelId}`;

  return getOrCreateChildFolder_(modelsDir, folderName);
}

function getOrCreateChildFolder_(parentFolder, name) {
  const iter = parentFolder.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parentFolder.createFolder(name);
}

/**
 * Resumable upload via Google Drive REST API v3 with exponential backoff.
 */
function uploadToDriveResumable_(blob, parentFolderId, fileName, mimeType) {
  const token = ScriptApp.getOAuthToken();
  const metadata = {
    name: fileName,
    parents: [parentFolderId]
  };

  // Step 1: Initiate resumable upload session
  const initRes = withBackoff_(() =>
    UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'post',
      contentType: 'application/json; charset=UTF-8',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(metadata),
      muteHttpExceptions: true
    })
  );

  if (initRes.getResponseCode() >= 400) {
    throw new Error('Drive resumable init failed: ' + initRes.getContentText());
  }

  const uploadUrl = initRes.getHeaders()['Location'] || initRes.getHeaders()['location'];
  const bytes = blob.getBytes();

  // Step 2: Upload file bytes to the session URI
  const putRes = withBackoff_(() =>
    UrlFetchApp.fetch(uploadUrl, {
      method: 'put',
      contentType: mimeType || 'application/octet-stream',
      payload: bytes,
      muteHttpExceptions: true
    })
  );

  if (putRes.getResponseCode() >= 400) {
    throw new Error('Drive file upload failed: ' + putRes.getContentText());
  }

  return JSON.parse(putRes.getContentText());
}

// ============================================================================
// FIREBASE REALTIME DATABASE REST SYNC
// ============================================================================

function writeFirebaseModel_(model) {
  const cfg = getConfig_();
  if (!cfg.firebaseDbUrl) return;
  const baseUrl = cfg.firebaseDbUrl.replace(/\/+$/, '');
  const endpoint = `${baseUrl}/models/${encodeURIComponent(model.id)}.json`;

  withBackoff_(() =>
    UrlFetchApp.fetch(endpoint, {
      method: 'put',
      contentType: 'application/json',
      payload: JSON.stringify(model),
      muteHttpExceptions: true
    })
  );
}

// ============================================================================
// METADATA SCRAPING & EXPONENTIAL BACKOFF UTILITIES
// ============================================================================

function scrapePageMetadata_(url) {
  const result = { title: '', description: '', image: '', author: '', license: '' };
  try {
    const res = withBackoff_(() =>
      UrlFetchApp.fetch(url, {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; 3DModelVault/1.0)'
        }
      })
    );
    if (res.getResponseCode() !== 200) return result;
    const html = res.getContentText();

    result.title = matchMeta_(html, 'og:title') || matchTitleTag_(html);
    result.description = matchMeta_(html, 'og:description') || matchMeta_(html, 'description');
    result.image = matchMeta_(html, 'og:image');
    result.author = matchMeta_(html, 'author');
  } catch (e) {
    // Sites behind strict Cloudflare challenges will fall back to user/bookmarklet fields
  }
  return result;
}

function matchMeta_(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? decodeHtmlEntities_(m[1].trim()) : '';
}

function matchTitleTag_(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? decodeHtmlEntities_(m[1].trim()) : '';
}

function decodeHtmlEntities_(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function detectSourceType_(url) {
  const u = url.toLowerCase();
  if (u.includes('makerworld.com')) return 'makerworld';
  if (u.includes('printables.com')) return 'printables';
  if (u.includes('thingiverse.com')) return 'thingiverse';
  if (u.includes('cults3d.com')) return 'cults3d';
  if (u.includes('thangs.com')) return 'thangs';
  return 'other';
}

function extractExternalId_(url) {
  const m = url.match(/(\d{4,})/);
  return m ? m[1] : Utilities.getUuid().slice(0, 8);
}

function capitalize_(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/**
 * Exponential backoff wrapper for Drive / UrlFetch / Firebase throttling (429 / 5xx).
 */
function withBackoff_(fn) {
  let delayMs = 500;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = fn();
    const code = res && res.getResponseCode ? res.getResponseCode() : 200;
    if (code !== 429 && code < 500) {
      return res;
    }
    if (attempt === MAX_RETRIES) return res;
    Utilities.sleep(delayMs + Math.floor(Math.random() * 250));
    delayMs *= 2;
  }
}

function getConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    firebaseDbUrl: props.getProperty('FIREBASE_DB_URL') || '',
    rootFolderName: props.getProperty('VAULT_ROOT_FOLDER') || DEFAULT_ROOT_FOLDER,
    apiSecret: props.getProperty('API_SECRET') || ''
  };
}

function isAuthorized_(providedSecret) {
  const expected = getConfig_().apiSecret;
  if (!expected) return true; // No secret configured
  return providedSecret === expected;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
