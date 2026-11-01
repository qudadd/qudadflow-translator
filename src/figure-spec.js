/* Shared by the classic service worker and module-based reader. No execution. */
(() => {
  const SCHEMA='qudadflow.figure/v1';
  const fail=message=>{throw new Error('图形规格：'+message);};
  const object=(value,keys,path)=>{
    if(!value||typeof value!=='object'||Array.isArray(value))fail(path+' 必须是对象');
    for(const key of Object.keys(value))if(!keys.includes(key))fail(path+' 不支持字段 '+key+'，请使用 custom 类型代码表达额外结构');
  };
  const text=(value,path,limit=300)=>{
    if(typeof value!=='string'||value.length>limit||/[\x00-\x1f\x7f]/.test(value))fail(path+' 文字无效或过长');
  };
  const column=(value,path)=>{text(value,path,80);if(!value.trim())fail(path+' 列名为空');};
  const number=(value,min,max,path)=>{if(!Number.isFinite(value)||value<min||value>max)fail(path+' 超出范围');};
  const choice=(value,choices,path)=>{if(!choices.includes(value))fail(path+' 应为 '+choices.join(' / '));};
  const strings=(value,path,max=30)=>{
    if(!Array.isArray(value)||!value.length||value.length>max)fail(path+' 必须是非空数组（最多 '+max+' 项）');
    value.forEach(v=>column(v,path));if(new Set(value).size!==value.length)fail(path+' 包含重复项');
  };
  function validate(spec){
    if(JSON.stringify(spec)?.length>40000)fail('最多 40000 字符');
    object(spec,['schema','title','data','canvas','layout','style','panels','unresolved'],'spec');
    if(spec.schema!==SCHEMA)fail('schema 必须为 '+SCHEMA);text(spec.title,'title');
    object(spec.data,['file','status','source','notes'],'data');
    if(typeof spec.data.file!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,70}\.csv$/.test(spec.data.file))fail('data.file 必须为相对 CSV 文件名');
    choice(spec.data.status,['provided','digitized','missing'],'data.status');
    text(spec.data.source,'data.source',1000);if(!spec.data.source.trim())fail('data.source 不能为空');text(spec.data.notes,'data.notes',2000);
    object(spec.canvas,['width','height','dpi'],'canvas');
    number(spec.canvas.width,2,20,'canvas.width');number(spec.canvas.height,2,20,'canvas.height');number(spec.canvas.dpi,72,600,'canvas.dpi');if(!Number.isInteger(spec.canvas.dpi))fail('dpi 必须为整数');
    // Bound raster memory as well as physical size.
    if(spec.canvas.width*spec.canvas.height*spec.canvas.dpi**2>24000000)fail('PNG 最多 2400 万像素');
    object(spec.layout,['columns'],'layout');number(spec.layout.columns,1,3,'layout.columns');if(!Number.isInteger(spec.layout.columns))fail('columns 必须为整数');
    object(spec.style,['fontFamily','fontSize','palette','lineWidth','pointSize','grid','spines','legend'],'style');
    column(spec.style.fontFamily,'style.fontFamily');number(spec.style.fontSize,6,30,'style.fontSize');
    strings(spec.style.palette,'style.palette',20);if(spec.style.palette.some(c=>!/^#[a-f\d]{6}$/i.test(c)))fail('palette 必须是 #RRGGBB');
    number(spec.style.lineWidth,.25,6,'style.lineWidth');number(spec.style.pointSize,0,12,'style.pointSize');
    if(typeof spec.style.grid!=='boolean')fail('style.grid 必须是布尔值');
    choice(spec.style.spines,['left-bottom','box'],'style.spines');choice(spec.style.legend,['top','right','bottom','none'],'style.legend');
    if(!Array.isArray(spec.panels)||!spec.panels.length||spec.panels.length>6)fail('panels 需要 1–6 个面板');
    if(spec.layout.columns>spec.panels.length)fail('columns 不得超过面板数');
    const ids=new Set();
    for(const p of spec.panels){
      object(p,['id','type','title','x','y','series','categories','interval','filter'],'panel');
      column(p.id,'panel.id');if(ids.has(p.id))fail('面板编号重复');ids.add(p.id);
      choice(p.type,['line','scatter','bar','custom'],'panel.type');text(p.title,'panel.title');
      if(p.type==='scatter'&&spec.style.pointSize===0)fail('散点尺寸必须大于零');
      for(const key of ['x','y']){
        const a=p[key];object(a,['column','label','scale','limits','ticks'],p.id+'.'+key);column(a.column,key+'.column');text(a.label,key+'.label');choice(a.scale,['linear','log'],key+'.scale');
        if(a.limits!==null){if(!Array.isArray(a.limits)||a.limits.length!==2||!a.limits.every(Number.isFinite)||a.limits[0]>=a.limits[1])fail(key+'.limits 必须递增或为 null');if(a.scale==='log'&&a.limits[0]<=0)fail('对数轴范围必须大于零');}
        if(a.ticks!==null){if(!Array.isArray(a.ticks)||!a.ticks.length||a.ticks.length>30||!a.ticks.every(Number.isFinite)||new Set(a.ticks).size!==a.ticks.length)fail(key+'.ticks 必须为有限数字数组或 null');if(a.scale==='log'&&a.ticks.some(n=>n<=0))fail('对数轴刻度必须大于零');}
      }
      if(p.type==='bar'&&(p.x.scale!=='linear'||p.x.limits!==null||p.x.ticks!==null||p.y.scale!=='linear'))fail('柱图需线性轴，x 使用 categories 顺序；对数柱图请用 custom');
      if(p.type==='bar')strings(p.categories,'categories');else if(p.categories!==null)fail('非柱图 categories 应为 null');
      if(p.series!==null){object(p.series,['column','order'],'series');column(p.series.column,'series.column');strings(p.series.order,'series.order',20);}
      if(spec.style.palette.length<(p.series?.order.length||1))fail('调色板颜色不足，不能静默复用颜色');
      if(p.interval!==null){object(p.interval,['kind','lower','upper','level'],'interval');choice(p.interval.kind,['sd','se','ci','range','unknown'],'interval.kind');column(p.interval.lower,'interval.lower');column(p.interval.upper,'interval.upper');if(p.interval.lower===p.interval.upper)fail('上下界应使用不同列');if(p.interval.level!==null){if(p.interval.kind!=='ci')fail('仅 CI 可声明 level');number(p.interval.level,.001,.999,'interval.level');}}
      if(p.filter!==null){object(p.filter,['column','value'],'filter');column(p.filter.column,'filter.column');column(p.filter.value,'filter.value');}
    }
    if(!Array.isArray(spec.unresolved)||spec.unresolved.length>30)fail('unresolved 应为数组（最多 30 项）');
    spec.unresolved.forEach(v=>text(v,'unresolved',400));
    return JSON.parse(JSON.stringify(spec));
  }
  function parseResponse(result){
    const blocks=[...String(result).matchAll(/```([^\n]*)\n([\s\S]*?)```/g)].filter(m=>/^(json|figure-spec)\s*$/i.test(m[1].trim()));
    const candidates=[];
    for(const block of blocks){
      let value;try{value=JSON.parse(block[2]);}catch{if(/qudadflow\.figure/.test(block[2]))fail('JSON 不完整，请重试');continue;}
      if(value?.schema?.startsWith?.('qudadflow.figure'))candidates.push(value);
    }
    if(candidates.length>1)fail('只允许一份图形规格');
    return candidates.length?validate(candidates[0]):null;
  }
  function columns(spec){
    validate(spec);return [...new Set(spec.panels.flatMap(p=>[p.filter?.column,p.x.column,p.y.column,p.series?.column,p.interval?.lower,p.interval?.upper]).filter(Boolean))];
  }
  const csvHeader=spec=>columns(spec).map(c=>'"'+c.replaceAll('"','""')+'"').join(',')+'\n';
  const templateReady=spec=>spec.panels.every(p=>p.type!=='custom');
  function checkRevision(before,after){
    validate(before);validate(after);
    const mapping=s=>({data:s.data,panels:s.panels.map(p=>({id:p.id,x:p.x.column,y:p.y.column,filter:p.filter,interval:p.interval,series:p.series?{column:p.series.column,values:[...p.series.order].sort()}:null,categories:p.categories?[...p.categories].sort():null})).sort((a,b)=>a.id.localeCompare(b.id))});
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    if(JSON.stringify(canonical(mapping(before)))!==JSON.stringify(canonical(mapping(after))))fail('视觉修订改变了数据来源、映射或区间语义，请核对数据后重新生成');
    return after;
  }
  const example={schema:SCHEMA,title:'',data:{file:'data.csv',status:'missing',source:'Original data not supplied',notes:'Describe required values, units and source locations; do not add invented rows.'},canvas:{width:6.4,height:4,dpi:300},layout:{columns:1},style:{fontFamily:'sans',fontSize:10,palette:['#0072B2','#D55E00'],lineWidth:1.5,pointSize:3,grid:false,spines:'left-bottom',legend:'top'},panels:[{id:'A',type:'line',title:'',x:{column:'x',label:'',scale:'linear',limits:null,ticks:null},y:{column:'y',label:'',scale:'linear',limits:null,ticks:null},series:null,categories:null,interval:null,filter:null}],unresolved:['Replace generic layout defaults with observed measurements; list all unknowns.']};
  const instructions=`
Generate a reproducibility draft in LANGUAGE. First identify chart family and panels; measure aspect ratio, axis limits/scales/ticks, font, palette, spines, grid, legend, line/point sizes and annotations from the ORIGINAL figure. Separate visible style from scientific data and statistical methods. Return exactly one fenced json object with schema ${SCHEMA}, followed by one fenced LANGUAGE code block and concise provenance/requirements/visual-review notes. JSON contract (all fields required; null means not applicable/unknown):
STYLE-ONLY ACCEPTANCE: The goal is executable code reproducing visual form and style, not recovering or validating scientific values. Inventory every visible layer before coding: background trajectories, foreground summaries, reference lines, facet strips, insets, legend symbols/order/title, annotation boxes and panel letters. Preserve these layers even when original observations are unavailable. Check geometry and layout, then axes/tick formatting, typography, colors, line/marker styles, legends, annotations and whitespace. Do not spend effort estimating values, recomputing statistics or scoring numeric agreement. Keep scientific data status honest. The common template supports an explicit --style-demo switch with labelled deterministic synthetic values and separate output filenames, so a missing CSV does not block a style trial. For custom geometry, implement the same --style-demo option with complete deterministic demo inputs inside the script, label every demo image STYLE DEMO, and explain that any transcribed statistics are decorative reference labels, not calculated evidence. Never use synthetic demonstrations to support scientific conclusions. A missing-data error is acceptable for supplied-data mode, but --style-demo must run without original observations. Do not silently simplify complex geometry to make it fit the common schema.
${JSON.stringify(example)}
Units: canvas inches, dpi integer, fontSize/lineWidth/pointSize in points. Allowed panel.type: line/scatter/bar/custom. Common templates support at most 6 panels arranged by layout.columns; each uses long-form CSV x/y plus optional series, filter and interval columns. series is null or {column:"group",order:["visible label"]}; filter is null or {column:"panel",value:"A"}; bar requires categories in visible order, linear axes and null x limits/ticks. Otherwise categories is null. interval is null or {kind:"sd|se|ci|range|unknown",lower:"lower",upper:"upper",level:null}; lower/upper are ENDPOINTS already calculated from documented methods, never error magnitudes. CI level may be a number 0..1 only when supported. Never relabel SD/SE/range as CI. Unknown interval semantics must remain unknown. Never silently aggregate replicates, smooth/EMA curves, interpolate absent values or invent samples. line/scatter x/y must be numeric, bars use categorical x and numeric y. Numeric ticks/limits or null. data.status is provided/digitized/missing, source cites supplied data location, notes describes missing values/units/estimation. Exact values only if supplied and attributable; do not silently fabricate data. Image-digitized values must be labelled estimates and retain uncertainty. No fabricated/random data as evidence. When data are missing use a header-only user-supplied data.csv with actionable required columns/file errors; never add sample evidence rows. For supplied exact/estimated values put a copyable fenced csv block named by data.file in the explanation; both languages must use that SAME CSV. Do not put datasets in the JSON. unresolved lists unknown scientific values and approximated layout choices.
For supported common panels the extension compiles its own shared Python/R templates from the validated JSON. Do not add undeclared transformations. For insets, broken axes, radar, heatmaps, special annotations, hatching, mixed geometry or other unsupported structures use type custom and explain them; provide the complete custom code rather than dropping those structures into a simpler common template. Only JSON fields above are supported. Use a palette with enough distinct hex colors. Do not install packages, invoke a shell, download data, use network calls or delete files. Use relative output names and export PNG/PDF/SVG at the declared physical size, retaining editable vector text. Keep data loading/validation, styling and plotting separate. Explain how to compare rendering against the reference: structure/layers/axis formatting first, then aspect/fonts/colors/legend/annotations/spacing; numeric recovery is outside style acceptance; record unresolved differences and rerun after one deliberate change. Never claim this script or visual review was executed. Original data/methods are required for exact scientific reproduction.`;
  globalThis.QFFigureSpec=Object.freeze({SCHEMA,validate,parseResponse,columns,csvHeader,templateReady,checkRevision,instructions});
})();
