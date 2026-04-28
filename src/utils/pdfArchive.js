import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { uploadGLPIDocument } from './glpiClient';

/**
 * Gera um PDF a partir de um elemento HTML e envia para o GLPI
 * @param {HTMLElement} element - O elemento que contém o Voucher
 * @param {string} filename - Nome do arquivo (ex: TERMO-2024-001.pdf)
 * @param {number} ticketId - ID do ticket no GLPI para vincular
 */
export async function generateAndUploadPDF(element, filename, ticketId = null) {
  try {
    // 1. Captura o HTML como canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Aumenta a qualidade
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    
    // 2. Cria o PDF (A4)
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    
    // 3. Converte para Blob
    const pdfBlob = pdf.output('blob');
    
    // 4. Faz o upload para o GLPI
    console.log(`Subindo documento ${filename} para o GLPI...`);
    const result = await uploadGLPIDocument(pdfBlob, filename, ticketId);
    
    return result;
  } catch (error) {
    console.error('Erro na automação de PDF para GLPI:', error);
    throw error;
  }
}
