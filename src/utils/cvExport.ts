export async function exportElementAsPDF(element: HTMLElement, filename = 'CV.pdf'): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

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
      const clonedRoot = clonedDoc.querySelector('.cv-export-root');
      if (!clonedRoot) return;

      // 1. Skill chips / bubbles: use inline-block with baseline to align text properly
      const bubbles = clonedRoot.querySelectorAll('span[style*="border-radius"], .bubble, .skill-chip');
      bubbles.forEach((bubble: HTMLElement) => {
        bubble.style.display = 'inline-block';
        bubble.style.verticalAlign = 'baseline';
        bubble.style.lineHeight = '1.3';
        bubble.style.padding = '6px 12px';
      });

      // 2. Section headings: keep flex but adjust line-height and vertical-align
      const sectionHeaders = clonedRoot.querySelectorAll('[style*="display: flex; align-items: center; gap"]');
      sectionHeaders.forEach((header: HTMLElement) => {
        const spans = header.querySelectorAll('span');
        spans.forEach((span: HTMLElement) => {
          span.style.lineHeight = '1';
          span.style.verticalAlign = 'baseline';
        });
      });

      // 3. Sidebar items: restore inline-flex with center alignment (was broken by previous changes)
      const sidebarItems = clonedRoot.querySelectorAll('.sidebar-item');
      sidebarItems.forEach((item: HTMLElement) => {
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '6px';
      });
      const sidebarIcons = clonedRoot.querySelectorAll('.sidebar-icon, [style*="display: inline-flex; align-items: center; gap: 6px"] span:first-child');
      sidebarIcons.forEach((icon: HTMLElement) => {
        icon.style.display = 'inline-flex';
        icon.style.alignItems = 'center';
        icon.style.verticalAlign = 'middle';
      });

      // 4. Override any remaining inline-flex that might cause issues
      const allInlineFlex = clonedRoot.querySelectorAll('[style*="display: inline-flex"]');
      allInlineFlex.forEach((el: HTMLElement) => {
        if (el.style.display === 'inline-flex' && !el.classList.contains('sidebar-icon')) {
          el.style.display = 'inline-block';
          el.style.verticalAlign = 'baseline';
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