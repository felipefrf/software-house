const featureStyles = `<style>
.feature-tools{align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:14px;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;margin-bottom:14px;padding:10px}.tool-group{align-items:center;display:flex;flex-wrap:wrap;gap:7px}.tool-button,.tool-input,.tool-select{background:var(--surface);border:1px solid var(--line);border-radius:8px;color:var(--ink);font-size:12px;min-height:38px;padding:8px 10px}.tool-button{font-weight:700}.tool-button.primary{background:var(--purple);border-color:var(--purple);color:white}.tool-button[aria-pressed=true]{background:var(--purple-soft);border-color:#d8d0fb;color:var(--purple)}.tool-input{min-width:220px}.week-label{font-size:13px;font-weight:750;min-width:185px;text-align:center}.feature-drawer{background:rgba(34,48,42,.35);border:0;height:100%;margin:0;max-height:none;max-width:none;padding:0 0 0 max(0px,calc(100vw - 500px));width:100%}.feature-drawer::backdrop{background:rgba(34,48,42,.2)}.drawer-shell{background:var(--surface);box-shadow:-12px 0 36px rgba(34,48,42,.14);display:flex;flex-direction:column;height:100%;margin-left:auto;max-width:500px;width:100%}.drawer-head{align-items:flex-start;border-bottom:1px solid var(--line);display:flex;gap:16px;justify-content:space-between;padding:20px}.drawer-head h2{font-size:20px}.drawer-head p{color:var(--muted);font-size:12px;margin-top:4px}.icon-button{align-items:center;background:var(--sage);border:0;border-radius:8px;display:inline-flex;height:38px;justify-content:center;width:38px}.icon-button svg,.tool-button svg{fill:none;height:18px;stroke:currentColor;stroke-width:2;width:18px}.drawer-body{overflow:auto;padding:20px}.drawer-actions{background:var(--surface);border-top:1px solid var(--line);display:flex;gap:8px;justify-content:flex-end;margin-top:auto;padding:14px 20px}.form-grid{display:grid;gap:14px;grid-template-columns:1fr 1fr}.field{display:grid;gap:5px}.field.full{grid-column:1/-1}.field label{font-size:12px;font-weight:700}.field input,.field select,.field textarea{background:var(--surface);border:1px solid var(--line);border-radius:8px;color:var(--ink);font:inherit;font-size:13px;min-height:42px;padding:9px 10px}.field textarea{min-height:80px;resize:vertical}.field small{color:var(--muted);font-size:12px}.field [aria-invalid=true]{border-color:var(--red)}.form-error{background:var(--red-soft);border-radius:8px;color:var(--red);display:none;font-size:12px;margin-bottom:13px;padding:10px}.form-error.visible{display:block}.detail-list{border-top:1px solid var(--line);margin-top:16px}.detail-row{align-items:start;border-bottom:1px solid var(--line);display:grid;gap:15px;grid-template-columns:120px 1fr;padding:12px 0}.detail-row span{color:var(--muted);font-size:12px}.detail-row strong{font-size:13px}.detail-checks{margin-top:18px}.detail-checks h3{font-size:14px}.detail-check{align-items:center;border-top:1px solid var(--line);display:grid;gap:10px;grid-template-columns:20px 1fr;padding:11px 0}.detail-check i{border:2px solid var(--green);height:18px;width:18px}.session-note{background:var(--amber-soft);border:1px solid #ecd49d;border-radius:8px;color:var(--amber);font-size:12px;margin-bottom:14px;padding:9px}.generated-avatar{background:var(--purple-soft);border-radius:10px;color:var(--purple);display:grid;font-size:18px;font-weight:800;height:72px;place-items:center;width:72px}.person{cursor:pointer}.person:focus-visible{outline:3px solid #9d91df;outline-offset:2px}.calendar-empty,.people-empty{color:var(--muted);font-size:13px;padding:28px;text-align:center}.calendar-empty{grid-column:2/-1}.people-empty{background:var(--surface);border:1px dashed var(--line);border-radius:14px;grid-column:1/-1}.toast{background:var(--ink);border-radius:9px;bottom:22px;color:white;font-size:13px;left:50%;opacity:0;padding:11px 14px;position:fixed;transform:translate(-50%,20px);transition:transform .18s ease-out,opacity .18s;z-index:30}.toast.visible{opacity:1;transform:translate(-50%,0)}
@media(max-width:780px){.feature-tools{align-items:stretch}.tool-group{width:100%}.tool-input,.tool-select{flex:1;min-width:0}.feature-drawer{padding:0}.drawer-shell{max-width:none}.form-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.week-label{flex:1;min-width:0}.detail-row{grid-template-columns:95px 1fr}}
</style>`;

const employeeSeed = [
  {name:"Lívia Alves",role:"Coordenação",team:"Equipe Norte",access:"Ativo",status:"Em operação",phone:"",note:""},
  {name:"Rafael Costa",role:"Motorista",team:"Equipe Norte",access:"Ativo",status:"Em operação",phone:"",note:""},
  {name:"Camila Souza",role:"Líder de montagem",team:"Equipe Centro",access:"Ativo",status:"Revisar",phone:"",note:""},
  {name:"João Nascimento",role:"Assistente",team:"Equipe Apoio",access:"Convite pendente",status:"Disponível",phone:"",note:""},
];

const calendarDetails = {
  "Montagem Solar": {event:"Montagem Solar",time:"08:30–11:00",team:"Equipe Norte",vehicle:"VUC 01",place:"Casa Solar · Acesso de serviço",stage:"Montagem"},
  "Congresso Bahia": {event:"Congresso Bahia",time:"10:05–18:00",team:"Equipe Sul",vehicle:"Van 02",place:"Centro de Convenções · Doca 4",stage:"Deslocamento"},
  "Festival de Inverno": {event:"Festival de Inverno",time:"12:20–19:15",team:"Equipe Norte",vehicle:"VUC 03",place:"Parque da Cidade · Portão C",stage:"Saída"},
  "Casamento Marina": {event:"Casamento Marina",time:"14:10–23:30",team:"Equipe Centro",vehicle:"VUC 02",place:"Espaço Marina · Entrada lateral",stage:"Preparação"},
  "Retorno Franquias": {event:"Retorno Franquias",time:"16:40–18:20",team:"Equipe Leste",vehicle:"Van 04",place:"Base da Império",stage:"Retorno"},
};

const calendarBase = Date.UTC(2026,7,31), dayMs = 86400000, weekMs = dayMs * 7;
const months = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[character]);
const normalizedName = value => value.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g," ");
const validEmployee = (name,role) => name.trim().split(/\s+/).filter(part => part.length >= 2).length >= 2 && Boolean(role);
const validPhone = phone => !phone.trim() || /^[\d()+\-\s]+$/.test(phone) && [10,11].includes(phone.replace(/\D/g,"").length);
const isDuplicateName = (name,employees) => employees.some(employee => normalizedName(employee.name) === normalizedName(name));
const personMatches = (text,query,team) => (!query || text.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))) && (team === "all" || text.includes(team));
const svgIcon = path => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

function weekDates(offset) {
  const monday = new Date(calendarBase + offset * weekMs);
  return {monday,friday:new Date(monday.getTime() + dayMs * 4)};
}

function weekLabel(offset) {
  const {monday,friday} = weekDates(offset), startMonth = months[monday.getUTCMonth()], endMonth = months[friday.getUTCMonth()];
  return `${monday.getUTCDate()}${startMonth === endMonth ? "" : ` ${startMonth}`}–${friday.getUTCDate()} ${endMonth} ${friday.getUTCFullYear()}`;
}

function calendarPosition(date,start) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) return null;
  const [hour,minute] = start.split(":").map(Number);
  if (hour < 8 || hour > 17 || minute > 59) return null;
  const [year,month,day] = date.split("-").map(Number), timestamp = Date.UTC(year,month - 1,day), parsed = new Date(timestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  const weekday = (parsed.getUTCDay() + 6) % 7;
  if (weekday > 4) return null;
  const row = Math.max(0,Math.min(4,Math.floor((hour - 8) / 2)));
  return {week:Math.floor((timestamp - calendarBase) / weekMs),day:weekday,row,cellIndex:row * 5 + weekday};
}

function ensureDrawer() {
  if (document.querySelector("#feature-drawer")) return document.querySelector("#feature-drawer");
  document.body.insertAdjacentHTML("beforeend", `<dialog class="feature-drawer" id="feature-drawer" aria-labelledby="drawer-title" aria-describedby="drawer-copy"><section class="drawer-shell"><header class="drawer-head"><div><h2 id="drawer-title"></h2><p id="drawer-copy"></p></div><button class="icon-button" type="button" data-close aria-label="Fechar">${svgIcon("M6 6l12 12M18 6 6 18")}</button></header><div class="drawer-body" id="drawer-body"></div><footer class="drawer-actions" id="drawer-actions"></footer></section></dialog><div class="toast" id="feature-toast" role="status" aria-live="polite"></div>`);
  const drawer = document.querySelector("#feature-drawer");
  drawer.querySelector("[data-close]").addEventListener("click",() => drawer.close());
  drawer.addEventListener("click",event => { if (event.target === drawer) drawer.close(); });
  return drawer;
}

function showToast(message) {
  const toast = document.querySelector("#feature-toast");
  toast.textContent = message;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"),2200);
}

function openDrawer(title,copy,body,actions = "") {
  const drawer = ensureDrawer();
  drawer.querySelector("#drawer-title").textContent = title;
  drawer.querySelector("#drawer-copy").textContent = copy;
  drawer.querySelector("#drawer-body").innerHTML = body;
  drawer.querySelector("#drawer-actions").innerHTML = actions;
  drawer.showModal();
  return drawer;
}

function showFormError(form,error,message,fields) {
  error.textContent = message;
  error.classList.add("visible");
  fields.forEach(name => form.elements[name]?.setAttribute("aria-invalid","true"));
  form.elements[fields[0]]?.focus();
}

function eventDetail(detail) {
  const known = detail.event === "Festival de Inverno";
  const drawer = openDrawer(detail.event,"Detalhe demonstrativo da agenda",`<div class="session-note">Dados de exemplo · nenhuma alteração será persistida.</div><div class="detail-list"><div class="detail-row"><span>Janela</span><strong>${escapeHtml(detail.time)}</strong></div><div class="detail-row"><span>Etapa atual</span><strong>${escapeHtml(detail.stage)}</strong></div><div class="detail-row"><span>Equipe</span><strong>${escapeHtml(detail.team)}</strong></div><div class="detail-row"><span>Veículo</span><strong>${escapeHtml(detail.vehicle)}</strong></div><div class="detail-row"><span>Local</span><strong>${escapeHtml(detail.place)}</strong></div></div><div class="detail-checks"><h3>Antes da operação</h3><div class="detail-check"><i></i><span>Equipe e responsável definidos</span></div><div class="detail-check"><i></i><span>Veículo vinculado</span></div><div class="detail-check"><i></i><span>Janela do local confirmada</span></div></div>`,`<button class="tool-button" type="button" data-close-footer>Fechar</button>${known?'<a class="tool-button primary" href="a2-refined.html?event=festival">Abrir operação</a>':""}`);
  drawer.querySelector("[data-close-footer]").addEventListener("click",() => drawer.close());
}

const employeeRecords = [...employeeSeed];
let sessionEmployeeCount = 0;

function employeeForm() {
  const drawer = openDrawer("Cadastrar funcionário","Cadastro interno da Império",`<div class="session-note">Protótipo: o cadastro permanece somente nesta aba até recarregar. Nenhum convite será enviado.</div><form id="employee-form" novalidate><div class="form-error" id="employee-error" role="alert" aria-live="assertive"></div><div class="form-grid"><div class="field full"><label for="employee-name">Nome completo</label><input id="employee-name" name="name" autocomplete="name" required aria-describedby="employee-name-help employee-error"><small id="employee-name-help">Use nome e sobrenome como aparecerão na escala.</small></div><div class="field"><label for="employee-role">Função</label><select id="employee-role" name="role" required aria-describedby="employee-error"><option value="">Selecione</option><option>Coordenação</option><option>Líder de campo</option><option>Motorista</option><option>Líder de montagem</option><option>Assistente de logística</option></select></div><div class="field"><label for="employee-team">Equipe</label><select id="employee-team" name="team"><option>Equipe Norte</option><option>Equipe Sul</option><option>Equipe Centro</option><option>Equipe Leste</option><option>Equipe Apoio</option></select></div><div class="field"><label for="employee-phone">Celular</label><input id="employee-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="(00) 00000-0000" aria-describedby="employee-phone-help employee-error"><small id="employee-phone-help">Opcional, com DDD.</small></div><div class="field"><label for="employee-access">Acesso ao app</label><select id="employee-access" name="access"><option value="intent">Registrar intenção de convite</option><option value="none">Sem acesso</option></select></div><div class="field full"><label for="employee-note">Observação</label><textarea id="employee-note" name="note" placeholder="CNH, disponibilidade ou informação operacional"></textarea></div></div></form>`,`<button class="tool-button" type="button" data-cancel>Cancelar</button><button class="tool-button primary" type="submit" form="employee-form">Adicionar funcionário</button>`);
  drawer.querySelector("[data-cancel]").addEventListener("click",() => drawer.close());
  drawer.querySelector("#employee-form").addEventListener("submit",event => {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), name = String(data.get("name")).trim(), role = String(data.get("role")), phone = String(data.get("phone")).trim(), error = drawer.querySelector("#employee-error");
    form.querySelectorAll("[aria-invalid]").forEach(field => field.removeAttribute("aria-invalid"));
    const employeeFields = [];
    if (!validEmployee(name,"selected")) employeeFields.push("name");
    if (!role) employeeFields.push("role");
    if (employeeFields.length) return showFormError(form,error,"Informe nome e sobrenome, além da função.",employeeFields);
    if (!validPhone(phone)) return showFormError(form,error,"Informe um celular válido com DDD, ou deixe o campo vazio.",["phone"]);
    if (isDuplicateName(name,employeeRecords)) return showFormError(form,error,"Já existe uma pessoa com esse nome nesta lista.",["name"]);
    const access = data.get("access") === "intent" ? "Convite não enviado" : "Sem acesso";
    const employee = {name,role,team:String(data.get("team")),phone,note:String(data.get("note")).trim(),access,status:"Disponível"};
    employeeRecords.push(employee);
    addEmployee(employee);
    drawer.close();
    showToast(`${name} foi adicionado somente nesta sessão.`);
  });
  setTimeout(() => drawer.querySelector("#employee-name").focus(),0);
}

function addEmployee(employee) {
  const grid = document.querySelector(".people-grid");
  if (!grid) return;
  const initials = employee.name.split(/\s+/).slice(0,2).map(part => part[0]).join("").toUpperCase(), card = document.createElement("article");
  card.className = "person session-person";
  card.dataset.name = normalizedName(employee.name);
  card.dataset.team = employee.team;
  card.innerHTML = `<span class="generated-avatar" aria-hidden="true">${escapeHtml(initials)}</span><div><h2>${escapeHtml(employee.name)}</h2><p>${escapeHtml(employee.role)} · ${escapeHtml(employee.team)}</p><p>${escapeHtml(employee.access)}</p></div><span class="pill">${escapeHtml(employee.status)}</span>`;
  grid.prepend(card);
  bindPerson(card,employee);
  sessionEmployeeCount += 1;
  const count = document.querySelector(".summary div:first-child strong");
  if (count) count.textContent = String(27 + sessionEmployeeCount);
  applyPeopleFilters();
}

function personDetail(employee) {
  const drawer = openDrawer(employee.name,"Ficha interna demonstrativa",`<div class="session-note">Dados de exemplo ou criados somente nesta sessão.</div><div class="detail-list"><div class="detail-row"><span>Função</span><strong>${escapeHtml(employee.role)}</strong></div><div class="detail-row"><span>Equipe</span><strong>${escapeHtml(employee.team)}</strong></div><div class="detail-row"><span>Celular</span><strong>${escapeHtml(employee.phone || "Não informado")}</strong></div><div class="detail-row"><span>Acesso</span><strong>${escapeHtml(employee.access)}</strong></div><div class="detail-row"><span>Situação</span><strong>${escapeHtml(employee.status)}</strong></div><div class="detail-row"><span>Observação</span><strong>${escapeHtml(employee.note || "Sem observação")}</strong></div></div><div class="detail-checks"><h3>Próximas ações</h3><div class="detail-check"><i></i><span>Revisar disponibilidade semanal</span></div><div class="detail-check"><i></i><span>Confirmar dados de contato</span></div></div>`,`<button class="tool-button" type="button" data-close-footer>Fechar</button>`);
  drawer.querySelector("[data-close-footer]").addEventListener("click",() => drawer.close());
}

function bindPerson(card,employee) {
  card.tabIndex = 0;
  card.setAttribute("role","button");
  card.setAttribute("aria-label",`Abrir ficha de ${employee.name}`);
  const open = () => personDetail(employee);
  card.addEventListener("click",open);
  card.addEventListener("keydown",event => { if (["Enter"," "].includes(event.key)) { event.preventDefault(); open(); } });
}

function applyPeopleFilters() {
  const query = document.querySelector("#people-search")?.value.trim() || "", team = document.querySelector("#people-team")?.value || "all";
  let visible = 0;
  document.querySelectorAll(".people-grid .person").forEach(card => { card.hidden = !personMatches(card.textContent,query,team); if (!card.hidden) visible += 1; });
  const empty = document.querySelector("#people-empty");
  if (empty) empty.hidden = visible > 0;
}

function setupPeople() {
  const grid = document.querySelector(".people-grid");
  if (!grid) return;
  grid.insertAdjacentHTML("beforebegin",`<div class="feature-tools"><div class="tool-group"><input class="tool-input" id="people-search" type="search" placeholder="Buscar por nome ou função" aria-label="Buscar funcionários"><select class="tool-select" id="people-team" aria-label="Filtrar por equipe"><option value="all">Todas as equipes</option><option>Equipe Norte</option><option>Equipe Sul</option><option>Equipe Centro</option><option>Equipe Leste</option><option>Equipe Apoio</option></select></div><button class="tool-button primary" type="button" data-new-employee>Cadastrar funcionário</button></div>`);
  grid.insertAdjacentHTML("beforeend",`<p class="people-empty" id="people-empty" hidden>Nenhuma pessoa corresponde aos filtros.</p>`);
  document.querySelector("#people-search").addEventListener("input",applyPeopleFilters);
  document.querySelector("#people-team").addEventListener("change",applyPeopleFilters);
  document.querySelector("[data-new-employee]").addEventListener("click",employeeForm);
  document.querySelectorAll(".people-grid .person").forEach((card,index) => bindPerson(card,employeeSeed[index]));
}

let calendarOffset = 0, calendarTeam = "all", sessionOperationCount = 0;

function updateDayHeaders() {
  const headers = document.querySelectorAll(".calendar .cal-head"), {monday} = weekDates(calendarOffset), weekdays = ["SEG","TER","QUA","QUI","SEX"];
  weekdays.forEach((weekday,index) => { const date = new Date(monday.getTime() + index * dayMs); headers[index + 1].textContent = `${weekday} ${String(date.getUTCDate()).padStart(2,"0")}`; });
}

function applyCalendarView() {
  const label = document.querySelector(".week-label"), calendar = document.querySelector(".calendar");
  if (!label || !calendar) return;
  label.textContent = weekLabel(calendarOffset);
  updateDayHeaders();
  let visible = 0;
  calendar.querySelectorAll(".cal-event").forEach(item => { item.hidden = Number(item.dataset.week) !== calendarOffset || (calendarTeam !== "all" && item.dataset.team !== calendarTeam); if (!item.hidden) visible += 1; });
  const empty = calendar.querySelector(".calendar-empty");
  if (empty) empty.hidden = visible > 0;
}

function operationForm() {
  const drawer = openDrawer("Nova operação","Inclua um evento na agenda demonstrativa",`<div class="session-note">Protótipo: a operação permanece somente nesta aba até recarregar.</div><form id="operation-form" novalidate><div class="form-error" id="operation-error" role="alert" aria-live="assertive"></div><div class="form-grid"><div class="field full"><label for="operation-name">Nome do evento</label><input id="operation-name" name="name" required aria-describedby="operation-error"></div><div class="field"><label for="operation-date">Data</label><input id="operation-date" name="date" type="date" value="2026-08-31" required aria-describedby="operation-error"></div><div class="field"><label for="operation-start">Horário de preparação</label><input id="operation-start" name="start" type="time" value="08:00" required aria-describedby="operation-error"></div><div class="field"><label for="operation-team">Equipe</label><select id="operation-team" name="team"><option>Equipe Norte</option><option>Equipe Sul</option><option>Equipe Centro</option><option>Equipe Leste</option></select></div><div class="field"><label for="operation-vehicle">Veículo</label><select id="operation-vehicle" name="vehicle"><option>VUC 03</option><option>VUC 01</option><option>Van 02</option><option>Van 04</option></select></div><div class="field full"><label for="operation-place">Local e acesso</label><input id="operation-place" name="place" placeholder="Local · portão ou doca" required aria-describedby="operation-error"></div></div></form>`,`<button class="tool-button" type="button" data-cancel>Cancelar</button><button class="tool-button primary" type="submit" form="operation-form">Adicionar à agenda</button>`);
  drawer.querySelector("[data-cancel]").addEventListener("click",() => drawer.close());
  drawer.querySelector("#operation-form").addEventListener("submit",event => {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), name = String(data.get("name")).trim(), place = String(data.get("place")).trim(), date = String(data.get("date")), start = String(data.get("start")), error = drawer.querySelector("#operation-error"), position = calendarPosition(date,start);
    form.querySelectorAll("[aria-invalid]").forEach(field => field.removeAttribute("aria-invalid"));
    if (name.length < 3 || !place || !date || !start) return showFormError(form,error,"Informe nome, data, horário e local do evento.",[name.length < 3 ? "name" : !date ? "date" : !start ? "start" : "place"]);
    if (!position) return showFormError(form,error,"Escolha uma data de segunda a sexta-feira e um horário válido.",["date","start"]);
    const detail = {event:name,time:`${start} · ${date.split("-").reverse().join("/")}`,team:String(data.get("team")),vehicle:String(data.get("vehicle")),place,stage:"Planejada"};
    const cell = document.querySelectorAll(".cal-cell")[position.cellIndex], button = document.createElement("button");
    button.className = "cal-event session-event";
    button.type = "button";
    button.dataset.week = String(position.week);
    button.dataset.team = detail.team;
    button.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(start)} · ${escapeHtml(detail.team.replace("Equipe ",""))}</span>`;
    button.addEventListener("click",() => eventDetail(detail));
    cell.append(button);
    sessionOperationCount += 1;
    const count = document.querySelector(".summary div:first-child strong");
    if (count) count.textContent = String(23 + sessionOperationCount);
    calendarOffset = position.week;
    calendarTeam = "all";
    document.querySelector("#calendar-team").value = "all";
    applyCalendarView();
    drawer.close();
    showToast(`${name} foi adicionado somente nesta sessão.`);
  });
  setTimeout(() => drawer.querySelector("#operation-name").focus(),0);
}

function setupCalendar() {
  const calendar = document.querySelector(".calendar");
  if (!calendar) return;
  calendar.insertAdjacentHTML("beforebegin",`<div class="feature-tools"><div class="tool-group"><button class="tool-button" type="button" data-week="prev" aria-label="Semana anterior">${svgIcon("M15 18l-6-6 6-6")}</button><strong class="week-label">${weekLabel(0)}</strong><button class="tool-button" type="button" data-week="next" aria-label="Próxima semana">${svgIcon("M9 18l6-6-6-6")}</button><button class="tool-button" type="button" data-week="base">Semana base</button></div><div class="tool-group"><select class="tool-select" id="calendar-team" aria-label="Filtrar agenda por equipe"><option value="all">Todas as equipes</option><option>Equipe Norte</option><option>Equipe Sul</option><option>Equipe Centro</option><option>Equipe Leste</option></select><button class="tool-button primary" type="button" data-new-operation>Nova operação</button></div></div>`);
  calendar.insertAdjacentHTML("beforeend",`<p class="calendar-empty" hidden>Nenhuma operação demonstrativa nesta semana.</p>`);
  calendar.querySelectorAll(".cal-event").forEach(item => {
    const title = item.querySelector("strong").textContent, detail = calendarDetails[title] || {event:title,time:item.querySelector("span").textContent,team:"A definir",vehicle:"A definir",place:"A definir",stage:"Planejada"};
    item.dataset.week = "0";
    item.dataset.team = detail.team;
    item.setAttribute("role","button");
    const open = event => { event.preventDefault(); event.stopImmediatePropagation(); eventDetail(detail); };
    item.addEventListener("click",open,true);
    item.addEventListener("keydown",event => { if (event.key === " ") open(event); });
  });
  document.querySelectorAll("[data-week]").forEach(button => button.addEventListener("click",() => { calendarOffset = button.dataset.week === "base" ? 0 : calendarOffset + (button.dataset.week === "prev" ? -1 : 1); applyCalendarView(); }));
  document.querySelector("#calendar-team").addEventListener("change",event => { calendarTeam = event.target.value; applyCalendarView(); });
  document.querySelector("[data-new-operation]").addEventListener("click",operationForm);
  applyCalendarView();
}

function initFeatures() {
  document.head.insertAdjacentHTML("beforeend",featureStyles);
  ensureDrawer();
  const current = new URLSearchParams(location.search).get("screen") || "operations";
  if (current === "calendar") setupCalendar();
  if (current === "teams") setupPeople();
  document.addEventListener("click",event => {
    const button = event.target.closest(".page-head .button");
    if (!button || current !== "teams") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    employeeForm();
  },true);
}

if (typeof document !== "undefined") document.addEventListener("DOMContentLoaded",initFeatures);
if (typeof module !== "undefined") module.exports = {calendarPosition,escapeHtml,isDuplicateName,personMatches,validEmployee,validPhone,weekLabel};
