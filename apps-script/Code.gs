// Google Apps Script — 健身日志 API
// 粘贴到 Google Sheets 的 Apps Script 编辑器，然后部署为 Web 应用

const SHEET_NAME = 'WorkoutLogs';

function doGet() {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return json({ logs: [] });

  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  const logs = data
    .filter(row => row[0])
    .map(row => ({
      date:       row[0],
      exercises:  row[1],
      duration:   row[2],
      notes:      row[3],
      logged_at:  row[4]
    }))
    .reverse();

  return json({ logs });
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();
    sheet.appendRow([
      payload.date,
      JSON.stringify(payload.exercises),
      payload.duration || 0,
      payload.notes || '',
      new Date().toISOString()
    ]);
    return json({ status: 'ok' });
  } catch (err) {
    return json({ status: 'error', message: err.message });
  }
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['date', 'exercises', 'duration_min', 'notes', 'logged_at'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
