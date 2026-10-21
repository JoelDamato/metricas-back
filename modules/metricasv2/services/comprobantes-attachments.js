const { TextDecoder } = require('node:util');

function multipartAttachmentName(originalName, payload) {
  const expectedNames = new Set([
    ...(Array.isArray(payload.attachmentNames) ? payload.attachmentNames : []),
    ...(Array.isArray(payload.cheques) ? payload.cheques.map((row) => row?.archivoNombre) : [])
  ]);
  if (expectedNames.has(originalName)) return originalName;

  // Multer/Busboy reads plain multipart filename parameters as Latin-1,
  // while browsers send UTF-8. Only repair a name when it matches the JSON
  // declaration; never assign a cheque's file by position or fuzzy matching.
  if (!/^[\u0000-\u00ff]*$/.test(originalName)) return originalName;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true })
      .decode(Buffer.from(originalName, 'latin1'));
    return expectedNames.has(decoded) ? decoded : originalName;
  } catch {
    return originalName;
  }
}

function multipartAttachments(files, payload) {
  return files.map((file) => ({
    name: multipartAttachmentName(file.originalname, payload),
    type: file.mimetype || 'application/octet-stream',
    size: Number(file.size || file.buffer?.length || 0),
    base64: file.buffer.toString('base64')
  }));
}

module.exports = { multipartAttachments };
