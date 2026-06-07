import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Exports an element to a multi‑page PDF.
 * If a `.references-page` element is found, it is placed on a separate page at the end.
 */
export async function exportElementAsPDF(element: HTMLElement, filename = 'CV.pdf'): Promise<Blob> {
  const referencesDiv = element.querySelector('.references-page') as HTMLElement | null;

  if (!referencesDiv) {
    // No references section – use original single‑canvas method
    return originalExport(element, filename);
  }

  try {
    // 1. Hide the references section temporarily
    const originalDisplay = referencesDiv.style.display;
    referencesDiv.style.display = 'none';

    // 2. Render the main content (without references)
    const mainCanvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // 3. Restore references visibility
    referencesDiv.style.display = originalDisplay;

    // 4. Render only the references section (it may be tall, so it will be split into multiple pages if needed)
    const refCanvas = await html2canvas(referencesDiv, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // 5. Build PDF
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

    // Main content
    addCanvasToPDF(mainCanvas);

    // References on a new page
    pdf.addPage();
    addCanvasToPDF(refCanvas);

    pdf.save(filename);
    return pdf.output('blob');
  } catch (err) {
    console.error('PDF generation with page separation failed:', err);
    // Fallback to original method
    return originalExport(element, filename);
  }
}

/**
 * Original export method (single canvas, no forced page break)
 */
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