import type { OcrTier } from '@/hooks/use-organization-settings';
import * as pdfjs from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export type ServiceRecordFieldKey =
  | 'service_name'
  | 'serviced_at'
  | 'odometer_km'
  | 'vendor_name'
  | 'vendor_location'
  | 'cost'
  | 'notes'
  | 'serial_number'
  | 'warranty_expiry';

export interface ServiceRecordFieldCandidate {
  value: string | number;
  score: number; // 0..100
  reason: string;
}

export interface ServiceRecordFieldResult {
  value?: string | number;
  confidence: number; // 0..100
  candidates: ServiceRecordFieldCandidate[];
}

export interface ServiceRecordLineItem {
  name: string;
  serialNumber?: string;
  warrantyExpiry?: string; // yyyy-mm-dd
  kind: 'part' | 'labor';
}

export interface ServiceRecordOcrResult {
  rawText: string;
  normalizedText: string;
  ocrConfidence: number;
  parsingConfidence: number;
  needsReview: boolean;
  sourceType: 'image' | 'pdf';
  fieldResults: Record<ServiceRecordFieldKey, ServiceRecordFieldResult>;
  lineItems: ServiceRecordLineItem[];
  fields: {
    service_name?: string;
    serviced_at?: string; // yyyy-mm-dd
    odometer_km?: number;
    vendor_name?: string;
    vendor_location?: string;
    cost?: number;
    notes?: string;
    serial_number?: string;
    warranty_expiry?: string; // yyyy-mm-dd
  };
  warnings: string[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeOcrText(raw: string): string {
  let text = raw.replace(/\r/g, '');
  text = text.replace(/[|¦]/g, 'I');
  text = text.replace(/₹\s*/g, '₹ ');
  text = text.replace(/[ \t]+/g, ' ');
  text = text
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .join('\n');
  return text.trim();
}

function toIsoDate(candidate: string): string | undefined {
  const c = candidate.trim();
  const dmy = c.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${month}-${day}`;
  }
  const ymd = c.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }
  return undefined;
}

function containsAny(line: string, keywords: string[]): boolean {
  const lower = line.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

const STRONG_TOTAL_LABELS = ['grand total', 'net amount', 'total amount', 'amount payable', 'final total'];
const WEAK_TOTAL_LABELS = ['total', 'amount due', 'paid amount', 'bill amount'];
const NON_TOTAL_HINTS = ['qty', 'quantity', 'rate', 'unit', 'disc', 'discount', 'hsn', 'sac', 'taxable', 'gst'];

function scoreCostCandidate(context: string, value: number): number {
  let score = 55;
  if (containsAny(context, STRONG_TOTAL_LABELS)) score += 42;
  else if (containsAny(context, WEAK_TOTAL_LABELS)) score += 24;
  if (containsAny(context, NON_TOTAL_HINTS)) score -= 26;
  if (value <= 5) score -= 40;
  else if (value < 50) score -= 18;
  return Math.max(0, Math.min(99, score));
}

function uniqCandidates(candidates: ServiceRecordFieldCandidate[]): ServiceRecordFieldCandidate[] {
  const map = new Map<string, ServiceRecordFieldCandidate>();
  for (const c of candidates) {
    const key = String(c.value).toLowerCase();
    const existing = map.get(key);
    if (!existing || c.score > existing.score) {
      map.set(key, c);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score).slice(0, 5);
}

function resultFromCandidates(candidates: ServiceRecordFieldCandidate[]): ServiceRecordFieldResult {
  const sorted = uniqCandidates(candidates);
  return {
    value: sorted[0]?.value,
    confidence: Math.max(0, Math.min(100, Math.round(sorted[0]?.score ?? 0))),
    candidates: sorted,
  };
}

function extractFieldCandidates(normalizedText: string): Record<ServiceRecordFieldKey, ServiceRecordFieldCandidate[]> {
  const text = normalizedText;
  const lines = text
    .split('\n')
    .map((l) => normalizeWhitespace(l))
    .filter(Boolean);

  const out: Record<ServiceRecordFieldKey, ServiceRecordFieldCandidate[]> = {
    service_name: [],
    serviced_at: [],
    odometer_km: [],
    vendor_name: [],
    vendor_location: [],
    cost: [],
    notes: [],
    serial_number: [],
    warranty_expiry: [],
  };

  for (const [idx, line] of lines.entries()) {
    const prev = idx > 0 ? lines[idx - 1] : '';
    const next = idx < lines.length - 1 ? lines[idx + 1] : '';
    const context = `${prev} ${line} ${next}`.toLowerCase();

    // service_name
    if (
      /service|oil|brake|battery|tyre|tire|filter|alignment|repair|inspection|maintenance/i.test(line) &&
      line.length <= 120
    ) {
      out.service_name.push({
        value: line,
        score: containsAny(line, ['service', 'maintenance']) ? 82 : 70,
        reason: 'Matched service keyword line',
      });
    }

    // vendor_name
    if (
      /motors|garage|workshop|service center|autocare|automotive|diesel|petrol|agency|enterprises|traders/i.test(line) &&
      line.length <= 120
    ) {
      out.vendor_name.push({
        value: line,
        score: 85,
        reason: 'Matched vendor/company keyword line',
      });
    }

    // vendor_location
    if (
      /road|rd\.?|street|st\.?|nagar|chowk|city|state|gujarat|india|pin|pincode|near/i.test(line) &&
      line.length <= 140
    ) {
      out.vendor_location.push({
        value: line,
        score: 66,
        reason: 'Matched address/location pattern',
      });
    }

    // serviced_at & warranty_expiry
    const dateMatches = line.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/g) || [];
    for (const m of dateMatches) {
      const iso = toIsoDate(m);
      if (!iso) continue;
      if (/warranty|expiry|expires|valid\s*till|validity/i.test(context)) {
        out.warranty_expiry.push({
          value: iso,
          score: 83,
          reason: 'Date near warranty/expiry label',
        });
      } else {
        out.serviced_at.push({
          value: iso,
          score: containsAny(line, ['date', 'invoice', 'bill']) ? 82 : 65,
          reason: 'Date candidate from OCR text',
        });
      }
    }

    // odometer_km
    const kmMatches = line.match(/([0-9]{2,3}(?:[,.\s][0-9]{3})+|[0-9]{4,8})\s*(?:km|kms)\b/gi) || [];
    for (const km of kmMatches) {
      const n = Number((km.match(/[0-9,.\s]+/)?.[0] || '').replace(/[,\.\s]/g, ''));
      if (Number.isFinite(n) && n >= 1000 && n <= 2000000) {
        out.odometer_km.push({
          value: n,
          score: /odometer|odo|mileage|reading/i.test(context) ? 92 : 80,
          reason: 'Numeric value with km/kms marker',
        });
      }
    }
    const odoLabelMatch = line.match(
      /(?:odometer|odo|mileage|km\s*reading|reading)\D{0,20}([0-9]{2,3}(?:[,.\s][0-9]{3})+|[0-9]{4,8})/i
    );
    if (odoLabelMatch) {
      const n = Number((odoLabelMatch[1] || '').replace(/[,\.\s]/g, ''));
      if (Number.isFinite(n) && n >= 1000 && n <= 2000000) {
        out.odometer_km.push({
          value: n,
          score: 95,
          reason: 'Numeric value near odometer/reading label',
        });
      }
    }

    // cost
    const amountMatches = line.match(/(?:₹|rs\.?|inr)?\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi) || [];
    for (const rawAmount of amountMatches) {
      const numericPart = rawAmount.match(/[0-9,]+(?:\.[0-9]{1,2})?/)?.[0] ?? '';
      const v = Number(numericPart.replace(/,/g, ''));
      if (!Number.isFinite(v) || v < 0) continue;

      const score = scoreCostCandidate(context, v);
      const strongTotal = containsAny(context, STRONG_TOTAL_LABELS);
      if (!strongTotal && score < 60) continue;

      out.cost.push({
        value: v,
        score,
        reason: strongTotal
          ? 'Amount near strong total label'
          : 'Amount candidate near possible total context',
      });
    }

    // serial_number
    const serialMatch = line.match(/(?:serial|s\/n|sn|chassis|engine\s*no)\D{0,8}([A-Z0-9\-]{4,})/i);
    if (serialMatch?.[1]) {
      out.serial_number.push({
        value: serialMatch[1],
        score: 82,
        reason: 'Matched serial/chassis/engine number label',
      });
    }
  }

  // fallback picks from header lines
  for (const line of lines.slice(0, 6)) {
    if (line.length >= 3 && line.length <= 100 && !/[0-9]{4,}/.test(line)) {
      out.vendor_name.push({
        value: line,
        score: 40,
        reason: 'Header fallback candidate',
      });
    }
  }

  out.notes.push({
    value: lines.slice(0, 12).join(' | ').slice(0, 500),
    score: 80,
    reason: 'Generated notes from top OCR lines',
  });

  // Backstop: prioritize explicit total labels from full text.
  const totalLabelRegex =
    /(?:grand\s*total|net\s*amount|total\s*amount|amount\s*payable|final\s*total)\D{0,20}([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)/gi;
  let tm: RegExpExecArray | null;
  while ((tm = totalLabelRegex.exec(text)) !== null) {
    const v = Number((tm[1] || '').replace(/,/g, ''));
    if (!Number.isFinite(v) || v < 0) continue;
    out.cost.push({
      value: v,
      score: v <= 5 ? 62 : 97,
      reason: 'Matched explicit total label from full OCR text',
    });
  }

  return out;
}

function applyConsistencyChecks(
  fieldCandidates: Record<ServiceRecordFieldKey, ServiceRecordFieldCandidate[]>
): Record<ServiceRecordFieldKey, ServiceRecordFieldCandidate[]> {
  const now = Date.now();
  const adjusted: Record<ServiceRecordFieldKey, ServiceRecordFieldCandidate[]> = {
    service_name: [...fieldCandidates.service_name],
    serviced_at: [...fieldCandidates.serviced_at],
    odometer_km: [...fieldCandidates.odometer_km],
    vendor_name: [...fieldCandidates.vendor_name],
    vendor_location: [...fieldCandidates.vendor_location],
    cost: [...fieldCandidates.cost],
    notes: [...fieldCandidates.notes],
    serial_number: [...fieldCandidates.serial_number],
    warranty_expiry: [...fieldCandidates.warranty_expiry],
  };

  adjusted.serviced_at = adjusted.serviced_at.map((c) => {
    const ms = Date.parse(String(c.value));
    if (Number.isFinite(ms) && ms > now + 24 * 60 * 60 * 1000) {
      return { ...c, score: Math.max(0, c.score - 35), reason: `${c.reason}; penalized future date` };
    }
    return c;
  });

  adjusted.odometer_km = adjusted.odometer_km.map((c) => {
    const n = Number(c.value);
    if (n < 1000 || n > 2000000) {
      return { ...c, score: Math.max(0, c.score - 45), reason: `${c.reason}; penalized implausible odometer` };
    }
    return c;
  });

  adjusted.cost = adjusted.cost.map((c) => {
    const n = Number(c.value);
    if (n <= 0 || n > 10000000) {
      return { ...c, score: Math.max(0, c.score - 40), reason: `${c.reason}; penalized implausible cost` };
    }
    return c;
  });

  return adjusted;
}

function extractLineItems(normalizedText: string): ServiceRecordLineItem[] {
  const lines = normalizedText
    .split('\n')
    .map((l) => normalizeWhitespace(l))
    .filter(Boolean);

  const items: ServiceRecordLineItem[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const lower = line.toLowerCase();
    const isLabor = /labor|labour|service\s*charge|lab\s*charge|fitting\s*charge/i.test(line);
    const looksLikePart =
      /battery|filter|pad|brake|clutch|oil|coolant|plug|belt|bearing|wiper|tyre|tire|spray|bulb|kit|sensor/i.test(line);
    const hasSerialMarker = /serial|s\/n|sn|chassis|engine\s*no/i.test(line);

    if (!isLabor && !looksLikePart && !hasSerialMarker) continue;
    if (line.length < 3 || line.length > 180) continue;
    if (/grand\s*total|net\s*amount|total\s*amount|amount\s*payable|final\s*total/i.test(lower)) continue;

    const serialMatch = line.match(/(?:serial|s\/n|sn|chassis|engine\s*no)\D{0,8}([A-Z0-9\-]{3,})/i);
    const serialNumber = serialMatch?.[1];

    const expiryMatch = line.match(
      /(?:warranty|expiry|expires|valid\s*till|validity)\D{0,10}(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i
    );
    const warrantyExpiry = expiryMatch ? toIsoDate(expiryMatch[1]) : undefined;

    const cleanedName = line
      .replace(/(?:₹|rs\.?|inr)?\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?/gi, ' ')
      .replace(/\b(?:qty|quantity|rate|unit|disc|discount|hsn|sac|gst)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    if (!cleanedName) continue;

    const key = `${isLabor ? 'labor' : 'part'}:${cleanedName.toLowerCase()}:${serialNumber ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      name: cleanedName,
      serialNumber,
      warrantyExpiry,
      kind: isLabor ? 'labor' : 'part',
    });
  }

  return items.slice(0, 20);
}

function toFieldResults(
  candidatesByField: Record<ServiceRecordFieldKey, ServiceRecordFieldCandidate[]>
): Record<ServiceRecordFieldKey, ServiceRecordFieldResult> {
  return {
    service_name: resultFromCandidates(candidatesByField.service_name),
    serviced_at: resultFromCandidates(candidatesByField.serviced_at),
    odometer_km: resultFromCandidates(candidatesByField.odometer_km),
    vendor_name: resultFromCandidates(candidatesByField.vendor_name),
    vendor_location: resultFromCandidates(candidatesByField.vendor_location),
    cost: resultFromCandidates(candidatesByField.cost),
    notes: resultFromCandidates(candidatesByField.notes),
    serial_number: resultFromCandidates(candidatesByField.serial_number),
    warranty_expiry: resultFromCandidates(candidatesByField.warranty_expiry),
  };
}

function fieldResultsToFields(
  fieldResults: Record<ServiceRecordFieldKey, ServiceRecordFieldResult>
): ServiceRecordOcrResult['fields'] {
  return {
    service_name: typeof fieldResults.service_name.value === 'string' ? fieldResults.service_name.value : undefined,
    serviced_at: typeof fieldResults.serviced_at.value === 'string' ? fieldResults.serviced_at.value : undefined,
    odometer_km: typeof fieldResults.odometer_km.value === 'number' ? fieldResults.odometer_km.value : undefined,
    vendor_name: typeof fieldResults.vendor_name.value === 'string' ? fieldResults.vendor_name.value : undefined,
    vendor_location:
      typeof fieldResults.vendor_location.value === 'string' ? fieldResults.vendor_location.value : undefined,
    cost: typeof fieldResults.cost.value === 'number' ? fieldResults.cost.value : undefined,
    notes: typeof fieldResults.notes.value === 'string' ? fieldResults.notes.value : undefined,
    serial_number: typeof fieldResults.serial_number.value === 'string' ? fieldResults.serial_number.value : undefined,
    warranty_expiry:
      typeof fieldResults.warranty_expiry.value === 'string' ? fieldResults.warranty_expiry.value : undefined,
  };
}

function estimateParsingConfidence(fields: ServiceRecordOcrResult['fields']): number {
  let score = 0;
  if (fields.service_name) score += 20;
  if (fields.serviced_at) score += 20;
  if (typeof fields.odometer_km === 'number') score += 15;
  if (fields.vendor_name) score += 15;
  if (typeof fields.cost === 'number' && !Number.isNaN(fields.cost)) score += 20;
  if (fields.notes) score += 10;
  if (fields.serial_number) score += 5;
  if (fields.warranty_expiry) score += 5;
  return Math.min(score, 100);
}

async function runTesseract(input: Blob | File): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const result = await worker.recognize(input);
    const text = result?.data?.text ?? '';
    const confidence = Number(result?.data?.confidence ?? 0);
    return { text, confidence };
  } finally {
    await worker.terminate();
  }
}

async function renderPdfPagesAsImages(file: File, maxPages: number): Promise<Blob[]> {
  // Use a bundled worker URL to avoid runtime CDN/version mismatches (404 fake worker errors).
  (pdfjs as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, Math.max(1, maxPages));
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d5bec10f-8077-42e2-879b-e49c52213b1e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'21bfa3'},body:JSON.stringify({sessionId:'21bfa3',runId:'run1',hypothesisId:'H1',location:'src/lib/ocr-service-record.ts:renderPdfPagesAsImages',message:'PDF image render page cap computed',data:{totalPdfPages:pdf.numPages,requestedMaxPages:maxPages,processedPages:pageCount},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const blobs: Blob[] = [];

  for (let p = 1; p <= pageCount; p += 1) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.4 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context for PDF OCR');

    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
    if (blob) blobs.push(blob);
  }

  if (!blobs.length) throw new Error('Could not convert PDF pages to image');
  return blobs;
}

async function extractPdfTextContent(file: File, maxPages: number): Promise<string> {
  (pdfjs as any).GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = (pdfjs as any).getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, Math.max(1, maxPages));
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d5bec10f-8077-42e2-879b-e49c52213b1e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'21bfa3'},body:JSON.stringify({sessionId:'21bfa3',runId:'run1',hypothesisId:'H2',location:'src/lib/ocr-service-record.ts:extractPdfTextContent',message:'PDF native text page cap computed',data:{totalPdfPages:pdf.numPages,requestedMaxPages:maxPages,processedPages:pageCount},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const chunks: string[] = [];

  for (let p = 1; p <= pageCount; p += 1) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items || [])
      .map((it: any) => (typeof it?.str === 'string' ? it.str : ''))
      .filter(Boolean)
      .join(' ');
    if (pageText.trim()) {
      chunks.push(pageText.trim());
    }
  }

  return chunks.join('\n\n--- page break ---\n\n');
}

async function createHighContrastImage(file: File): Promise<Blob> {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.drawImage(imageBitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    const v = gray > 140 ? 255 : 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) throw new Error('Could not preprocess image');
  return blob;
}

async function createUpscaledImage(file: Blob | File, scale: number): Promise<Blob> {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(imageBitmap.width * scale);
  canvas.height = Math.ceil(imageBitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1));
  if (!blob) throw new Error('Could not upscale image');
  return blob;
}

export async function extractServiceRecordWithTier(file: File, tier: OcrTier): Promise<ServiceRecordOcrResult> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/d5bec10f-8077-42e2-879b-e49c52213b1e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'21bfa3'},body:JSON.stringify({sessionId:'21bfa3',runId:'run1',hypothesisId:'H3',location:'src/lib/ocr-service-record.ts:extractServiceRecordWithTier',message:'OCR extraction started',data:{tier,fileType:file.type,fileName:file.name},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (tier === 'basic') {
    throw new Error('OCR is disabled for Basic plan.');
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (tier === 'plus' && isPdf) {
    throw new Error('PDF OCR is available on Pro plan only.');
  }

  const warnings: string[] = [];
  const sourceType: 'image' | 'pdf' = isPdf ? 'pdf' : 'image';
  let text = '';
  let confidence = 0;

  if (sourceType === 'pdf') {
    // First try native PDF text extraction (works best for digitally generated PDFs).
    try {
      const nativeText = await extractPdfTextContent(file, 5);
      if (nativeText.trim().length > 40) {
        text = nativeText;
        confidence = 95;
      }
    } catch {
      // Ignore and continue with image OCR fallback below.
    }

    // OCR scanned/non-selectable PDF pages and merge with native text if needed.
    const pages = await renderPdfPagesAsImages(file, 5);
    const pageTexts: string[] = [];
    let confidenceTotal = 0;
    for (const page of pages) {
      const pass = await runTesseract(page);
      pageTexts.push(pass.text);
      confidenceTotal += pass.confidence;
    }
    const ocrText = pageTexts.join('\n\n--- page break ---\n\n');
    if (!text.trim()) {
      text = ocrText;
      confidence = pages.length ? confidenceTotal / pages.length : 0;
    } else if (ocrText.trim().length > 0) {
      text = `${text}\n\n--- OCR supplement ---\n\n${ocrText}`;
    }
    if (pages.length >= 5) warnings.push('Processed first 5 pages only.');
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/d5bec10f-8077-42e2-879b-e49c52213b1e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'21bfa3'},body:JSON.stringify({sessionId:'21bfa3',runId:'run1',hypothesisId:'H4',location:'src/lib/ocr-service-record.ts:extractServiceRecordWithTier',message:'PDF OCR pages processed and warning state',data:{processedImagePages:pages.length,warningAdded:pages.length>=5},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  } else {
    const firstPass = await runTesseract(file);
    text = firstPass.text;
    confidence = firstPass.confidence;
  }

  if (tier === 'pro' && confidence < 75) {
    try {
      let secondInput: Blob | File = file;
      if (sourceType === 'image') {
        const upscaled = await createUpscaledImage(file, 1.6);
        secondInput = await createHighContrastImage(new File([upscaled], 'ocr-upscaled.png', { type: 'image/png' }));
      }
      const secondPass = await runTesseract(secondInput);
      if (secondPass.confidence > confidence) {
        text = secondPass.text;
        confidence = secondPass.confidence;
      }
      warnings.push('Fallback OCR pass applied due to low initial confidence.');
    } catch {
      warnings.push('Fallback OCR pass failed; using initial OCR output.');
    }
  }

  const normalizedText = normalizeOcrText(text);
  const rawCandidates = extractFieldCandidates(normalizedText);
  const consistencyCandidates = applyConsistencyChecks(rawCandidates);
  const fieldResults = toFieldResults(consistencyCandidates);
  const fields = fieldResultsToFields(fieldResults);
  const lineItems = extractLineItems(normalizedText);
  const parsingConfidence = estimateParsingConfidence(fields);
  const needsReview = confidence < 70 || parsingConfidence < 60;

  if (needsReview) {
    warnings.push('Low confidence extraction. Please review all auto-filled fields.');
  }

  return {
    rawText: text,
    normalizedText,
    ocrConfidence: Math.max(0, Math.min(100, Math.round(confidence))),
    parsingConfidence,
    needsReview,
    sourceType,
    fieldResults,
    lineItems,
    fields,
    warnings,
  };
}
