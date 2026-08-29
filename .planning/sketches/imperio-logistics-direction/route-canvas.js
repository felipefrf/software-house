const stages = [
  { id:"preparation", label:"Preparação", icon:"M4 7h16v12H4zM8 7V4h8v3", tasks:["Conferir pedido e separação","Confirmar equipe escalada","Vincular veículo e motorista","Registrar divergências da carga"], evidence:["Checklist por grupo","Foto da carga","Responsável e horário"] },
  { id:"departure", label:"Saída", icon:"M3 7h13v10H3zM16 10h3l2 3v4h-5z", tasks:["Confirmar motorista e veículo","Confirmar toda a equipe","Fotografar carga ao vivo","Registrar GPS e horário da saída"], evidence:["Foto obrigatória","GPS da base","Checklist assinado"] },
  { id:"travel", label:"Deslocamento", icon:"M4 12h16M15 7l5 5-5 5", tasks:["Iniciar acompanhamento da rota","Revisar ETA estimado","Manter contato do local acessível","Registrar ocorrência ou avaria"], evidence:["Última posição","ETA demonstrativo","Histórico de contato"] },
  { id:"arrival", label:"Chegada", icon:"M12 21s6-5 6-11a6 6 0 1 0-12 0c0 6 6 11 6 11z", tasks:["Registrar chegada por GPS","Confirmar se o local está liberado","Informar motivo se estiver bloqueado","Iniciar cronômetro de espera"], evidence:["GPS do local","Horário de chegada","Foto do acesso"] },
  { id:"assembly", label:"Montagem", icon:"m5 19 6-6M13 11l6-6M15 5h4v4", tasks:["Iniciar cronômetro de montagem","Conferir itens por grupo","Fotografar montagem finalizada","Registrar falta, troca ou avaria"], evidence:["Checklist de montagem","Fotos por ambiente","Responsável técnico"] },
  { id:"event", label:"Entrega", icon:"M5 4h14v16H5zM8 9h8M8 13h5", tasks:["Conferir entrega com o cliente","Coletar aceite ou assinatura","Anexar termo de entrega","Registrar observações do evento"], evidence:["Aceite do cliente","Termo assinado","Fotos da entrega"] },
  { id:"disassembly", label:"Desmontagem", icon:"M4 7h16M7 4v6M17 4v6M6 11h12v9H6z", tasks:["Iniciar cronômetro de desmontagem","Conferir volumes retirados","Fotografar local liberado","Registrar avarias ou itens ausentes"], evidence:["Checklist de retirada","Fotos do local","Divergências"] },
  { id:"return", label:"Retorno", icon:"M20 11a8 8 0 1 0-2 6M20 4v7h-7", tasks:["Confirmar saída do evento","Acompanhar retorno à base","Registrar chegada do veículo","Encaminhar itens com avaria"], evidence:["GPS de retorno","Horários do trajeto","Ocorrências abertas"] },
  { id:"inspection", label:"Conclusão", icon:"m6 12 4 4 8-9M4 3h16v18H4z", tasks:["Conferir devolução na base","Separar avarias para revisão","Confirmar disponibilidade dos itens","Encerrar a operação"], evidence:["Termo de devolução","Fotos de avarias","Conclusão registrada"] },
];

const routeStates = {
  festival: { stage:1, times:["08:00","08:30","09:00","09:30","10:00","15:30","18:00","18:30","19:15"], blocker:"LOCAL NÃO LIBERADO · 00:18:42", detail:"Aguardando liberação do portão de carga pelo responsável local.", pending:["Confirmar equipe completa","Registrar checklist de saída"], counts:["4 confirmadas","VUC 03","3 de 4"], action:"REVISAR SAÍDA" },
  praia: { stage:0, times:["10:45","11:30","12:00","12:30","13:00","18:30","20:30","21:00","21:45"], blocker:"PREPARAÇÃO EM ANDAMENTO", detail:"Operação dentro da janela demonstrativa de saída.", pending:["Confirmar motorista","Registrar foto do carregamento"], counts:["6 confirmadas","VAN 02","1 de 3"], action:"REVISAR PREPARAÇÃO" },
  arena: { stage:0, times:["14:00","15:00","15:40","16:10","16:30","21:30","22:30","23:00","23:50"], blocker:"EQUIPE INCOMPLETA", detail:"Falta uma confirmação para liberar a preparação.", pending:["Confirmar técnico de luz","Revisar escala da equipe"], counts:["4 de 5","VUC 01","0 de 3"], action:"REVISAR EQUIPE" },
  sunset: { stage:0, times:["17:30","18:30","19:00","19:30","20:00","00:30","01:30","02:00","02:40"], blocker:"OPERAÇÃO PROGRAMADA", detail:"Nenhum bloqueio demonstrativo registrado.", pending:["Abrir checklist no horário","Confirmar contato local"], counts:["5 previstas","VAN 04","0 de 4"], action:"VER PREPARAÇÃO" },
  vip: { stage:0, times:["20:30","21:30","22:00","22:20","22:40","01:30","03:00","03:30","04:10"], blocker:"OPERAÇÃO PROGRAMADA", detail:"Nenhum bloqueio demonstrativo registrado.", pending:["Confirmar motorista","Validar janela de acesso"], counts:["3 previstas","VUC 05","0 de 3"], action:"VER PREPARAÇÃO" },
};

const stageMarkup = stage => `<button class="stage" type="button" data-stage="${stage.id}" aria-label="Abrir requisitos de ${stage.label}"><i class="stage-index"><svg viewBox="0 0 24 24"><path d="${stage.icon}"/></svg></i><h3>${stage.label}</h3><time></time><small></small></button>`;

document.addEventListener("DOMContentLoaded", () => {
  document.head.insertAdjacentHTML("beforeend", "<style>.signal span,.people-strip small,.evidence-thumbs strong,.evidence-thumbs small,.evidence-visual figcaption,.resource-photo figcaption{font-size:12px}.route:before{background:var(--line-strong);left:calc(5.55% + 24px);right:calc(5.55% + 24px)}.mobile-web-nav{display:none}@media(max-width:900px){.mobile-web-nav{background:var(--surface);border-bottom:1px solid var(--line);display:flex;gap:6px;overflow-x:auto;padding:9px 16px}.mobile-web-nav a{background:var(--sage);border-radius:8px;flex:0 0 auto;font-size:12px;font-weight:700;padding:9px 11px}}</style>");
  document.querySelector(".topbar").insertAdjacentHTML("afterend", `<nav class="mobile-web-nav" aria-label="Navegação do produto"><a href="a2-refined.html">Visão geral</a><a href="other-screens.html?screen=operations">Operações</a><a href="other-screens.html?screen=calendar">Agenda</a><a href="other-screens.html?screen=teams">Pessoas</a><a href="other-screens.html?screen=fleet">Veículos</a><a href="other-screens.html?screen=evidence">Evidências</a></nav>`);
  const route = document.querySelector(".route");
  route.innerHTML = stages.map(stageMarkup).join("");
  document.querySelector(".route-field").insertAdjacentHTML("afterend", `<section class="stage-focus" aria-live="polite"><header><div><span class="focus-step">Etapa selecionada</span><h2 id="focus-title"></h2></div><span class="focus-state"></span></header><div class="focus-grid"><div class="task-list"><h3>Para concluir esta etapa</h3><div id="focus-tasks"></div></div><div class="evidence-board"><h3>Evidências e registros</h3><div class="evidence-visual"><figure><img src="../../../site/public/imperio/hero-operation.png" alt="Imagem demonstrativa de operação e veículo"><figcaption>Foto da operação · exemplo</figcaption></figure><div class="signal"><svg viewBox="0 0 24 24"><path d="M12 21s6-5 6-11a6 6 0 1 0-12 0c0 6 6 11 6 11z"/><circle cx="12" cy="10" r="2"/></svg><strong>GPS da etapa</strong><span>Registro demonstrativo</span></div></div><ul id="focus-evidence"></ul><a class="focus-action" id="focus-action" href="mobile-app.html?screen=stage&stage=departure">Abrir execução no celular →</a></div></div></section>`);

  const resources = document.querySelectorAll(".resource");
  resources[0].querySelector(".resource-head").insertAdjacentHTML("afterend", `<div class="people-strip" aria-label="Equipe demonstrativa"><span class="portrait p1"></span><span class="portrait p2"></span><span class="portrait p3"></span><span class="portrait p4"></span><small>Imagens demonstrativas</small></div>`);
  resources[1].querySelector(".resource-head").insertAdjacentHTML("afterend", `<figure class="resource-photo"><img src="../../../site/public/imperio/hero-operation.png" alt="Imagem demonstrativa do veículo e área de carga"><figcaption>VUC 03 · imagem de referência</figcaption></figure>`);
  resources[2].querySelector(".resource-head").insertAdjacentHTML("afterend", `<div class="evidence-thumbs"><figure><img src="../../../site/public/imperio/real-corporativo.jpeg" alt="Foto demonstrativa do carregamento"></figure><figure><img src="../../../site/public/imperio/event-white.jpg" alt="Foto demonstrativa da entrega"></figure><span><strong>GPS</strong><small>Base registrada</small></span></div>`);

  let currentEvent = "festival";
  const renderStage = selectedIndex => {
    const state = routeStates[currentEvent];
    document.querySelectorAll(".stage").forEach((button, index) => {
      button.classList.toggle("done", index < state.stage);
      button.classList.toggle("active", index === state.stage);
      button.classList.toggle("selected", index === selectedIndex);
      button.querySelector("time").textContent = state.times[index];
      button.querySelector("small").textContent = index < state.stage ? "Concluída" : index === state.stage ? "Em andamento" : "Aguardando";
      const status = index < state.stage ? "concluída" : index === state.stage ? "etapa atual" : "planejada";
      button.setAttribute("aria-label", `${stages[index].label}, ${state.times[index]}, ${status}`);
      button.setAttribute("aria-pressed", String(index === selectedIndex));
      if (index === state.stage) button.setAttribute("aria-current", "step"); else button.removeAttribute("aria-current");
    });
    const selected = stages[selectedIndex];
    document.querySelector("#focus-title").textContent = selected.label;
    const focusState = document.querySelector(".focus-state");
    focusState.textContent = selectedIndex < state.stage ? "CONCLUÍDA" : selectedIndex === state.stage ? "EM ANDAMENTO" : "PLANEJADA";
    focusState.dataset.tone = selectedIndex < state.stage ? "done" : selectedIndex === state.stage ? "active" : "planned";
    document.querySelector("#focus-tasks").innerHTML = selected.tasks.map((task, index) => `<div class="focus-task ${selectedIndex < state.stage || index < 2 && selectedIndex === state.stage ? "done" : ""}"><i></i><span>${task}</span><small>${selectedIndex < state.stage || index < 2 && selectedIndex === state.stage ? "Registrado" : "Pendente"}</small></div>`).join("");
    document.querySelector("#focus-evidence").innerHTML = selected.evidence.map(item => `<li>${item}</li>`).join("");
    document.querySelector("#focus-action").href = `mobile-app.html?screen=stage&stage=${selected.id}&event=${currentEvent}`;
  };

  route.addEventListener("click", event => {
    const button = event.target.closest(".stage");
    if (button) renderStage(stages.findIndex(stage => stage.id === button.dataset.stage));
  });

  document.querySelectorAll(".event").forEach(button => button.addEventListener("click", () => {
    currentEvent = button.dataset.event;
    const state = routeStates[currentEvent];
    document.querySelector(".blocker strong").textContent = state.blocker;
    document.querySelector(".blocker p").textContent = state.detail;
    document.querySelectorAll(".pending-item").forEach((item, index) => item.textContent = state.pending[index]);
    document.querySelectorAll(".resource-head span").forEach((item, index) => item.textContent = state.counts[index]);
    document.querySelector("#review").textContent = state.action;
    history.replaceState(null, "", `?event=${currentEvent}`);
    renderStage(state.stage);
  }));

  document.querySelector("#review").addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const activeStage = stages[routeStates[currentEvent].stage].id;
    location.href = `mobile-app.html?screen=stage&stage=${activeStage}&event=${currentEvent}`;
  }, true);

  const requestedEvent = new URLSearchParams(location.search).get("event");
  if (routeStates[requestedEvent]) document.querySelector(`[data-event="${requestedEvent}"]`).click();
  else renderStage(routeStates[currentEvent].stage);
});
