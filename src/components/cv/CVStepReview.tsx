// netlify/functions/convert-to-pdf.mjs
import busboy from 'busboy';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = process.env.CONVERTAPI_SECRET;
  if (!secret) {
    console.error('CONVERTAPI_SECRET missing');
    return { statusCode: 500, body: 'ConvertAPI secret missing' };
  }

  const contentType = event.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return { statusCode: 400, body: 'Expected multipart/form-data' };
  }

  let fileBuffer = null;
  await new Promise((resolve, reject) => {
    const bb = busboy({ headers: { 'content-type': contentType } });
    bb.on('file', (name, file, info) => {
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });
    bb.on('finish', resolve);
    bb.on('error', reject);
    bb.end(Buffer.from(event.body, 'base64'));
  });

  if (!fileBuffer) {
    return { statusCode: 400, body: 'No file uploaded' };
  }

  // Prepare request to ConvertAPI
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), 'cv.docx');
  formData.append('converter', 'pdf');

  let response;
  try {
    response = await fetch('https://v2.convertapi.com/convert/docx/to/pdf', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      body: formData,
    });
  } catch (err) {
    console.error('Network error calling ConvertAPI:', err);
    return { statusCode: 500, body: 'Network error calling conversion service' };
  }

  // If ConvertAPI returns an error, read and return it
  if (!response.ok) {
    let errorText;
    try {
      errorText = await response.text();
    } catch {
      errorText = 'Unknown error';
    }
    console.error('ConvertAPI error response:', errorText);
    return { statusCode: 500, body: `ConvertAPI error: ${errorText}` };
  }

  const pdfBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(pdfBuffer);

  // Validate PDF header
  const header = buffer.slice(0, 4).toString();
  if (header !== '%PDF') {
    console.error('Invalid PDF header. First 100 bytes:', buffer.slice(0, 100).toString());
    return { statusCode: 500, body: 'ConvertAPI did not return a valid PDF' };
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cv.pdf"',
    },
    body: buffer.toString('base64'),
    isBase64Encoded: true,
  };
};