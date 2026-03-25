const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function generatePDF(data) {
  let browser;

  try {
    console.log("📄 START GENERATE:", data.caseId);

    // 🔥 กัน caseId ว่าง / แปลก
    const safeCaseId = String(data.caseId || 'unknown')
      .replace(/[^a-zA-Z0-9-_]/g, '');

    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    const html = `
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif; /* 🔥 แก้ font */
          font-size: 16px;
          padding: 30px;
        }
        .header { text-align: center; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: bold; }
        .subtitle { font-size: 18px; }
        .section { margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        td { border: 1px solid black; padding: 8px; }
        .signature { margin-top: 40px; text-align: right; }
        img { width: 120px; margin: 5px; }
      </style>
    </head>

    <body>

      <div class="header">
        <div class="title">มูลนิธิป่อเต็กตึ๊ง</div>
        <div class="subtitle">รายงานการปฏิบัติงานกู้ภัย</div>
      </div>

      <table>
        <tr>
          <td>เลขที่เคส</td>
          <td>${data.caseId || '-'}</td>
          <td>วันที่</td>
          <td>${data.date || '-'}</td>
        </tr>
        <tr>
          <td>เวลาเริ่ม</td>
          <td>${data.startTime || '-'}</td>
          <td>เวลาสิ้นสุด</td>
          <td>${data.endTime || '-'}</td>
        </tr>
      </table>

      <div class="section">
        <table>
          <tr>
            <td>สถานที่เกิดเหตุ</td>
            <td colspan="3">${data.location || '-'}</td>
          </tr>
          <tr>
            <td>พิกัด (GPS)</td>
            <td colspan="3">${data.lat || '-'}, ${data.lng || '-'}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <table>
          <tr>
            <td>หน่วยปฏิบัติงาน</td>
            <td>${data.officer || '-'}</td>
            <td>สถานะ</td>
            <td>${data.status || '-'}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <table>
          <tr>
            <td>รายละเอียดเหตุการณ์</td>
          </tr>
          <tr>
            <td style="height:100px;">${data.detail || '-'}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <b>ภาพประกอบ:</b><br/>
        ${
          data.images && data.images.length > 0
            ? data.images
                .slice(0, 3) // 🔥 จำกัดรูป (กันพัง)
                .map(img => `<img src="${img}" />`)
                .join('')
            : 'ไม่มีรูปภาพ'
        }
      </div>

      <div class="signature">
        ลงชื่อ ___________________________<br/>
        (${data.officer || '-'})<br/>
        ผู้รายงาน
      </div>

    </body>
    </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    // 🔥 path fix
    const outputDir = path.join(process.cwd(), 'reports');

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `report-${safeCaseId}.pdf`;
    const filePath = path.join(outputDir, fileName);

    console.log("📁 SAVE TO:", filePath);

    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true
    });

    console.log("✅ PDF CREATED:", fileName);

    return fileName;

  } catch (err) {
    console.error("❌ PDF ERROR:", err);
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = generatePDF;