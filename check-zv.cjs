const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const nodes = new Map();
const docHandlers = {};
let type = 'leave';
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { value: '', dataset: {}, classList: {toggle(){},add(){},remove(){}}, addEventListener(){}, removeAttribute(k){delete this[k]}, insertAdjacentHTML(_,s){this.innerHTML+=s}, querySelector(){return {set checked(v){if(v)type='zv'}}}, focus(){} });
  return nodes.get(id);
}
const context = vm.createContext({assert, structuredClone, Intl, Date, console, setTimeout(){}, clearTimeout(){}, createClient(){return {}}, FormData: class {get(){return type}}, document:{querySelector:node,querySelectorAll(){return []},addEventListener(k,cb){docHandlers[k]=cb},body:node('body')}});
const source = fs.readFileSync(__dirname+'/app.js','utf8').replace(/^import .*\n/,'').replace('\ninitialize();','');
vm.runInContext(source, context);
vm.runInContext(`
assert.equal(isZvDate('2026-12-31'),false);
assert.equal(isZvDate('2027-01-01'),true);
assert.equal(isZvDate('2027-12-31'),true);
assert.equal(isZvDate('2028-01-01'),false);
assert.equal(getZvBalance().remaining,105);
state.entries = [{id:'a',organizationId:'org',type:'zv',date:'2027-01-01',days:0.5,hours:0,createdAt:'x'}, {type:'leave',hours:8},{type:'overtime',hours:2},{type:'vov',hours:4,date:'2027-01-01'}];
assert.equal(getZvBalance().remaining,104.5);
assert.equal(getZvDayRemaining('2027-01-01'),0.5);
assert.equal(calculateBalance({leaveStart:100,overtimeStart:0},state.entries).balance,94);
assert.equal(getVovBalance().remaining,116);
assert.equal(formatEntryQuantity(state.entries[0]),'0,5 dagen');
assert.ok(renderEntryItem(state.entries[0]).includes('ZV -0,5 dagen'));
state.entries.shift();
assert.equal(getZvBalance().remaining,105);
currentUser={id:'test'};
renderBalances();
assert.ok(elements.summaryGrid.innerHTML.includes('105 dagen'));
assert.ok(elements.summaryGrid.innerHTML.includes('Plan ZV in 2027'));
state.entries = [];
`,context);
docHandlers.click({target:{closest(s){return s==='[data-plan-zv]' ? {} : null}}}).then(()=>{
  vm.runInContext(`assert.equal(selectedDate,'2027-01-01');assert.equal(elements.entryQuantityLabel.textContent,'Dagen');assert.equal(elements.entryHours.max,1);`,context);
  type='leave';
  vm.runInContext(`renderAllowanceHints();assert.equal(elements.entryQuantityLabel.textContent,'Uren');assert.equal(elements.entryHours.max,undefined);`,context);
  console.log('PASS: year boundaries, days balance/refund, separate hour balances, display, 2027 shortcut and switching units');
}).catch(e=>{console.error(e);process.exitCode=1});
