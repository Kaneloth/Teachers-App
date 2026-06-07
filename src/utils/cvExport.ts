import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function exportElementAsPDF(element: HTMLElement, filename = 'CV.pdf'): Promise<Blob> {
  const referencesDiv = element.querySelector('.references-page') as HTMLElement | null;

  if (!referencesDiv) {
    // Fallback: render the whole element as one canvas
    return originalExport(element, filename);
  }

  try {
    // 1. Hide references, render main content
    const originalDisplay = referencesDiv.style.display;
    referencesDiv.style.display = 'none';

    const mainCanvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    referencesDiv.style.display = originalDisplay;

    // 2. Render only the references section
    const refCanvas = await html2canvas(referencesDiv, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({ unit: 'px', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const addCanvasToPDF = (canvas: HTMLCanvasElement) => {
      const imgData = canvas.toDataURL('image/png');
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
    };

    addCanvasToPDF(mainCanvas);
    pdf.addPage();               // force a new page before references
    addCanvasToPDF(refCanvas);

    pdf.save(filename);
    return pdf.output('blob');
  } catch (err) {
    console.error('PDF generation with separate references failed:', err);
    return originalExport(element, filename);
  }
}

async function originalExport(element: HTMLElement, filename: string): Promise<Blob> {
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
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