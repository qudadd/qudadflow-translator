// Compare only crops from the same document page in the same coordinate system.
export function pdfRegionMatch(a,b) {
  if(!a||!b)return null;
  const areaA=a.width*a.height,areaB=b.width*b.height;
  if(!(areaA>0&&areaB>0))return null;
  const overlap=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  const smaller=overlap/Math.min(areaA,areaB),larger=overlap/Math.max(areaA,areaB);
  const named=r=>Boolean(r.identity)&&!r.identity.startsWith('ai:');
  const same=named(a)&&named(b)&&a.identity===b.identity;
  const conflict=named(a)&&named(b)&&a.identity!==b.identity;
  const table=a.kind==='table'&&b.kind==='table';
  const spatial=table?(larger>=.72||smaller>=.93&&(conflict?larger>=.65:larger>=.18)):larger>=.9;
  if(!same&&!spatial)return null;
  return {same,spatial,conflict,overlap,smaller,larger,areaA,areaB};
}
