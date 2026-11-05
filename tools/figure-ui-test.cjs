// Drive the same gallery -> native inspector route used by readers.
async function closeInspector(page){
  const close=page.locator('#figureInspector[open] #closeFigureInspector');
  if(await close.count())await close.click();
}
async function workbenchView(page,stage){
  await closeInspector(page);
  await page.locator('#figureWorkflow').evaluate(e=>e.open=true);
  const tab=page.locator('#figure-tab-'+stage);
  if(await tab.getAttribute('aria-selected')!=='true')await tab.click();
  if(stage==='analysis')await page.locator('.question-figures').evaluate(e=>e.open=true);
  if(stage==='acquire')await page.locator('.workbench-manual').evaluate(e=>e.open=true);
  if(stage==='gallery'){
    const supplement=page.locator('.workbench-web-supplement');
    if(await supplement.count())await supplement.evaluate(e=>e.open=true);
  }
}
async function inspectFigure(page,index=0,view='analysis'){
  const card=page.locator('.figure-card').nth(index),key=await card.getAttribute('data-key');
  await workbenchView(page,'gallery');
  const search=page.locator('#figureSearch');
  if(await search.isEnabled())await search.fill('');
  const at=await page.locator('.figure-tile').evaluateAll((tiles,key)=>tiles.findIndex(t=>t.dataset.key===key),key);
  if(at<0)throw new Error('Figure missing from gallery: '+key);
  await page.locator('.figure-tile').nth(at).getByRole('button',{name:'打开解析浮窗',exact:true}).click();
  await figureView(page,view);
  return card;
}
async function figureView(page,view){
  await page.locator('#figureInspector .figure-detail-tabs').getByRole('tab',{name:view==='analysis'?'图表解读':view==='r'?'R':'Python',exact:true}).click();
}
async function removeFigure(page,index=0){
  const card=await inspectFigure(page,index);
  await card.locator('.figure-detail-more>summary').click();
  await card.getByRole('button',{name:'移除',exact:true}).click();
}
module.exports={closeInspector,workbenchView,inspectFigure,figureView,removeFigure};
