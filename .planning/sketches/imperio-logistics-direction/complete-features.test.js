const assert = require("node:assert/strict");
const {calendarPosition,escapeHtml,isDuplicateName,personMatches,validEmployee,validPhone,weekLabel} = require("./complete-features.js");

assert.equal(validEmployee("Ana Lima","Motorista"),true);
assert.equal(validEmployee("Ana","Motorista"),false);
assert.equal(validPhone(""),true);
assert.equal(validPhone("(71) 99999-1234"),true);
assert.equal(validPhone("123"),false);
assert.equal(validPhone("abc71xyz999991234"),false);
assert.equal(isDuplicateName("  ANA   LIMA ",[{name:"Ana Lima"}]),true);
assert.equal(personMatches("Ana Lima · Equipe Norte","ana","Equipe Norte"),true);
assert.equal(personMatches("Ana Lima · Equipe Norte","ana","Equipe Sul"),false);
assert.equal(weekLabel(0),"31 ago–4 set 2026");
assert.equal(weekLabel(2),"14–18 set 2026");
assert.deepEqual(calendarPosition("2026-08-31","08:00"),{week:0,day:0,row:0,cellIndex:0});
assert.deepEqual(calendarPosition("2026-09-01","14:00"),{week:0,day:1,row:3,cellIndex:16});
assert.deepEqual(calendarPosition("2026-09-07","10:00"),{week:1,day:0,row:1,cellIndex:5});
assert.equal(calendarPosition("2026-09-05","10:00"),null);
assert.equal(calendarPosition("2026-09-07","99:99"),null);
assert.equal(calendarPosition("2026-09-07","07:59"),null);
assert.equal(calendarPosition("2026-09-07","18:00"),null);
assert.equal(escapeHtml('<img src=x onerror="1">'),"&lt;img src=x onerror=&quot;1&quot;&gt;");

console.log("complete-features: checks passed");
