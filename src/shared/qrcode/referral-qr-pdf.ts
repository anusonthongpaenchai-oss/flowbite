export async function createQrPdf(svg: SVGSVGElement): Promise<Blob> {
  const size = 512;
  const image = new Image();
  image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.outerHTML);
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to render the QR code.');
  context.fillStyle = 'white';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);
  const jpeg = atob(canvas.toDataURL('image/jpeg', 1).split(',')[1]);
  const imageStream =
    Array.from(jpeg, (byte) => byte.charCodeAt(0).toString(16).padStart(2, '0')).join('') + '>';

  const content = 'q 192 0 0 192 24 24 cm /QR Do Q';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 240 240] ' +
      '/Resources << /XObject << /QR 4 0 R >> >> /Contents 5 0 R >>',
    `<< /Type /XObject /Subtype /Image /Width ${size} /Height ${size} /ColorSpace /DeviceRGB ` +
      `/BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${imageStream.length} >>\n` +
      `stream\n${imageStream}\nendstream`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  // The document is ASCII, so string positions are also PDF byte offsets.
  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset.toString().padStart(10, '0');
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${offset} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return new Blob([pdf], { type: 'application/pdf' });
}
