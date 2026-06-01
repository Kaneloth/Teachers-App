export async function exportElementAsPDF(element: HTMLElement | null, filename: string): Promise<Blob> {
  if (!element) throw new Error('No element to export');

  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF } = await import('jspdf');

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth * ratio, imgHeight * ratio);

  return pdf.output('blob');
}
