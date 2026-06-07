export async function exportElementAsPDF(element: HTMLElement, filename = 'CV.pdf'): Promise<Blob> {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');

    const width = element.scrollWidth;
    const height = element.scrollHeight;

    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: width,
      windowHeight: height,
      onclone: (clonedDoc, element) => {
        try {
          const clonedRoot = clonedDoc.querySelector('.cv-export-root');
          if (!clonedRoot) return;

          // Apply fixes only if needed (optional – you can comment out this block first)
          const bubbles = clonedRoot.querySelectorAll('span[style*="border-radius"], .bubble, .skill-chip');
          bubbles.forEach((bubble: HTMLElement) => {
            bubble.style.display = 'inline-block';
            bubble.style.verticalAlign = 'baseline';
          });
        } catch (err) {
          console.warn('onclone error:', err);
        }
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
  } catch (err) {
    console.error('PDF generation failed:', err);
    throw new Error('Failed to generate PDF: ' + (err as Error).message);
  }
}