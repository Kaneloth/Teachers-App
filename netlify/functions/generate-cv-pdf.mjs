// netlify/functions/generate-cv-pdf.mjs
import { readFileSync } from 'fs';
import { join } from 'path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Simple templating engine (supports {{var}} and {{#each array}}...{{/each}})
function fillTemplate(template, data) {
  let result = template;
  // Replace simple placeholders
  const replaceSimple = (obj, prefix = '') => {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        replaceSimple(value, prefix ? `${prefix}.${key}` : key);
      } else if (Array.isArray(value)) {
        // Skip arrays – handled separately
      } else {
        const placeholder = new RegExp(`{{${prefix ? prefix + '.' + key : key}}}`, 'g');
        result = result.replace(placeholder, value || '');
      }
    }
  };
  replaceSimple(data);

  // Handle #each loops (basic)
  const eachRegex = /{{#each (\w+)}}([\s\S]*?){{\/each}}/g;
  let match;
  while ((match = eachRegex.exec(result)) !== null) {
    const arrayName = match[1];
    const innerTemplate = match[2];
    const array = data[arrayName] || [];
    let loopHtml = '';
    for (const item of array) {
      let itemHtml = innerTemplate;
      for (const [key, val] of Object.entries(item)) {
        if (key === 'description') {
          // Split description into lines for bullet points
          const lines = val.split('\n').filter(l => l.trim());
          let bulletsHtml = '';
          for (const line of lines) {
            bulletsHtml += `<div style="display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px;"><span>•</span><span style="font-size: 12px; line-height: 1.5; color: #374151; text-align: justify;">${line.trim()}</span></div>`;
          }
          itemHtml = itemHtml.replace(new RegExp(`{{#each descriptionLines}}([\\s\\S]*?){{\\/each}}`, 'g'), () => bulletsHtml);
        } else {
          const placeholder = new RegExp(`{{${key}}}`, 'g');
          itemHtml = itemHtml.replace(placeholder, val || '');
        }
      }
      loopHtml += itemHtml;
    }
    result = result.replace(match[0], loopHtml);
  }
  return result;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let cvData;
  try {
    cvData = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const templateName = cvData.template || 'classic';
  const templatePath = join(process.cwd(), `netlify/functions/templates/${templateName}.html`);
  let template;
  try {
    template = readFileSync(templatePath, 'utf8');
  } catch (err) {
    console.error('Template missing:', templatePath);
    return { statusCode: 500, body: 'Template not found' };
  }

  const filledHtml = fillTemplate(template, cvData);

  let browser = null;
  try {
    const executablePath = await chromium.executablePath();
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
    return { statusCode: 500, body: 'PDF generation failed' };
  }
};