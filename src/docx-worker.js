/* Bounded local ZIP decoding in a terminable worker; only layout XML and raster media are retained. */
importScripts('../vendor/fflate/umd/index.js');
self.onmessage = ({data}) => {
  try {
    if (!(data instanceof ArrayBuffer) || data.byteLength > 25 * 1024 * 1024) throw new Error('Word 文件过大。');
    let entries = 0, documents = 0, total = 0;
    const files = fflate.unzipSync(new Uint8Array(data), {filter(file) {
      if (++entries > 10000) throw new Error('Word 文件包含过多压缩条目。');
      if(file.name.includes('..')||file.name.startsWith('/'))throw new Error('Word 压缩路径异常。');
      if(file.name==='word/document.xml' && ++documents>1)throw new Error('Word 正文过大或文档结构异常。');
      if(!/^(\[Content_Types\]\.xml|_rels\/\.rels|word\/(?:[^/]+\.xml|_rels\/[^/]+\.rels|media\/[^/]+\.(?:png|jpe?g|gif|webp)))$/i.test(file.name))return false;
      total+=file.originalSize;
      if(file.originalSize>8*1024*1024 || total>40*1024*1024)throw new Error('Word 正文过大或文档结构异常。');
      return true;
    }});
    const bytes = files['word/document.xml'];
    if (!bytes || bytes.length > 8 * 1024 * 1024) throw new Error('未找到 Word 正文。请使用 DOCX 格式。');
    const encoding = bytes[0] === 255 && bytes[1] === 254 ? 'utf-16le' : bytes[0] === 254 && bytes[1] === 255 ? 'utf-16be' : 'utf-8';
    if(Object.values(files).reduce((sum,value)=>sum+value.length,0)>40*1024*1024)throw new Error('Word 解压内容过大。');
    self.postMessage({ok:true,xml:new TextDecoder(encoding,{fatal:true}).decode(bytes),files});
  } catch (error) {self.postMessage({ok:false,error:error.message});}
};
