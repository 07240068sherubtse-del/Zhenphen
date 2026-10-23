const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

async function createReceiptPdf(files) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Lower Zangtolperi 108 Chorten - Bills and receipts');
  pdf.setSubject('Original project bills and receipts, including supplied credit notes');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const [index, file] of files.entries()) {
    if (file.mime_type === 'application/pdf') {
      const source = await PDFDocument.load(file.content);
      const pages = await pdf.copyPages(source, source.getPageIndices());
      pages.forEach(page => pdf.addPage(page));
      continue;
    }
    const image = file.mime_type === 'image/png' ? await pdf.embedPng(file.content) : await pdf.embedJpg(file.content);
    const page = pdf.addPage([595.28, 841.89]);
    page.drawText('Painting of Lower Zangtolperi 108 Chorten', { x: 36, y: 805, font, size: 12, color: rgb(0.1, 0.24, 0.2) });
    const label = /credit note/i.test(file.caption || '') ? 'Credit note (sales return)' : 'Bill / receipt';
    page.drawText(`${label} - document ${index + 1} of ${files.length}`, { x: 36, y: 783, font, size: 10 });
    const scale = Math.min(523.28 / image.width, 706 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    page.drawImage(image, { x: (595.28 - width) / 2, y: 58 + (706 - height) / 2, width, height });
    page.drawText('Original supplied evidence - figures are shown as recorded on each document.', { x: 36, y: 27, font, size: 8, color: rgb(0.35, 0.35, 0.35) });
  }
  return Buffer.from(await pdf.save());
}

module.exports = { createReceiptPdf };
