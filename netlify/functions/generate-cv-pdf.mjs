import { readFileSync } from 'fs';
import { join } from 'path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>]/g, (m) => {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function fillTemplate(template, data) {
  let result = template;
  // Replace simple placeholders (including nested)
  function replaceObject(obj, prefix = '') {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        replaceObject(value, fullKey);
      } else if (typeof value !== 'object') {
        const regex = new RegExp(`{{${fullKey}}}`, 'g');
        result = result.replace(regex, escapeHtml(String(value ?? '')));
      }
    }
  }
  replaceObject(data);

  // Special: {{initials}}
  const fullName = data.personal?.full_name || '';
  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  result = result.replace(/{{initials}}/g, initials);

  // Process #each loops for experience, education, references
  const eachRegex = /{{#each (\w+)}}([\s\S]*?){{\/each}}/g;
  result = result.replace(eachRegex, (match, arrayName, inner) => {
    const array = data[arrayName] || [];
    if (!array.length) return '';
    return array.map(item => {
      let itemHtml = inner;
      for (const [key, val] of Object.entries(item)) {
        if (key === 'description') {
          const lines = (val || '').split('\n').filter(l => l.trim());
          const bulletsHtml = lines.map(line => `
            <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
              <span style="flex-shrink: 0;">•</span>
              <span style="font-size: 12px; line-height: 1.5; color: #374151; text-align: justify; word-break: break-word;">${escapeHtml(line.trim())}</span>
            </div>
          `).join('');
          itemHtml = itemHtml.replace(/{{#each descriptionLines}}[\s\S]*?{{\/each}}/g, bulletsHtml);
        } else {
          const keyRegex = new RegExp(`{{${key}}}`, 'g');
          itemHtml = itemHtml.replace(keyRegex, escapeHtml(String(val ?? '')));
        }
      }
      return itemHtml;
    }).join('');
  });

  // Process subjects, soft_skills, languages
  const skills = data.skills || {};
  const processArray = (arrName) => {
    const arr = skills[arrName] || [];
    if (!arr.length) return;
    const bullets = arr.map(item => `
      <div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;">
        <span>•</span>
        <span style="font-size: 12px; line-height: 1.5; color: #374151; text-align: justify; word-break: break-word;">${escapeHtml(item)}</span>
      </div>
    `).join('');
    result = result.replace(new RegExp(`{{#each ${arrName}}}[\\s\\S]*?{{\\/each}}`, 'g'), bullets);
  };
  processArray('subjects');
  processArray('soft_skills');
  processArray('languages');

  return result;
}

export const handler = async (event) => {
  // Enable CORS for local testing (optional)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  let cvData;
  try {
    cvData = JSON.parse(event.body);
  } catch (err) {
    console.error('Invalid JSON:', err);
    return { statusCode: 400, headers, body: 'Invalid JSON' };
  }

  // Validate required fields
  if (!cvData.template) {
    console.error('Missing template field');
    return { statusCode: 400, headers, body: 'Missing template field' };
  }

  const templateName = cvData.template;
  const templatePath = join(process.cwd(), `netlify/functions/templates/${templateName}.html`);
  let template;
  try {
    template = readFileSync(templatePath, 'utf8');
  } catch (err) {
    console.error(`Template not found at ${templatePath}:`, err);
    return { statusCode: 500, headers, body: `Template ${templateName}.html not found` };
  }

  let filledHtml;
  try {
    filledHtml = fillTemplate(template, cvData);
  } catch (err) {
    console.error('fillTemplate error:', err);
    return { statusCode: 500, headers, body: 'Template processing error: ' + err.message };
  }

  let browser = null;
  try {
    // Get Chromium executable path
    const executablePath = await chromium.executablePath();
    if (!executablePath) {
      throw new Error('Chromium executable path not found');
    }
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(filledHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', bottom: '1cm', left: '1.5cm', right: '1.5cm' },
    });

    await browser.close();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="CV_${cvData.personal?.full_name || 'document'}.pdf"`,
      },
      body: pdfBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('PDF generation error:', err);
    if (browser) await browser.close();
    return {
      statusCode: 500,
      headers,
      body: `PDF generation failed: ${err.message}`,
    };
  }
};