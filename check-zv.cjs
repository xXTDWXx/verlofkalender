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
state.entries = [{id:'a',organizationId:'org',type:'zv',date:'2027-01-01',days:1,hours:0,createdAt:'x'}, {type:'leave',hours:8,date:'2027-04-01'},{type:'overtime',hours:2,date:'2027-04-02'},{type:'vov',hours:4,date:'2027-01-01'}];
assert.equal(getZvBalance().remaining,104);
assert.equal(getZvDayRemaining('2027-01-01'),0);
assert.equal(calculateBalance({createdAt:'2026-05-18',leaveStart:100,overtimeStart:0},state.entries,2027).balance,94);
const org = {createdAt:'2026-05-18', leaveStart:64, overtimeStart:3, annualLeaveHours:84};
const bookings = [...state.entries, {type:'leave',date:'2026-12-31',hours:4}];
assert.equal(calculateBalance(org,bookings,2026).balance,63);
assert.equal(calculateBalance(org,bookings,2027).balance,78);
assert.equal(calculateBalance(org,bookings,2028).balance,84);
assert.equal(getVovBalance().remaining,116);
assert.equal(formatEntryQuantity(state.entries[0]),'1 dag');
assert.ok(renderEntryItem(state.entries[0]).includes('ZV -1 dag'));
state.entries.shift();
assert.equal(getZvBalance().remaining,105);
currentUser={id:'test'};
renderBalances();
assert.ok(elements.summaryGrid.innerHTML.includes('105 dagen'));
assert.ok(elements.summaryGrid.innerHTML.includes('Plan ZV in 2027'));
state.entries = [];
`,context);
docHandlers.click({target:{closest(s){return s==='[data-plan-zv]' ? {} : null}}}).then(()=>{
  vm.runInContext(`assert.equal(selectedDate,'2027-01-01');assert.equal(elements.entryQuantityLabel.textContent,'Dagen');assert.equal(elements.entryHours.value,'1');assert.equal(elements.entryHours.readOnly,true);`,context);
  type='leave';
  vm.runInContext(`renderAllowanceHints();assert.equal(elements.entryQuantityLabel.textContent,'Uren');assert.equal(elements.entryHours.max,undefined);assert.equal(elements.entryHours.readOnly,false);assert.equal(elements.entryHours.value,'');`,context);
  console.log('PASS: year boundaries, days balance/refund, separate hour balances, display, 2027 shortcut and switching units');
}).catch(e=>{console.error(e);process.exitCode=1});
