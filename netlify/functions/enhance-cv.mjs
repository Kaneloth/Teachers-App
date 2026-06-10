import busboy from 'busboy';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

async function extractTextFromBuffer(buffer, mimeType) {
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else if (mimeType === 'application/msword') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else {
    throw new Error('Unsupported file type. Please upload PDF or DOCX.');
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const contentType = event.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return { statusCode: 400, body: 'Expected multipart/form-data' };
  }

  let fileBuffer = null;
  let fileMimeType = null;
  let cvType = 'educator';

  await new Promise((resolve, reject) => {
    const bb = busboy({ headers: { 'content-type': contentType } });

    bb.on('file', (name, file, info) => {
      fileMimeType = info.mimeType;
      const chunks = [];
      file.on('data', (chunk) => chunks.push(chunk));
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    bb.on('field', (name, value) => {
      if (name === 'cvType') cvType = value;
    });

    bb.on('finish', resolve);
    bb.on('error', reject);
    bb.end(Buffer.from(event.body, 'base64'));
  });

  if (!fileBuffer) {
    return { statusCode: 400, body: 'No file uploaded' };
  }

  let rawText;
  try {
    rawText = await extractTextFromBuffer(fileBuffer, fileMimeType);
  } catch (err) {
    console.error('Text extraction error:', err);
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }

  const prompt = `
You are an expert CV parser. Extract information from the following CV text and return a JSON object that exactly matches the structure below.

Use empty strings or empty arrays where data is missing. Do not add any extra fields or commentary.

CV TEXT:
"""
${rawText}
"""

Required JSON structure (Educator CV):
{
  "personal": {
    "full_name": "",
    "email": "",
    "phone": "",
    "address": "",
    "bio": "",
    "id_number": "",
    "gender": "",
    "population_group": "",
    "citizenship": "",
    "drivers_licence": []
  },
  "education": [
    { "institution": "", "qualification": "", "year": "" }
  ],
  "experience": [
    { "school": "", "role": "", "from": "", "to": "", "description": "" }
  ],
  "skills": {
    "subjects": [],
    "soft_skills": [],
    "languages": []
  },
  "references": [
    { "name": "", "title": "", "organisation": "", "phone": "", "email": "", "relationship": "" }
  ],
  "custom_sections": []
}

Return ONLY valid JSON. No extra text.
  `;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Groq API error:', data);
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: data.error?.message || 'AI processing failed' }),
      };
    }

    const parsedContent = JSON.parse(data.choices[0].message.content);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: parsedContent }),
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};