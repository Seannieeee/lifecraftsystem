import type { Tutorial } from '@/lib/first-aid-utils';

export async function generateFirstAidCertificate(user: any, tutorial: Tutorial): Promise<void> {
  // Load jsPDF library
  const loadScript = () => {
    return new Promise((resolve, reject) => {
      if ((window as any).jspdf) {
        resolve(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Failed to load PDF library'));
      document.head.appendChild(script);
    });
  };

  await loadScript();
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Decorative double border (black)
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(2);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);
  doc.setLineWidth(0.5);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

  // Corner decorations
  const cornerSize = 15;
  const corners = [
    { x: 15, y: 15 }, // top-left
    { x: pageWidth - 15, y: 15 }, // top-right
    { x: 15, y: pageHeight - 15 }, // bottom-left
    { x: pageWidth - 15, y: pageHeight - 15 } // bottom-right
  ];
  
  doc.setLineWidth(1);
  corners.forEach((corner) => {
    if (corner.x === 15) {
      // Left corners
      doc.line(corner.x, corner.y, corner.x + cornerSize, corner.y);
      doc.line(corner.x, corner.y, corner.x, corner.y + (corner.y === 15 ? cornerSize : -cornerSize));
    } else {
      // Right corners
      doc.line(corner.x, corner.y, corner.x - cornerSize, corner.y);
      doc.line(corner.x, corner.y, corner.x, corner.y + (corner.y === 15 ? cornerSize : -cornerSize));
    }
  });

  // LifeCraft Header
  let yPos = 35;
  doc.setFontSize(40);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('LifeCraft', pageWidth / 2, yPos, { align: 'center' });

  yPos += 10;
  doc.setFontSize(14);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'italic');
  doc.text('Emergency Preparedness & First Aid Training', pageWidth / 2, yPos, { align: 'center' });

  // Certificate Title
  yPos += 22;
  doc.setFontSize(32);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICATE OF COMPLETION', pageWidth / 2, yPos, { align: 'center' });

  // Decorative line under title
  yPos += 5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8);
  const lineWidth = 100;
  doc.line((pageWidth - lineWidth) / 2, yPos, (pageWidth + lineWidth) / 2, yPos);

  // Small decorative elements on line
  const centerX = pageWidth / 2;
  doc.circle(centerX, yPos, 1.5, 'F');
  doc.circle(centerX - lineWidth / 2, yPos, 1, 'F');
  doc.circle(centerX + lineWidth / 2, yPos, 1, 'F');

  // "This is to certify that"
  yPos += 15;
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'italic');
  doc.text('This is to certify that', pageWidth / 2, yPos, { align: 'center' });

  // User Name
  yPos += 14;
  doc.setFontSize(36);
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bolditalic');
  const userName = user.profiles?.full_name || 'Unknown User';
  doc.text(userName, pageWidth / 2, yPos, { align: 'center' });

  // Elegant underline for name
  const nameWidth = doc.getTextWidth(userName);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line((pageWidth - nameWidth - 10) / 2, yPos + 2, (pageWidth + nameWidth + 10) / 2, yPos + 2);

  yPos += 14;
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'italic');
  doc.text('has successfully completed the training course', pageWidth / 2, yPos, { align: 'center' });

  // Tutorial Title
  yPos += 13;
  doc.setFontSize(24);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(tutorial.title, pageWidth / 2, yPos, { align: 'center' });

  // Details Box
  yPos += 18;
  const boxWidth = 140;
  const boxHeight = 30;
  const boxX = (pageWidth - boxWidth) / 2;
  
  // Box border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(boxX, yPos, boxWidth, boxHeight);
  
  // Dividing lines
  doc.line(boxX, yPos + 10, boxX + boxWidth, yPos + 10);
  doc.line(boxX, yPos + 20, boxX + boxWidth, yPos + 20);
  doc.line(boxX + boxWidth / 2, yPos, boxX + boxWidth / 2, yPos + boxHeight);

  yPos += 7;
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  
  // Left column
  doc.text('Category:', boxX + 5, yPos);
  doc.text('Difficulty:', boxX + 5, yPos + 10);
  doc.text('Duration:', boxX + 5, yPos + 20);

  // Right column values
  doc.setFont('helvetica', 'normal');
  doc.text(tutorial.category || 'N/A', boxX + boxWidth / 2 + 5, yPos);
  doc.text(tutorial.difficulty || 'N/A', boxX + boxWidth / 2 + 5, yPos + 10);
  doc.text(tutorial.duration || 'N/A', boxX + boxWidth / 2 + 5, yPos + 20);

  // Completion Date
  yPos += 33;
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  const completionDate = new Date(user.completion_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(`Awarded on ${completionDate}`, pageWidth / 2, yPos, { align: 'center' });

  // Signatures
  yPos += 18;
  const sigWidth = 60;
  const leftSigX = (pageWidth / 2) - sigWidth - 15;
  const rightSigX = (pageWidth / 2) + 15;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(leftSigX, yPos, leftSigX + sigWidth, yPos);
  doc.line(rightSigX, yPos, rightSigX + sigWidth, yPos);
  
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.text('Authorized Signature', leftSigX + (sigWidth / 2), yPos + 6, { align: 'center' });
  doc.text('Date of Issue', rightSigX + (sigWidth / 2), yPos + 6, { align: 'center' });
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text('LifeCraft Training', leftSigX + (sigWidth / 2), yPos + 11, { align: 'center' });
  doc.text(completionDate, rightSigX + (sigWidth / 2), yPos + 11, { align: 'center' });

  // Official seal placeholder (decorative circle)
  const sealX = pageWidth / 2;
  const sealY = yPos + 15;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1);
  doc.circle(sealX, sealY, 8);
  doc.setLineWidth(0.3);
  doc.circle(sealX, sealY, 6);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text('OFFICIAL', sealX, sealY - 1, { align: 'center' });
  doc.text('CERTIFICATE', sealX, sealY + 2, { align: 'center' });

  // Certificate ID and footer
  yPos = pageHeight - 20;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  const certId = `LCFA-${tutorial.id.substring(0, 8).toUpperCase()}-${user.user_id.substring(0, 8).toUpperCase()}`;
  doc.text(`Certificate ID: ${certId}`, pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 4;
  doc.setFontSize(7);
  doc.text('This certificate verifies completion of the training program and is valid for official records.', pageWidth / 2, yPos, { align: 'center' });

  // Save PDF
  const fileName = `LifeCraft_Certificate_${userName.replace(/\s+/g, '_')}_${tutorial.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  doc.save(fileName);
}