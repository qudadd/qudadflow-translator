// Plot settings only. Actual data are exported from the local R datasets package.
export function exampleSpec(type='line'){
  return {
    schema:'qudadflow.figure/v1',title:'ToothGrowth: mean and sample SD',
    data:{file:'summary.csv',status:'provided',source:'R datasets::ToothGrowth (60 observations)',notes:'Grouped by supp and dose: arithmetic mean, sample SD (n-1 denominator), n=10 per group; lower=mean-SD, upper=mean+SD. SD is descriptive spread, not a confidence interval. Original dataset source: C. I. Bliss (1952), The Statistics of Bioassay. This example does not reproduce a published figure.'},
    canvas:{width:6.4,height:4,dpi:300},layout:{columns:1},
    style:{fontFamily:'sans',fontSize:10,palette:['#0072B2','#D55E00'],lineWidth:1.5,pointSize:4,grid:false,spines:'left-bottom',legend:'top'},
    panels:[{id:'A',type,title:'',x:{column:'dose',label:'Vitamin C dose (mg/day)',scale:'linear',limits:type==='bar'?null:[.4,2.1],ticks:type==='bar'?null:[.5,1,2]},y:{column:'value',label:'Odontoblast length',scale:'linear',limits:[0,40],ticks:[0,10,20,30,40]},series:{column:'supp',order:['OJ','VC']},categories:type==='bar'?['0.5','1','2']:null,interval:{kind:'sd',lower:'lower',upper:'upper',level:null},filter:null}],
    unresolved:['Original paper layout is not supplied. This is a runtime/parity demonstration, not a pixel similarity benchmark.','Dataset documentation does not give a length unit; no unit is inferred.']
  };
}
export function panelExample(){
  const spec=exampleSpec();spec.title='ToothGrowth: observations and mean +/- SD';spec.data.file='panels.csv';spec.canvas.width=10;spec.layout.columns=2;
  spec.panels[0].title='A  Individual observations';spec.panels[0].type='scatter';spec.panels[0].interval=null;spec.panels[0].filter={column:'kind',value:'raw'};
  spec.panels[0].x.scale='log';spec.panels[0].x.limits=[.4,2.5];
  const line=exampleSpec().panels[0];line.id='B';line.title='B  Mean +/- sample SD';line.filter={column:'kind',value:'summary'};spec.panels.push(line);
  return spec;
}
