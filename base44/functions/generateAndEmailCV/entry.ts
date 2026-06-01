import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { personal, education, experience, skills, template, _pdf_url_override } = body;

    if (!personal?.email) {
      return Response.json({ error: 'Email address is required.' }, { status: 400 });
    }

    // If client already generated and uploaded the PDF, skip server-side generation
    if (_pdf_url_override) {
      const name = personal.full_name || 'Educator';
      const emailBody = `<p>Hi ${name},</p>
<p>Your professional teaching CV has been generated successfully. Click the button below to download your PDF:</p>
<p style="margin: 24px 0;">
  <a href="${_pdf_url_override}" target="_blank" rel="noopener noreferrer" style="background-color: #14a078; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
    Download My CV (PDF)
  </a>
</p>
<p>If the button doesn't work, copy and paste this link into your browser:<br/><a href="${_pdf_url_override}">${_pdf_url_override}</a></p>
<p>Best regards,<br/>The Transfer SA Team</p>`;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: personal.email,
        subject: 'Your Teaching CV is Ready – Download Your PDF',
        body: emailBody,
      });
      return Response.json({ success: true, pdf_url: _pdf_url_override });
    }

    const TEMPLATES = {
      classic: { headerBg: [44, 62, 80], headerText: [255, 255, 255], accent: [44, 62, 80] },
      modern: { headerBg: [20, 160, 120], headerText: [255, 255, 255], accent: [20, 160, 120] },
      professional: { headerBg: [30, 60, 120], headerText: [255, 255, 255], accent: [30, 60, 120] },
      minimal: { headerBg: [220, 220, 220], headerText: [30, 30, 30], accent: [100, 100, 100] },
    };
    const theme = TEMPLATES[template] || TEMPLATES.classic;

    // --- Build PDF ---
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 0;

    // Header block
    doc.setFillColor(...theme.headerBg);
    doc.rect(0, 0, pageW, 45, 'F');
    doc.setTextColor(...theme.headerText);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text((personal.full_name || 'Educator').toUpperCase(), margin, 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const contactParts = [personal.email, personal.phone, personal.address].filter(Boolean);
    doc.text(contactParts.join('  |  '), margin, 27);
    y = 54;

    doc.setTextColor(30, 30, 30);

    const sectionHeader = (title) => {
      doc.setFillColor(...theme.accent);
      doc.rect(margin, y, contentW, 6, 'F');
      const txtColor = theme.headerBg[0] < 150 ? [255, 255, 255] : [30, 30, 30];
      doc.setTextColor(...txtColor);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(title.toUpperCase(), margin + 2, y + 4.2);
      doc.setTextColor(30, 30, 30);
      y += 9;
    };

    const addText = (text, opts = {}) => {
      const { bold = false, size = 10, color = [30, 30, 30], indent = 0 } = opts;
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(String(text), contentW - indent);
      if (y + lines.length * (size * 0.45) > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, margin + indent, y);
      y += lines.length * (size * 0.45) + 1.5;
    };

    if (personal.bio) {
      sectionHeader('Professional Summary');
      addText(personal.bio, { size: 9.5 });
      y += 3;
    }

    const validEdu = (education || []).filter(e => e.institution);
    if (validEdu.length) {
      sectionHeader('Education');
      validEdu.forEach(e => {
        addText(e.qualification || '', { bold: true, size: 10 });
        addText(`${e.institution} · ${e.year || ''}`, { size: 9, color: [80, 80, 80] });
        y += 2;
      });
      y += 2;
    }

    const validExp = (experience || []).filter(e => e.school);
    if (validExp.length) {
      sectionHeader('Teaching Experience');
      validExp.forEach(e => {
        addText(e.role || '', { bold: true, size: 10 });
        addText(`${e.school}  ·  ${e.from || ''} – ${e.to || ''}`, { size: 9, color: [80, 80, 80] });
        if (e.description) addText(e.description, { size: 9, indent: 3 });
        y += 3;
      });
    }

    if (skills?.subjects?.length || skills?.soft_skills?.length) {
      sectionHeader('Skills & Subjects');
      if (skills.subjects?.length) addText('Subjects: ' + skills.subjects.join(', '), { size: 9 });
      if (skills.soft_skills?.length) addText('Skills: ' + skills.soft_skills.join(', '), { size: 9 });
      y += 2;
    }

    if (skills?.languages?.length) {
      sectionHeader('Languages');
      addText(skills.languages.join(', '), { size: 9 });
    }

    const pdfArrayBuffer = doc.output('arraybuffer');
    const pdfUint8 = new Uint8Array(pdfArrayBuffer);
    const fileName = `CV_${(personal.full_name || 'Educator').replace(/\s+/g, '_')}.pdf`;

    // Upload PDF using SDK UploadFile (pass a File object)
    const pdfFile = new File([pdfUint8], fileName, { type: 'application/pdf' });
    const { file_url: pdfUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file: pdfFile });

    const name = personal.full_name || 'Educator';
    const downloadLink = pdfUrl;

    const emailBody = `<p>Hi ${name},</p>
<p>Your professional teaching CV has been generated successfully. Click the button below to download your PDF:</p>
<p style="margin: 24px 0;">
  <a href="${downloadLink}" target="_blank" rel="noopener noreferrer" style="background-color: #14a078; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">
    Download My CV (PDF)
  </a>
</p>
<p>If the button doesn't work, copy and paste this link into your browser:<br/><a href="${pdfUrl}">${pdfUrl}</a></p>
<p>Best regards,<br/>The Transfer SA Team</p>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: personal.email,
      subject: 'Your Teaching CV is Ready – Download Your PDF',
      body: emailBody,
    });

    return Response.json({ success: true, pdf_url: pdfUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});