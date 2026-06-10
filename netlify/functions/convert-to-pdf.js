// netlify/functions/convert-to-pdf.mjs
import busboy from 'busboy';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const secret = process.env.CONVERTAPI_SECRET;
  if (!secret) {
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

  // Check if the response is successful
  if (!response.ok) {
    const errorText = await response.text();
    console.error('ConvertAPI error response:', errorText);
    return { statusCode: 500, body: `ConvertAPI error: ${errorText}` };
  }

  const pdfBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(pdfBuffer);

  // Verify it's a valid PDF (should start with '%PDF')
  const isPDF = buffer.slice(0, 4).toString() === '%PDF';
  if (!isPDF) {
    console.error('ConvertAPI did not return a PDF. First bytes:', buffer.slice(0, 100).toString());
    return { statusCode: 500, body: 'ConvertAPI returned invalid data (not a PDF)' };
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