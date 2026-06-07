export async function exportElementAsPDF(element: HTMLElement, filename = 'CV.pdf'): Promise<Blob> {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');

  // Get actual dimensions of the element
  const width = element.scrollWidth;
  const height = element.scrollHeight;

  const canvas = await html2canvas(element, {
    scale: 3,                   // better fidelity
    useCORS: true,
    logging: true,              // see warnings in console
    backgroundColor: '#ffffff',
    windowWidth: width,
    windowHeight: height,
    onclone: (clonedDoc, element) => {
      // Force cloned element to preserve alignment
      const clonedRoot = clonedDoc.querySelector('.cv-root'); // add a class to your CV container
      if (clonedRoot) {
        // Reset any problematic transforms
        clonedRoot.style.transform = 'none';
        clonedRoot.style.willChange = 'auto';
      }
    },
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ unit: 'px', format: 'a4', orientation: 'portrait' });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Calculate image dimensions while preserving aspect ratio
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