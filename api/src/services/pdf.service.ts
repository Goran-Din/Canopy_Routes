import puppeteer from 'puppeteer-core';
import fs from 'fs/promises';

export interface RouteSheetData {
  routeLabel: string;
  crewCode: string;
  dayOfWeek: string;
  totalStops: number;
  workdayHours: number;
  annualRevenue?: number;
  isThursday: boolean;
  generatedAt: string;
  stops: Array<{
    sequence: number;
    clientName: string;
    serviceAddress: string;
    city: string;
    acres: number;
    mowTimeMinutes: number;
    driveFromPrevMinutes: number;
    cumulativeMinutes: number;
    timeConstraints?: string;
    accessNotes?: string;
    annualRevenue?: number;
  }>;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildRouteSheetHtml(data: RouteSheetData, includeRevenue: boolean): string {
  const rows = data.stops.map((stop, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'}">
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:center;font-weight:600">${stop.sequence}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-weight:500">${escapeHtml(stop.clientName)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;color:#495057">${escapeHtml(stop.serviceAddress)}, ${escapeHtml(stop.city)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:center">${stop.acres.toFixed(2)}</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:center">${stop.mowTimeMinutes} min</td>
      <td style="padding:6px 8px;border:1px solid #dee2e6;text-align:center">${stop.driveFromPrevMinutes} min</td>
      ${includeRevenue ? `<td style="padding:6px 8px;border:1px solid #dee2e6;text-align:right">${stop.annualRevenue ? '$' + stop.annualRevenue.toLocaleString() : '\u2014'}</td>` : ''}
      <td style="padding:6px 8px;border:1px solid #dee2e6;font-size:11px;color:#6c757d">${escapeHtml([stop.timeConstraints, stop.accessNotes].filter(Boolean).join(' \u00b7 '))}</td>
    </tr>
  `).join('');

  const totalMow = data.stops.reduce((s, r) => s + r.mowTimeMinutes, 0);
  const totalDrive = data.stops.reduce((s, r) => s + r.driveFromPrevMinutes, 0);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #212529; padding: 24px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 3px solid #1a2e5a; }
  .company { font-size: 18px; font-weight: 700; color: #1a2e5a; }
  .route-name { font-size: 22px; font-weight: 700; text-align: center; color: #1a2e5a; }
  .season { font-size: 11px; color: #6c757d; text-align: right; }
  .summary-bar { background: #1a2e5a; color: white; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; display: flex; gap: 24px; font-size: 12px; }
  .summary-bar span { white-space: nowrap; }
  .thursday-warning { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 8px 12px; margin-bottom: 12px; font-weight: 600; color: #856404; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #1a2e5a; color: white; }
  thead th { padding: 8px; border: 1px solid #1a2e5a; text-align: left; font-weight: 600; }
  tfoot tr { background: #e9ecef; font-weight: 700; }
  tfoot td { padding: 6px 8px; border: 1px solid #dee2e6; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #dee2e6; display: flex; justify-content: space-between; font-size: 10px; color: #6c757d; }
</style>
</head>
<body>
  <div class="header">
    <div class="company">Sunset Services</div>
    <div class="route-name">${escapeHtml(data.routeLabel)}</div>
    <div class="season">2026 Season<br>Generated: ${escapeHtml(data.generatedAt)}</div>
  </div>

  <div class="summary-bar">
    <span>Crew: ${escapeHtml(data.crewCode)}</span>
    <span>Day: ${escapeHtml(data.dayOfWeek)}</span>
    <span>Stops: ${data.totalStops}</span>
    <span>Workday: ${data.workdayHours.toFixed(1)}h</span>
    ${includeRevenue && data.annualRevenue ? `<span>Revenue: $${data.annualRevenue.toLocaleString()}/yr</span>` : ''}
  </div>

  ${data.isThursday ? `<div class="thursday-warning">\u26A0 DEPOT DEPARTURE: 6:30 AM REQUIRED \u2014 91 min return drive to depot</div>` : ''}

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Client Name</th>
        <th>Address</th>
        <th style="width:50px">Acres</th>
        <th style="width:65px">Mow+Trim</th>
        <th style="width:65px">Drive</th>
        ${includeRevenue ? '<th style="width:80px">Revenue</th>' : ''}
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr>
        <td colspan="3" style="text-align:right">TOTALS</td>
        <td></td>
        <td style="text-align:center">${totalMow} min</td>
        <td style="text-align:center">${totalDrive} min</td>
        ${includeRevenue ? '<td></td>' : ''}
        <td>Workday: ${data.workdayHours.toFixed(1)}h</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <span>Confidential \u2014 Sunset Services Internal</span>
    <span>Generated by Canopy Routes</span>
  </div>
</body>
</html>`;
}

export async function generateRoutePdf(
  data: RouteSheetData,
  includeRevenue: boolean,
  outputPath: string
): Promise<void> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser';
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    const page = await browser.newPage();
    const html = buildRouteSheetHtml(data, includeRevenue);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath,
      format: 'Letter',
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
}
