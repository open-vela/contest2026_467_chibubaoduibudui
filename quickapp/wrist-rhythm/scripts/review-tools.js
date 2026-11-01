const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function pageShown(log) {
  if (/Page show page_info:.*pages\/index/.test(log)) return true;
  return [...log.matchAll(/WRIST_AUDIT (\{[^\r\n]+\})/g)].some(m=>{
    try {const a=JSON.parse(m[1]);return a.event==='show' && typeof a.timestamp==='number' && typeof a.view==='string';}catch{return false;}
  });
}
function pageHidden(log) {
  if (/Page hide page_info:.*pages\/index/.test(log)) return true;
  if (/\[AIOTJS\].*AppCallHook name:onHide/.test(log) && /\[home\].*on_resume/.test(log)) return true;
  return [...log.matchAll(/WRIST_AUDIT (\{[^\r\n]+\})/g)].some(m=>{
    try {const a=JSON.parse(m[1]);return a.event==='hide' && typeof a.timestamp==='number' && typeof a.view==='string';}catch{return false;}
  });
}
function testCounts(log) {
  const legacy = [...log.matchAll(/^(\d+) (?:tests|runtime tests|page lifecycle tests|component contract tests|release runner tests) passed\s*$/gm)].reduce((n,m)=>n+Number(m[1]),0);
  const summaries = [...log.matchAll(/(?:ℹ|#) pass (\d+)/g)];
  const failures = [...log.matchAll(/(?:ℹ|#) fail (\d+)/g)];
  if (!legacy || !summaries.length || failures.length !== summaries.length || failures.some(m=>+m[1])) throw Error('failed or incomplete test evidence');
  return { passed:legacy+summaries.reduce((n,m)=>n+Number(m[1]),0), failed:0 };
}
function installState(log, packageName) {
  const escaped=packageName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const token=new RegExp(`(?:^|[^A-Za-z0-9._-])${escaped}(?=$|[^A-Za-z0-9._-])`);
  const lines = log.split(/\r?\n/).filter(l=>token.test(l));
  if (lines.some(l=>/install.*(?:failed|failure|error)/i.test(l))) return 'failed';
  return lines.some(l=>/install success:/i.test(l) || /executeInstall.*rpk install:.*success\s*$/i.test(l)) ? 'success' : 'pending';
}
function inside(root, relative) {
  const absolute = path.resolve(root, relative);
  if (!absolute.startsWith(path.resolve(root)+path.sep)) throw Error(`outside delivery: ${relative}`);
  return absolute;
}
function files(root) {
  return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(root,e.name)): [path.join(root,e.name)]);
}
function checkLinks(root) {
  for (const file of files(root).filter(f=>f.endsWith('.md'))) {
    const md = fs.readFileSync(file,'utf8');
    const inline=[...md.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^)]*["'])?\)/g)].map(m=>m[1]||m[2]);
    const references=[...md.matchAll(/^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm)].map(m=>m[1]||m[2]);
    for (const link of [...inline,...references]) {
      if (/^(?:https?:|#)/.test(link)) continue;
      const target = decodeURIComponent(link.split('#')[0]);
      const relative = path.relative(root,path.resolve(path.dirname(file), target));
      if (!fs.existsSync(inside(root, relative))) throw Error(`missing link in ${path.relative(root,file)}: ${link}`);
    }
  }
}
function verifyZip(zip, artifacts) {
  for (const a of artifacts) {
    const e = zip.getEntry(a.name);
    if (!e || hash(e.getData()) !== a.sha256) throw Error(`ZIP RPK hash mismatch: ${a.name}`);
  }
}
module.exports = { hash, pageShown, pageHidden, testCounts, installState, inside, files, checkLinks, verifyZip };
