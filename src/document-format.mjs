export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_CHARS = 1000000;
export const MAX_PAGES = 300;

export function splitParagraph(text, limit = 1500) {
  const pieces = [];
  let rest = String(text).replace(/\r\n?/g, '\n').trim();
  while (rest.length > limit) {
    let cut = Math.max(rest.lastIndexOf('\n', limit), rest.lastIndexOf(' ', limit));
    if (cut < limit / 2) cut = limit;
    if (/^[\uDC00-\uDFFF]$/.test(rest[cut])) cut -= 1;
    pieces.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) pieces.push(rest);
  return pieces;
}

export function textPages(paragraphs) {
  const pages = [];
  let blocks = [], chars = 0, total = 0;
  for (const paragraph of paragraphs) {
    const value = typeof paragraph === 'string' ? {text: paragraph} : paragraph;
    for (const text of splitParagraph(value.text)) {
      total += text.length;
      if (total > MAX_TEXT_CHARS) throw new Error('文档文字超过 100 万字符，请拆分文件后打开。');
      if (blocks.length && (chars + text.length > 6000 || blocks.length >= 30)) { pages.push({blocks}); blocks = []; chars = 0; }
      blocks.push({text, kind: value.kind || 'paragraph'}); chars += text.length;
    }
  }
  if (blocks.length) pages.push({blocks});
  if (!pages.length) throw new Error('没有找到可翻译的文字。');
  if (pages.length > MAX_PAGES) throw new Error('文档过长，请拆分文件后打开。');
  return pages;
}

export function decodeText(bytes) {
  const prefix = bytes.subarray(0, 4);
  const encoding = prefix[0] === 255 && prefix[1] === 254 ? 'utf-16le' : prefix[0] === 254 && prefix[1] === 255 ? 'utf-16be' : 'utf-8';
  let text;
  try {text = new TextDecoder(encoding, {fatal: true}).decode(bytes);}
  catch {throw new Error('无法识别文本编码，请另存为 UTF-8，或带 BOM 的 UTF-16。');}
  if (text.includes('\0')) throw new Error('该文件不是支持的纯文本编码，请另存为 UTF-8。');
  return text;
}

export function parseDocxXml(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Word 文件包含不支持的 XML 声明。');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('无法读取 Word 文档结构。');
  const body = doc.getElementsByTagNameNS('*', 'body')[0];
  if (!body) throw new Error('不是有效的 DOCX 文档。');
  const paragraphs = [];
  for (const paragraph of body.getElementsByTagNameNS('*', 'p')) {
    let text = '';
    for (const node of paragraph.getElementsByTagName('*')) {
      if (!['t', 'tab', 'br', 'cr'].includes(node.localName)) continue;
      let excluded = false;
      for (let ancestor = node.parentElement; ancestor && ancestor !== paragraph; ancestor = ancestor.parentElement) {
        const hidden = ancestor.localName === 'r' && ancestor.getElementsByTagNameNS('*', 'vanish')[0];
        const hiddenValue = hidden && Array.from(hidden.attributes).find(attr => attr.localName === 'val')?.value;
        if (ancestor.localName === 'del' || hidden && !/^(0|false|off)$/i.test(hiddenValue || 'true')) excluded = true;
      }
      if (!excluded) text += node.localName === 't' ? node.textContent : node.localName === 'tab' ? '\t' : '\n';
    }
    const style = paragraph.getElementsByTagNameNS('*', 'pStyle')[0];
    const styleName = style ? Array.from(style.attributes).find(attr => attr.localName === 'val')?.value || '' : '';
    if (text.trim()) paragraphs.push({text, kind: /^(heading|标题)[1-6]$/i.test(styleName) ? 'heading' : 'paragraph'});
  }
  return textPages(paragraphs);
}

export function pdfBlocks(content, viewport, transform) {
  const items = content.items.filter(item => typeof item.str === 'string' && item.str.trim()).map(item => {
    const matrix = transform(viewport.transform, item.transform);
    const height = Math.max(4, Math.abs(item.height) || Math.hypot(matrix[2], matrix[3]));
    const ascent = content.styles?.[item.fontName]?.ascent ?? .85;
    return {text: item.str, x: matrix[4], y: matrix[5], width: item.width, height,
      top: matrix[5] - height * ascent, bottom: matrix[5] + height * (1-ascent),
      supported: Math.abs(Math.atan2(matrix[1],matrix[0])) < .02 && !content.styles?.[item.fontName]?.vertical};
  });
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const item of items) {
    let row = rows.at(-1);
    if (!row || Math.abs(item.y - row.y) > Math.max(2, item.height * .35)) { row = {y: item.y, items: []}; rows.push(row); }
    row.items.push(item);
  }
  const lines = [];
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x);
    let line;
    for (const item of row.items) {
      if (!line || item.x - line.right > Math.max(18, item.height * 2)) {
        line = {text: '', x: item.x, y: row.y, right: item.x, height: item.height, top:item.top, bottom:item.bottom, supported:true, rects:[]}; lines.push(line);
      }
      const gap = item.x - line.right;
      const separator = line.text && gap > item.height * .15 && !/\s$/.test(line.text) ? ' ' : '';
      line.text += separator + item.text; line.right = item.x + item.width; line.height = Math.max(line.height, item.height);
      line.top=Math.min(line.top,item.top);line.bottom=Math.max(line.bottom,item.bottom);line.supported &&= item.supported;
      line.rects.push({x:item.x-.7,y:item.top-.7,width:item.width+1.4,height:item.bottom-item.top+1.4});
    }
  }
  const middle = viewport.width / 2;
  const left = line => line.right < middle + 5;
  const right = line => line.x > middle - 5;
  const spanning = lines.filter(line => !left(line) && !right(line));
  let ordered = lines;
  if (lines.filter(left).length >= 4 && lines.filter(right).length >= 4 && spanning.length < lines.length * .3) {
    ordered = []; let start = -Infinity;
    const band = end => { const part = lines.filter(line => line.y >= start && line.y < end && !spanning.includes(line)); ordered.push(...part.filter(left), ...part.filter(right)); };
    for (const line of spanning) { band(line.y); ordered.push(line); start = line.y + .1; }
    band(Infinity);
  }
  const paragraphs = [];
  let current, previous;
  for (const line of ordered) {
    const isNew = !previous || line.y < previous.y - 2 || line.y - previous.y > Math.max(line.height, previous.height) * 1.75 || Math.abs(line.x - previous.x) > line.height * 2.5 || Math.abs(line.height-previous.height)>previous.height*.2 || (current?.text.length||0)+line.text.length>1500 || !line.supported || !previous.supported;
    if (isNew) { current = {text: '', kind: 'paragraph', lines:[]}; paragraphs.push(current); }
    const join = current.text && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(current.text) && /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(line.text) ? '' : ' ';
    if (/[a-z]-$/.test(current.text) && /^[a-z]/.test(line.text)) current.text = current.text.slice(0, -1) + line.text;
    else current.text += (current.text ? join : '') + line.text;
    current.lines.push(line);
    previous = line;
  }
  return paragraphs.flatMap(paragraph => {
    const {lines}=paragraph,x=Math.min(...lines.map(l=>l.x)),y=Math.min(...lines.map(l=>l.top));
    const geometry={x,y,width:Math.max(...lines.map(l=>l.right))-x,height:Math.max(...lines.map(l=>l.bottom))-y,
      fontSize:Math.max(...lines.map(l=>l.height)),rects:lines.flatMap(l=>l.rects),supported:lines.every(l=>l.supported)};
    const parts=splitParagraph(paragraph.text);
    return parts.map(text=>({text,kind:paragraph.kind,geometry:{...geometry,supported:geometry.supported&&parts.length===1}}));
  });
}

export function translationBatches(blocks) {
  const batches = []; let batch = [], length = 0;
  blocks.forEach((block, index) => {
    if (block.translation) return;
    const item = {block, marker: `__QF_DOC_${index}__`};
    const size = block.text.length + item.marker.length + 3;
    if (batch.length && (length + size > 1800 || batch.length >= 8)) {batches.push(batch);batch=[];length=0;}
    batch.push(item);length+=size;
  });
  if (batch.length) batches.push(batch);
  return batches;
}

export function markedTranslations(text, batch, partial = false) {
  const values = []; let cursor = 0;
  for (let index = 0; index < batch.length; index += 1) {
    const marker = batch[index].marker, start = text.indexOf(marker, cursor);
    if (start < 0) return partial ? values : null;
    const contentStart = start + marker.length, next = batch[index + 1]?.marker;
    const end = next ? text.indexOf(next, contentStart) : text.length;
    if (end < 0 && !partial) return null;
    let value = text.slice(contentStart, end < 0 ? text.length : end);
    if (partial && end < 0 && next) for (let size = next.length - 1; size > 0; size -= 1) {
      if (value.endsWith(next.slice(0, size))) {value = value.slice(0, -size);break;}
    }
    value = value.replace(/^[\s:：-]+|\s+$/g, '');
    if (!value && !partial || /__QF_DOC_\d+__/.test(value)) return partial ? values : null;
    values.push(value); cursor = end;
    if (end < 0) break;
  }
  return values;
}
