/**
 * Finalsay: Docs.gs. Proposal documents from a template.
 *
 * Placeholders look like {{name}}. They are replaced LITERALLY: the text is deleted and the value
 * inserted at the same spot (findText + deleteText + insertText). replaceText is never used, because
 * it treats "$" in the value as a pattern reference and a price such as "$500" would come out wrong.
 *
 * Two ways to copy the template (Settings > "Proposal copy method"):
 *   docs-only   builds a new Doc and copies paragraphs, lists and tables into it. Needs no Drive
 *               permission. Headers, footers and page setup are not copied.
 *   drive-copy  DriveApp makeCopy: an exact copy. Needs the full Drive scope, which is why it is not
 *               the default (see SETUP.md).
 */
var Docs = (function () {
  var PLACEHOLDER = '\\{\\{\\s*[A-Za-z0-9_]+\\s*\\}\\}';

  function idFromLink(link) {
    var s = String(link || '').trim();
    var m = s.match(/\/d\/([A-Za-z0-9_\-]{20,})/) || s.match(/^([A-Za-z0-9_\-]{20,})$/);
    return m ? m[1] : '';
  }

  function starterTemplate() {
    var doc = DocumentApp.create('Finalsay proposal template');
    var b = doc.getBody();
    b.appendParagraph('Proposal for {{name}}');
    b.appendParagraph('{{company}}');
    b.appendParagraph('Date: {{today}}');
    b.appendParagraph('What you asked for: {{wants}}');
    b.appendParagraph('Budget: {{budget}}');
    b.appendParagraph('Deadline: {{deadline}}');
    b.appendParagraph('Price: {{value}}');
    b.appendParagraph('Next step: {{next_step}}');
    b.appendParagraph('{{my_name}}');
    doc.saveAndClose();
    return doc;
  }

  function copyTemplate_(templateId, name, method) {
    if (method === 'drive-copy') {
      return DocumentApp.openById(DriveApp.getFileById(templateId).makeCopy(name).getId());
    }
    var src = DocumentApp.openById(templateId).getBody();
    var doc = DocumentApp.create(name), dst = doc.getBody();
    var T = DocumentApp.ElementType, added = 0;
    for (var i = 0; i < src.getNumChildren(); i++) {
      var el = src.getChild(i).copy(), type = el.getType();
      if (type === T.PARAGRAPH) { dst.appendParagraph(el); added++; }
      else if (type === T.LIST_ITEM) { dst.appendListItem(el); added++; }
      else if (type === T.TABLE) { dst.appendTable(el); added++; }
      // anything else (table of contents and so on) is left out
    }
    if (added > 0 && dst.getNumChildren() > 1) dst.removeChild(dst.getChild(0)); // the empty first line of a new Doc
    return doc;
  }

  /**
   * Replaces every placeholder that has a value. Two passes: first find them all, then replace from the
   * last to the first. That way a value that itself contains "{{something}}" is never looked at again,
   * and earlier positions stay correct.
   */
  function fill_(section, fields) {
    var found = [], range = null, missing = [], filled = 0;
    while ((range = section.findText(PLACEHOLDER, range))) {
      found.push({ text: range.getElement().asText(), start: range.getStartOffset(), end: range.getEndOffsetInclusive() });
      if (found.length > 500) break;
    }
    for (var i = found.length - 1; i >= 0; i--) {
      var f = found[i];
      var key = f.text.getText().substring(f.start, f.end + 1).replace(/[{}\s]/g, '');
      var v = fields[key];
      if (v === undefined || v === null || String(v).trim() === '') {
        if (missing.indexOf(key) < 0) missing.push(key);
        continue;
      }
      f.text.deleteText(f.start, f.end);
      f.text.insertText(f.start, String(v));
      filled++;
    }
    return { missing: missing, filled: filled };
  }

  /** Makes the document. Returns { url, name, missing: [placeholders left unfilled], filled }. */
  function create(templateId, name, fields, method) {
    var doc = copyTemplate_(templateId, name, method);
    var res = fill_(doc.getBody(), fields);
    [doc.getHeader && doc.getHeader(), doc.getFooter && doc.getFooter()].forEach(function (sec) {
      if (!sec) return;
      var r = fill_(sec, fields);
      res.filled += r.filled;
      r.missing.forEach(function (k) { if (res.missing.indexOf(k) < 0) res.missing.push(k); });
    });
    doc.saveAndClose();
    return { url: doc.getUrl(), name: name, missing: res.missing.sort(), filled: res.filled };
  }

  /** Self-check: makes one small document, or adds a line to the one from the last check, so at most one exists. */
  function probe(previousId) {
    var doc = null, reused = false;
    if (previousId) { try { doc = DocumentApp.openById(String(previousId)); reused = true; } catch (e) { doc = null; } }
    if (!doc) { doc = DocumentApp.create('Finalsay self-check (safe to delete)'); reused = false; }
    doc.getBody().appendParagraph('Finalsay could write to Google Docs on ' + new Date().toISOString() + '. You can delete this document.');
    return { id: doc.getId(), url: doc.getUrl(), reused: reused };
  }

  return { create: create, starterTemplate: starterTemplate, idFromLink: idFromLink, probe: probe };
})();
