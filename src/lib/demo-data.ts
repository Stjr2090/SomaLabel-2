/**
 * Demo sample medicine label images generated client-side via Canvas.
 * Allows instant testing of all flows:
 * 1. Paracetamol 500mg (Valid expiry, Registered NDA pack)
 * 2. Coartem 20/120mg (Expiring soon, Registered NDA pack)
 * 3. Expired Amoxicillin (Expired date, unregistered pack)
 * 4. Blurry unreadable label (triggers readability warning)
 */

export interface DemoSample {
  id: string;
  title: string;
  subtitle: string;
  expectedOutcome: string;
  generateImage: () => string; // returns base64 JPEG
}

function createLabelCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function generateParacetamolDemoLabel(): string {
  const [canvas, ctx] = createLabelCanvas(900, 560);

  // Background - medicine pack box style
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 900, 560);

  // Top header bar (Hospital green)
  ctx.fillStyle = '#047857';
  ctx.fillRect(0, 0, 900, 110);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('KAMPALA PHARMACEUTICALS', 40, 65);

  ctx.font = 'normal 18px sans-serif';
  ctx.fillText('Essential Medicines Uganda • Quality Assured', 40, 95);

  // Brand Name
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 68px sans-serif';
  ctx.fillText('PARACETAMOL', 40, 200);

  // Strength & Dosage Form
  ctx.fillStyle = '#047857';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('500 mg Tablets BP', 40, 255);

  // Active ingredient
  ctx.fillStyle = '#334155';
  ctx.font = 'normal 22px sans-serif';
  ctx.fillText('Each uncoated tablet contains: Paracetamol BP 500 mg', 40, 300);

  // Indications & Dosage printed
  ctx.fillStyle = '#1e293b';
  ctx.font = 'normal 20px sans-serif';
  ctx.fillText('Indications: Mild to moderate pain, headache, and fever.', 40, 345);
  ctx.fillText('Directions: Adults: 1 to 2 tablets every 4 to 6 hours with water. Max 8 tablets daily.', 40, 375);

  // Warning box
  ctx.fillStyle = '#fef2f2';
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(40, 400, 820, 55, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('WARNING: Do not exceed recommended dose. Keep out of reach of children.', 55, 435);

  // Batch & Expiry Strip at bottom
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 475, 900, 85);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('B.No: KPI-84920', 40, 515);
  ctx.fillText('MFD: 04/2024', 280, 515);
  ctx.fillText('EXP 03/2027', 480, 515);
  ctx.fillText('Reg: NDA/MAL/HPD/0189', 660, 515);

  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
}

export function generateCoartemDemoLabel(): string {
  const [canvas, ctx] = createLabelCanvas(900, 560);

  // Yellow & Orange anti-malarial pack
  ctx.fillStyle = '#fffbeb';
  ctx.fillRect(0, 0, 900, 560);

  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, 0, 900, 110);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('QUALITY CHEMICAL INDUSTRIES LTD (QCIL)', 40, 65);
  ctx.font = 'normal 18px sans-serif';
  ctx.fillText('Luzira Industrial Park, Kampala, Uganda', 40, 95);

  ctx.fillStyle = '#78350f';
  ctx.font = '900 64px sans-serif';
  ctx.fillText('COARTEM 20/120', 40, 200);

  ctx.fillStyle = '#b45309';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('Artemether 20mg / Lumefantrine 120mg Dispersible', 40, 250);

  ctx.fillStyle = '#1e293b';
  ctx.font = 'normal 21px sans-serif';
  ctx.fillText('For treatment of acute uncomplicated Plasmodium falciparum malaria.', 40, 300);
  ctx.fillText('Directions: Take with high-fat food or milk. Complete full 3-day course.', 40, 335);

  // Warnings
  ctx.fillStyle = '#fef3c7';
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(40, 370, 820, 60, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#92400e';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('CAUTION: Do not use for prevention of malaria. Consult doctor if symptoms persist.', 55, 408);

  // Bottom strip with NOV 2026 expiry (within 90 days from Oct 2, 2026)
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(0, 465, 900, 95);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('BATCH: QCL-7701', 40, 520);
  ctx.fillText('MFG: 11/2024', 280, 520);
  ctx.fillText('EXP: NOV 2026', 480, 520);
  ctx.fillText('NDA: NDA/MAL/HPD/0421', 650, 520);

  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
}

export function generateExpiredAmoxicillinDemoLabel(): string {
  const [canvas, ctx] = createLabelCanvas(900, 560);

  ctx.fillStyle = '#eff6ff';
  ctx.fillRect(0, 0, 900, 560);

  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, 900, 110);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('ABACUS HEALTHCARE UGANDA', 40, 65);
  ctx.font = 'normal 18px sans-serif';
  ctx.fillText('Plot 28B, Mukono, Uganda', 40, 95);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = '900 66px sans-serif';
  ctx.fillText('AMOXICILLIN 250mg', 40, 200);

  ctx.fillStyle = '#2563eb';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('Capsules BP • Antibiotic', 40, 250);

  ctx.fillStyle = '#334155';
  ctx.font = 'normal 21px sans-serif';
  ctx.fillText('Each capsule contains: Amoxicillin Trihydrate equivalent to 250mg Amoxicillin', 40, 300);
  ctx.fillText('Directions: Take one capsule 3 times daily (every 8 hours) with plenty of water.', 40, 340);

  ctx.fillStyle = '#fee2e2';
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(40, 380, 820, 60, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('WARNING: Complete prescribed course. Contraindicated in penicillin allergy.', 55, 418);

  // Bottom strip: Expired (12.05.2026) and unlisted registration
  ctx.fillStyle = '#fee2e2';
  ctx.fillRect(0, 465, 900, 95);

  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('B.NO: ABX-3310', 40, 520);
  ctx.fillText('MFD: 12.05.2023', 280, 520);
  ctx.fillText('EXP: 12.05.2026', 480, 520);
  ctx.fillText('REG: UG/MED/9981-SAMPLE', 650, 520);

  return canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
}

export function generateBlurryDemoLabel(): string {
  const [canvas, ctx] = createLabelCanvas(900, 560);

  // Very dim, smeared, out-of-focus background
  ctx.fillStyle = '#64748b';
  ctx.fillRect(0, 0, 900, 560);

  ctx.fillStyle = '#475569';
  ctx.filter = 'blur(16px)';
  ctx.fillRect(100, 80, 700, 400);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'italic 40px sans-serif';
  ctx.fillText('/// [UNCLEAR BLURRED SURFACE] ///', 120, 280);

  return canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
}

export const DEMO_SAMPLES: DemoSample[] = [
  {
    id: 'paracetamol',
    title: 'Paracetamol 500mg',
    subtitle: 'Kampala Pharma • Valid Expiry • Registered NDA',
    expectedOutcome: 'Valid (Green) • Matched (Green)',
    generateImage: generateParacetamolDemoLabel,
  },
  {
    id: 'coartem',
    title: 'Coartem 20/120mg',
    subtitle: 'QCIL Dispersible • Expires NOV 2026 • Registered NDA',
    expectedOutcome: 'Expires within 90 days (Amber) • Matched (Green)',
    generateImage: generateCoartemDemoLabel,
  },
  {
    id: 'amoxicillin_expired',
    title: 'Amoxicillin 250mg',
    subtitle: 'Abacus • Expired 12.05.2026 • Unregistered Code',
    expectedOutcome: 'Expired (Red) • Not in our list (Amber)',
    generateImage: generateExpiredAmoxicillinDemoLabel,
  },
  {
    id: 'blurry_unreadable',
    title: 'Blurry / Unclear Photo',
    subtitle: 'Low light / motion blur demo',
    expectedOutcome: "Couldn't read clearly (Retry state)",
    generateImage: generateBlurryDemoLabel,
  },
];
