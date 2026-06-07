export async function exportElementAsPDF(element: HTMLElement, filename = 'CV.pdf'): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  // Get actual dimensions
  const width = element.scrollWidth;
  const height = element.scrollHeight;

  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    logging: true,
    backgroundColor: '#ffffff',
    windowWidth: width,
    windowHeight: height,
    onclone: (clonedDoc, element) => {
      // Locate the root of the CV inside the cloned document
      const clonedRoot = clonedDoc.querySelector('.cv-export-root');
      if (!clonedRoot) return;

      // Fix bubbles / skill chips
      const bubbles = clonedRoot.querySelectorAll('span[style*="border-radius"], .bubble, .skill-chip');
      bubbles.forEach((bubble: HTMLElement) => {
        bubble.style.display = 'inline-flex';
        bubble.style.alignItems = 'center';
        bubble.style.verticalAlign = 'middle';
        bubble.style.lineHeight = '1.3';
        bubble.style.padding = '6px 12px';   // ensure consistent padding
      });

      // Fix section headings (icons + text)
      const sectionHeaders = clonedRoot.querySelectorAll('[style*="display: flex; align-items: center; gap"]');
      sectionHeaders.forEach((header: HTMLElement) => {
        // Force the icon container and text to have same line-height
        const spans = header.querySelectorAll('span');
        spans.forEach((span: HTMLElement) => {
          span.style.lineHeight = '1';
          span.style.verticalAlign = 'middle';
        });
      });

      // Fix sidebar icons
      const sidebarIcons = clonedRoot.querySelectorAll('.sidebar-icon, [style*="display: inline-flex; align-items: center; gap: 6px"] span:first-child');
      sidebarIcons.forEach((icon: HTMLElement) => {
        icon.style.display = 'inline-flex';
        icon.style.alignItems = 'center';
        icon.style.verticalAlign = 'middle';
        icon.style.lineHeight = '1';
      });
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'px', format: 'a4', orientation: 'portrait' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const canvasRatio = canvas.height / canvas.width;
  const imgHeight = pageWidth * canvasRatio;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, pageWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
  return pdf.output('blob');
}