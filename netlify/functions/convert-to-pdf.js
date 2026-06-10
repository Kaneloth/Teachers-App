// netlify/functions/convert-to-pdf.mjs
import busboy from 'busboy';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = process.env.CONVERTAPI_SECRET;
  console.log('CONVERTAPI_SECRET exists?', !!secret); // log for debugging

  if (!secret) {
    console.error('CONVERTAPI_SECRET environment variable is missing');
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

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), 'cv.docx');
  formData.append('converter', 'pdf');

  const response = await fetch('https://v2.convertapi.com/convert/docx/to/pdf', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('ConvertAPI error:', errorText);
    return { statusCode: 500, body: `PDF conversion failed: ${errorText}` };
  }

  const pdfBuffer = await response.arrayBuffer();

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="cv.pdf"',
    },
    body: Buffer.from(pdfBuffer).toString('base64'),
    isBase64Encoded: true,
  };
};