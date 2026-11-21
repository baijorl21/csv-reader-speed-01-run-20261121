// Fast drop-in replacement for csv-reader 1.0.0 (make.fun's reference CSV reader):
// run(input) returns exactly csv-reader's reading {columns, rows, errors} of {text, header},
// but parses with slice-based scanning instead of building every field a character at a time.
//
// Policy (identical to the reference):
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field opening with a quote runs to the next undoubled quote ("" = one quote; CRLF or a
//     lone CR inside reads as LF); what follows the closing quote up to the next comma or line
//     break is appended as it stands (quote_junk when the field ends); a quote that never closes
//     is a literal character and the text after it is read again as unquoted (unterminated_quote);
//   - a quote inside an unquoted field is literal; fields stay strings, never trimmed;
//   - columns is the first record when header is true, else null; rows are padded (short_row)
//     or cut (long_row) to the first record's width;
//   - errors are {code, line, row} in the order met, line = the 1-based line the record starts
//     on (every LF, CRLF and lone CR inside quotes counted), row = index in rows (null: header).

const COMMA = 0; // field ended at a comma: the record goes on
const BREAK = 1; // field ended at a line break: the record ends
const END = 2; // field ended at the end of the text

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and how many characters an unquoted read kept.
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  // Reads unquoted characters onto `seed` up to the next comma or line break. A CR not followed
  // by LF is dropped (stray_cr). The value is sliced out of the text, never built per character;
  // `parts` only appears when a stray CR splits the field.
  function readUnquoted(seed) {
    let start = pos;
    let parts = null;
    let added = 0;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c > 44) {
        pos += 1;
        continue;
      }
      if (c === 44) {
        // ,
        fValue = parts === null ? (seed === '' ? text.slice(start, pos) : seed + text.slice(start, pos)) : seed + parts.join('') + text.slice(start, pos);
        fAdded = added + (pos - start);
        fEnded = COMMA;
        pos += 1;
        return;
      }
      if (c === 10) {
        // LF
        fValue = parts === null ? (seed === '' ? text.slice(start, pos) : seed + text.slice(start, pos)) : seed + parts.join('') + text.slice(start, pos);
        fAdded = added + (pos - start);
        fEnded = BREAK;
        pos += 1;
        line += 1;
        return;
      }
      if (c === 13) {
        // CR
        if (pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
          fValue = parts === null ? (seed === '' ? text.slice(start, pos) : seed + text.slice(start, pos)) : seed + parts.join('') + text.slice(start, pos);
          fAdded = added + (pos - start);
          fEnded = BREAK;
          pos += 2;
          line += 1;
          return;
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        if (parts === null) parts = [];
        parts.push(text.slice(start, pos));
        added += pos - start;
        pos += 1;
        start = pos;
        continue;
      }
      pos += 1;
    }
    fValue = parts === null ? (seed === '' ? text.slice(start, pos) : seed + text.slice(start, pos)) : seed + parts.join('') + text.slice(start, pos);
    fAdded = added + (pos - start);
    fEnded = END;
  }

  // Reads a quoted field whose opening quote is at pos.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    let segStart = pos;
    let parts = null;
    let closed = false;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 34) {
        // "
        if (pos + 1 < n && text.charCodeAt(pos + 1) === 34) {
          if (parts === null) parts = [];
          parts.push(text.slice(segStart, pos), '"');
          pos += 2;
          segStart = pos;
          continue;
        }
        closed = true;
        break;
      }
      if (c === 13) {
        // CRLF and a lone CR inside quotes are each one LF.
        if (parts === null) parts = [];
        parts.push(text.slice(segStart, pos), '\n');
        line += 1;
        pos += pos + 1 < n && text.charCodeAt(pos + 1) === 10 ? 2 : 1;
        segStart = pos;
        continue;
      }
      if (c === 10) line += 1;
      pos += 1;
    }
    if (!closed) {
      // The quote never closes: it is a literal character, and the text after it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      readUnquoted('"');
      return;
    }
    const value = parts === null ? text.slice(segStart, pos) : parts.join('') + text.slice(segStart, pos);
    pos += 1; // past the closing quote
    if (pos >= n) {
      fValue = value;
      fEnded = END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      fValue = value;
      fEnded = COMMA;
      pos += 1;
      return;
    }
    if (c === 10) {
      fValue = value;
      fEnded = BREAK;
      pos += 1;
      line += 1;
      return;
    }
    if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
      fValue = value;
      fEnded = BREAK;
      pos += 2;
      line += 1;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < n && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? columns ?? [] : null, rows, errors };
}
