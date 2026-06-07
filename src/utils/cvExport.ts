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

      // Fix bubbles / skill chips: use inline-block + bottom alignment
      const bubbles = clonedRoot.querySelectorAll('span[style*="border-radius"], .bubble, .skill-chip');
      bubbles.forEach((bubble: HTMLElement) => {
        bubble.style.display = 'inline-block';
        bubble.style.verticalAlign = 'bottom';
        bubble.style.lineHeight = '1.3';
        bubble.style.padding = '6px 12px';
        bubble.style.margin = '0';
      });

      // Fix section headings (icons + text): force inline-block + bottom
      const sectionHeaders = clonedRoot.querySelectorAll('[style*="display: flex; align-items: center; gap"]');
      sectionHeaders.forEach((header: HTMLElement) => {
        const spans = header.querySelectorAll('span');
        spans.forEach((span: HTMLElement) => {
          span.style.display = 'inline-block';
          span.style.verticalAlign = 'bottom';
          span.style.lineHeight = '1';
        });
        // Also fix the divider line (it should stay as flex)
        const divider = header.querySelector('div[style*="flex: 1"]');
        if (divider) {
          divider.style.display = 'block';
          divider.style.flex = 'none';
        }
      });

      // Fix sidebar icons: inline-block + bottom
      const sidebarIcons = clonedRoot.querySelectorAll('.sidebar-icon, [style*="display: inline-flex; align-items: center; gap: 6px"] span:first-child');
      sidebarIcons.forEach((icon: HTMLElement) => {
        icon.style.display = 'inline-block';
        icon.style.verticalAlign = 'bottom';
        icon.style.lineHeight = '1';
      });

      // Ensure any remaining inline-flex elements inside the CV are forced to inline-block
      const allInlineFlex = clonedRoot.querySelectorAll('[style*="display: inline-flex"]');
      allInlineFlex.forEach((el: HTMLElement) => {
        if (el.style.display === 'inline-flex') {
          el.style.display = 'inline-block';
          el.style.verticalAlign = 'bottom';
        }
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