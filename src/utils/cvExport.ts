import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Renders an HTML element to a multi‑page PDF.
 * If a `.references-page` element is found, it is rendered on a separate page.
 */
export async function exportElementAsPDF(element: HTMLElement, filename = 'CV.pdf'): Promise<Blob> {
  // Check for references container
  const referencesDiv = element.querySelector('.references-page') as HTMLElement | null;

  if (!referencesDiv) {
    // Fallback: original method without page separation
    return originalExport(element, filename);
  }

  try {
    // Clone the element to avoid modifying the live DOM
    const cloneRoot = element.cloneNode(true) as HTMLElement;
    const cloneReferences = cloneRoot.querySelector('.references-page');
    if (cloneReferences) cloneReferences.remove();

    // Render main content (without references)
    const mainCanvas = await html2canvas(cloneRoot, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Render only the references container
    const refCanvas = await html2canvas(referencesDiv, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({ unit: 'px', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Helper to add a canvas (possibly multi‑page) to the PDF
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

    // 1. Main content
    addCanvasToPDF(mainCanvas);

    // 2. References – always on a new page
    pdf.addPage();
    addCanvasToPDF(refCanvas);

    pdf.save(filename);
    return pdf.output('blob');
  } catch (err) {
    console.error('PDF generation failed:', err);
    // Fallback to original method
    return originalExport(element, filename);
  }
}

/**
 * Original export method (no forced page break)
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