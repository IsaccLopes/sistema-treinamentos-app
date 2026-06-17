const SUPABASE_URL = "https://xcmcsohnzssgvlcbbnni.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QRptxF1hG1gzURYySqAZPw_-31W4Bjc";
const STATUS_LABEL = {
  em_dia: "Em dia",
  vencendo: "Vencendo",
  vencido: "Vencido",
  devendo: "Devendo",
  solicitado: "Solicitado",
  afastado: "Afastado",
  pendente: "Pendente",
  nao_aplica: "Não se aplica"
};

let supabaseClient;
let session = null;
let perfil = null;
let db = { colaboradores: [], treinamentos: [], matriz: [], agenda: [], usuarios: [], auditoria: [], historico: [] };
let statusAtivo = "vencido";
let selecionadosAtualizacao = new Set();

const $ = (id) => document.getElementById(id);
const norm = (v) => String(v || "").trim().toLowerCase();
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const isoDate = (d) => d ? new Date(d).toISOString().slice(0,10) : "";
const brDate = (d) => d ? new Date(`${String(d).slice(0,10)}T00:00:00`).toLocaleDateString("pt-BR") : "-";
const addDays = (date, days) => { const d = new Date(`${date}T00:00:00`); d.setDate(d.getDate() + Number(days || 0)); return isoDate(d); };
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const escapeHtml = (v) => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

window.addEventListener("DOMContentLoaded", init);

async function init(){
  try{
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    bindEvents();
    const params = new URLSearchParams(location.search);
    if(params.has("qr")){
      await showPublicQr(params.get("qr"));
      return;
    }
    const { data } = await supabaseClient.auth.getSession();
    session = data.session;
    if(session){
      const ok = await loadPerfil();
      if(ok) await showApp(); else await logout("Seu usuário existe no Auth, mas não está autorizado na tabela usuarios_app.");
    }else{
      showLogin();
    }
  }catch(err){
    console.error(err);
    showLogin();
    toast("Erro ao iniciar. Verifique se rodou o SQL LGPD no Supabase.");
  }finally{
    $("loading").classList.add("hidden");
  }
}

function bindEvents(){
  $("loginForm").addEventListener("submit", login);
  $("btnSair").addEventListener("click", () => logout());
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => abrirPainel(btn.dataset.view)));
  document.querySelectorAll("[data-status]").forEach(btn => btn.addEventListener("click", () => {
    statusAtivo = btn.dataset.status;
    renderDashboard();
  }));
  ["dashFiltroTexto","dashFiltroSetor","dashFiltroTreinamento"].forEach(id => $(id).addEventListener("input", renderDashboard));
  $("btnLimparFiltros").addEventListener("click", () => { $("dashFiltroTexto").value=""; $("dashFiltroSetor").value=""; $("dashFiltroTreinamento").value=""; renderDashboard(); });
  $("btnReload").addEventListener("click", async () => { await loadAll(); renderAll(); toast("Dados atualizados."); });
  $("btnConsultaBuscar").addEventListener("click", consultaInterna);
  $("consultaBusca").addEventListener("keydown", e => { if(e.key === "Enter") consultaInterna(); });
  $("qrBusca").addEventListener("input", renderQrSelect);
  $("btnGerarQr").addEventListener("click", gerarQr);
  $("btnCopiarQr").addEventListener("click", copiarQr);
  $("updBusca").addEventListener("input", renderUpdatePeople);
  $("btnSelecionarTodosVisiveis").addEventListener("click", selecionarVisiveis);
  $("btnLimparSelecao").addEventListener("click", () => { selecionadosAtualizacao.clear(); renderUpdatePeople(); });
  $("updTreinamento").addEventListener("change", calcularValidadeUpdate);
  $("updData").addEventListener("change", calcularValidadeUpdate);
  $("btnSalvarAtualizacao").addEventListener("click", salvarAtualizacao);
  $("btnMarcarObrigatorio").addEventListener("click", marcarObrigatorio);
  $("btnNovoColab").addEventListener("click", limparFormColab);
  $("btnSalvarColab").addEventListener("click", salvarColaborador);
  $("btnExcluirColab").addEventListener("click", excluirColaborador);
  $("baseBusca").addEventListener("input", renderBaseColabs);
  $("btnSalvarTreinamento").addEventListener("click", salvarTreinamento);
  $("btnSalvarAgenda").addEventListener("click", salvarAgenda);
  $("btnSalvarAcesso").addEventListener("click", salvarAcesso);
  if($("btnFecharModalVinculo")) $("btnFecharModalVinculo").addEventListener("click", fecharModalVinculo);
  if($("btnSalvarModalVinculo")) $("btnSalvarModalVinculo").addEventListener("click", salvarModalVinculo);
  if($("modalData")) $("modalData").addEventListener("change", calcularValidadeModal);
  if($("modalTreId")) $("modalTreId").addEventListener("change", calcularValidadeModal);
}

async function login(ev){
  ev.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginSenha").value;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){ toast("Login não autorizado. Verifique e-mail/senha."); return; }
  session = data.session;
  const ok = await loadPerfil();
  if(!ok){ await logout("Este e-mail não está liberado na tabela usuarios_app."); return; }
  await showApp();
}

async function logout(msg){
  await supabaseClient.auth.signOut();
  session = null; perfil = null;
  showLogin();
  if(msg) toast(msg);
}

async function loadPerfil(){
  const { data, error } = await supabaseClient
    .from("usuarios_app")
    .select("id,auth_user_id,usuario,nome,perfil,ativo")
    .eq("auth_user_id", session.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if(error){ console.error(error); return false; }
  perfil = data;
  return !!perfil;
}

function showLogin(){
  $("appView").classList.add("hidden");
  $("publicView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
}

async function showApp(){
  $("loginView").classList.add("hidden");
  $("publicView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("userName").textContent = perfil.nome || perfil.usuario;
  $("userRole").textContent = perfil.perfil === "gerencia" ? "Gerência" : "Técnico";
  document.querySelectorAll(".manager-only").forEach(el => el.classList.toggle("hidden", perfil.perfil !== "gerencia"));
  await loadAll();
  hydrateSelects();
  renderAll();
}

function abrirPainel(view){
  if(view === "acessosPanel" && perfil?.perfil !== "gerencia"){ toast("Apenas Gerência acessa essa tela."); return; }
  document.querySelectorAll(".panel-view").forEach(v => v.classList.add("hidden"));
  $(view).classList.remove("hidden");
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
  if(view === "basePanel") renderBaseColabs();
  if(view === "auditoriaPanel") renderAuditoria();
  if(view === "acessosPanel") renderAcessos();
}

async function loadAll(){
  const [colabs, treinamentos, matriz, agenda, usuarios, auditoria, historico] = await Promise.all([
    selectAll("colaboradores", "*") ,
    selectAll("treinamentos", "*"),
    selectAll("matriz_treinamentos", "*"),
    selectAll("agenda_treinamentos", "*"),
    perfil?.perfil === "gerencia" ? selectAll("usuarios_app", "*") : Promise.resolve([]),
    selectAll("auditoria_treinamentos", "*"),
    selectAll("historico_treinamentos", "*").catch(() => [])
  ]);
  db = { colaboradores: colabs || [], treinamentos: treinamentos || [], matriz: matriz || [], agenda: agenda || [], usuarios: usuarios || [], auditoria: auditoria || [], historico: historico || [] };
}

async function selectAll(table, columns="*"){
  const all = []; let from = 0; const step = 1000;
  while(true){
    const { data, error } = await supabaseClient.from(table).select(columns).range(from, from + step - 1);
    if(error) throw error;
    all.push(...(data || []));
    if(!data || data.length < step) break;
    from += step;
  }
  return all;
}

function hydrateSelects(){
  const setores = [...new Set(db.colaboradores.map(c => c.setor).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  $("dashFiltroSetor").innerHTML = `<option value="">Todos</option>` + setores.map(s => `<option>${escapeHtml(s)}</option>`).join("");
  const optsTre = `<option value="">Todos</option>` + db.treinamentos.filter(t => t.ativo !== false).sort((a,b)=>a.nome.localeCompare(b.nome)).map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nome)}</option>`).join("");
  $("dashFiltroTreinamento").innerHTML = optsTre;
  $("updTreinamento").innerHTML = optsTre;
  $("agendaTreinamento").innerHTML = optsTre;
  renderQrSelect(); renderUpdatePeople();
}

function renderAll(){ renderDashboard(); renderQrSelect(); renderUpdatePeople(); renderBaseColabs(); renderAgenda(); renderAuditoria(); renderAcessos(); }

function treinamentoById(id){ return db.treinamentos.find(t => t.id === id) || {}; }
function colaboradorById(id){ return db.colaboradores.find(c => c.id === id) || {}; }
function matrizDoColaborador(id){ return db.matriz.filter(m => m.colaborador_id === id); }

function calcStatus(row){
  const t = treinamentoById(row.treinamento_id);
  const tipo = norm(row.tipo);
  if(["nao_aplica","não aplica","nao se aplica"].includes(tipo)) return {status:"nao_aplica", label:"Não se aplica"};
  if(tipo.includes("afast")) return {status:"afastado", label:"Afastado"};
  if(tipo.includes("solicit")) return {status:"solicitado", label:"Solicitado"};
  if(tipo.includes("pendent")) return {status:"pendente", label:"Pendente"};
  const base = row.data_validade || (row.data_realizacao && t.periodicidade_dias ? addDays(row.data_realizacao, t.periodicidade_dias) : "");
  if(!base) return {status:"devendo", label:"Devendo", detalhe:"Sem data registrada"};
  const venc = new Date(`${base}T00:00:00`);
  const agora = today();
  const dias = Math.ceil((venc - agora) / 86400000);
  if(dias < 0) return {status:"vencido", label:"Vencido", dias, faixa:"vencido", detalhe:`Venceu há ${Math.abs(dias)} dia(s)`};
  if(dias <= 30) return {status:"vencendo", label:"Vencendo", dias, faixa:"30", detalhe: dias === 0 ? "Vence hoje" : `Faltam ${dias} dia(s)`};
  if(dias <= 60) return {status:"em_dia", label:"Em dia", dias, faixa:"60", detalhe:`Faltam ${dias} dia(s)`};
  if(dias <= 90) return {status:"em_dia", label:"Em dia", dias, faixa:"90", detalhe:`Faltam ${dias} dia(s)`};
  return {status:"em_dia", label:"Em dia", dias, faixa:"ok", detalhe:`Válido até ${brDate(base)}`};
}

function isAplicavel(l){ return !["nao_aplica","afastado","pendente","solicitado"].includes(l.status); }
function isValido(l){ return ["em_dia","vencendo"].includes(l.status); }
function pct(num, den){ return den ? `${Math.round((num/den)*100)}%` : "0%"; }
function tipoLancamentoLabel(v){ return ({integracao:"Integração", reciclagem:"Reciclagem", ajuste:"Ajuste", nao_aplica:"Não se aplica"}[v] || v || "-"); }

function linhasStatus(){
  return db.matriz.map(r => {
    const c = colaboradorById(r.colaborador_id);
    const t = treinamentoById(r.treinamento_id);
    const s = calcStatus(r);
    const validade = r.data_validade || (r.data_realizacao && t.periodicidade_dias ? addDays(r.data_realizacao, t.periodicidade_dias) : "");
    return { row:r, colaborador:c, treinamento:t, validade, ...s };
  }).filter(x => x.colaborador?.id && x.treinamento?.id && x.colaborador.ativo !== false && x.treinamento.ativo !== false);
}

function linhasFiltradas(){
  const texto = norm($("dashFiltroTexto")?.value);
  const setor = $("dashFiltroSetor")?.value || "";
  const treinamento = $("dashFiltroTreinamento")?.value || "";
  return linhasStatus().filter(l => {
    const hay = `${l.colaborador.matricula} ${l.colaborador.nome} ${l.colaborador.setor}`.toLowerCase();
    return (!texto || hay.includes(texto)) && (!setor || l.colaborador.setor === setor) && (!treinamento || l.treinamento.id === treinamento);
  });
}

function linhasPorFaixaPrazo(linhas, faixa){
  const base = linhas.filter(isAplicavel);
  if(faixa === "vencido") return base.filter(l => l.status === "vencido");
  if(faixa === "30") return base.filter(l => l.faixa === "30");
  if(faixa === "60") return base.filter(l => l.faixa === "60");
  if(faixa === "90") return base.filter(l => l.faixa === "90");
  return base;
}

function qtdPessoasUnicas(linhas){
  return new Set(linhas.map(l => l.colaborador.id)).size;
}

function renderBotaoTexto(id, valor){
  const el = $(id);
  if(el) el.textContent = valor;
}

function setStatusDashboard(status){
  statusAtivo = status;
  renderDashboard();
}
window.setStatusDashboard = setStatusDashboard;

function agruparPorColaborador(linhas, status){
  const map = new Map();
  linhas.forEach(l => {
    let entra = status === "todos" || l.status === status;
    if(status === "ok") return;
    if(!entra) return;
    if(!map.has(l.colaborador.id)) map.set(l.colaborador.id, {colaborador:l.colaborador, itens:[]});
    map.get(l.colaborador.id).itens.push(l);
  });
  return [...map.values()].sort((a,b) => b.itens.length - a.itens.length || a.colaborador.nome.localeCompare(b.colaborador.nome));
}

function pessoasSemPendencia(linhas){
  const ativos = db.colaboradores.filter(c => c.ativo !== false);
  return ativos.filter(c => {
    const ls = linhas.filter(l => l.colaborador.id === c.id);
    return ls.length && !ls.some(l => ["vencido","vencendo","devendo"].includes(l.status));
  });
}

function renderDashboard(){
  const linhas = linhasFiltradas();
  const todasLinhas = linhasStatus();
  const gVencido = agruparPorColaborador(linhas,"vencido");
  const gVencendo = agruparPorColaborador(linhas,"vencendo");
  const gDevendo = agruparPorColaborador(linhas,"devendo");
  const ok = pessoasSemPendencia(linhas);

  const aplGeral = todasLinhas.filter(isAplicavel);
  const valGeral = aplGeral.filter(isValido);
  const aplFiltro = linhas.filter(isAplicavel);
  const valFiltro = aplFiltro.filter(isValido);

  $("kpiVencidos").textContent = gVencido.length;
  $("kpiVencendo").textContent = gVencendo.length;
  $("kpiDevendo").textContent = gDevendo.length;
  $("kpiOk").textContent = ok.length;
  $("kpiColaboradores").textContent = db.colaboradores.filter(c => c.ativo !== false).length;
  if($("kpiAderenciaGeral")) $("kpiAderenciaGeral").textContent = pct(valGeral.length, aplGeral.length);
  if($("kpiAderenciaArea")) $("kpiAderenciaArea").textContent = pct(valFiltro.length, aplFiltro.length);

  const linhasVencidas = linhasPorFaixaPrazo(linhas, "vencido");
  const linhas30 = linhasPorFaixaPrazo(linhas, "30");
  const linhas60 = linhasPorFaixaPrazo(linhas, "60");
  const linhas90 = linhasPorFaixaPrazo(linhas, "90");

  renderBotaoTexto("qtdQuickVencidos", qtdPessoasUnicas(linhasVencidas));
  renderBotaoTexto("qtdQuick30", qtdPessoasUnicas(linhas30));
  renderBotaoTexto("qtdQuick60", qtdPessoasUnicas(linhas60));
  renderBotaoTexto("qtdQuick90", qtdPessoasUnicas(linhas90));
  renderBotaoTexto("qtdQuickDevendo", gDevendo.length);

  document.querySelectorAll("[data-status]").forEach(k => k.classList.toggle("active", k.dataset.status === statusAtivo));

  let grupos;
  if(statusAtivo === "vencido") grupos = agruparPorColaborador(linhasVencidas, "todos");
  else if(statusAtivo === "vencendo" || statusAtivo === "prazo30") grupos = agruparPorColaborador(linhas30, "todos");
  else if(statusAtivo === "prazo60") grupos = agruparPorColaborador(linhas60, "todos");
  else if(statusAtivo === "prazo90") grupos = agruparPorColaborador(linhas90, "todos");
  else if(statusAtivo === "devendo") grupos = gDevendo;
  else if(statusAtivo === "ok") grupos = ok.map(c => ({colaborador:c, itens:linhas.filter(l=>l.colaborador.id===c.id && isValido(l))}));
  else grupos = agruparPorColaborador(linhas,"todos");

  const titulos = {
    vencido:"Colaboradores com treinamentos vencidos",
    vencendo:"Colaboradores com treinamentos vencendo em até 30 dias",
    prazo30:"Colaboradores com treinamentos vencendo em até 30 dias",
    prazo60:"Colaboradores com treinamentos vencendo de 31 a 60 dias",
    prazo90:"Colaboradores com treinamentos vencendo de 61 a 90 dias",
    devendo:"Colaboradores devendo treinamentos",
    ok:"Colaboradores sem pendência crítica",
    todos:"Todos os colaboradores"
  };
  $("listaTitulo").textContent = titulos[statusAtivo] || titulos.vencido;
  $("listaResumo").textContent = `${grupos.length} pessoa(s)`;
  $("listaAgrupada").innerHTML = grupos.map(renderGrupo).join("") || `<div class="empty">Nenhum colaborador encontrado para esse filtro.</div>`;

  renderDashboardVisual(linhas);
  renderVencendoDias(linhas);
  renderAderenciaTreinamento(linhas);
  renderAderenciaSetor(linhas);
}

function renderGrupo(g){
  const c = g.colaborador;
  const statusCount = g.itens.reduce((acc,i)=>{ acc[i.status]=(acc[i.status]||0)+1; return acc; },{});
  const resumo = Object.entries(statusCount).map(([s,q]) => `${q} ${STATUS_LABEL[s] || s}`).join(" • ");
  const detalhes = g.itens.sort((a,b)=>(a.dias??9999)-(b.dias??9999)).map(i => `
    <div class="detail-row">
      <span><strong>${escapeHtml(i.treinamento.nome)}</strong><br><small>${i.detalhe || ""} • validade: ${brDate(i.validade)} • ${tipoLancamentoLabel(i.row.tipo_lancamento)}</small></span>
      <span class="detail-actions"><span class="status ${i.status}">${STATUS_LABEL[i.status] || i.status}</span><button class="btn secondary mini" onclick="abrirEditarVinculo('${escapeHtml(i.colaborador.id)}','${escapeHtml(i.treinamento.id)}')">Editar</button></span>
    </div>`).join("");
  const id = `det-${escapeHtml(c.id).replace(/[^a-zA-Z0-9]/g,"")}`;
  return `<div class="group-item">
    <div class="group-top">
      <div><strong>${escapeHtml(c.nome)}</strong><small>${escapeHtml(c.matricula || "sem matrícula")} • ${escapeHtml(c.setor || "sem setor")}</small></div>
      <span class="chip">${escapeHtml(resumo || `${g.itens.length} treinamento(s)`)}</span>
      <button class="btn secondary" onclick="toggleDetalhe('${id}')">Ver</button>
    </div>
    <div id="${id}" class="details">${detalhes}</div>
  </div>`;
}
window.toggleDetalhe = (id) => $(id)?.classList.toggle("open");

function renderDashboardVisual(linhas){
  const vencidos = linhasPorFaixaPrazo(linhas, "vencido");
  const dias30 = linhasPorFaixaPrazo(linhas, "30");
  const dias60 = linhasPorFaixaPrazo(linhas, "60");
  const dias90 = linhasPorFaixaPrazo(linhas, "90");

  const dados = [
    { label:"Vencidos", status:"vencido", qtd:qtdPessoasUnicas(vencidos), classe:"danger" },
    { label:"Até 30 dias", status:"prazo30", qtd:qtdPessoasUnicas(dias30), classe:"warn" },
    { label:"31 a 60 dias", status:"prazo60", qtd:qtdPessoasUnicas(dias60), classe:"blue" },
    { label:"61 a 90 dias", status:"prazo90", qtd:qtdPessoasUnicas(dias90), classe:"green" }
  ];

  const maior = Math.max(...dados.map(d => d.qtd), 1);
  const dash = $("dashboardVisual");
  if(dash){
    dash.innerHTML = dados.map(d => `
      <button class="dash-bar ${d.classe}" onclick="setStatusDashboard('${d.status}')">
        <div class="dash-bar-top">
          <strong>${d.label}</strong>
          <span>${d.qtd} pessoa(s)</span>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(5, Math.round((d.qtd / maior) * 100))}%"></div></div>
      </button>
    `).join("");
  }

  const setor = $("dashFiltroSetor")?.value || "todas as áreas";
  const treinamento = $("dashFiltroTreinamento")?.selectedOptions?.[0]?.textContent || "todos os treinamentos";
  const box = $("dashboardCobranca");
  if(box){
    box.innerHTML = `
      <div class="charge-line danger"><strong>${qtdPessoasUnicas(vencidos)}</strong><span>pessoa(s) com treinamento vencido</span></div>
      <div class="charge-line warn"><strong>${qtdPessoasUnicas(dias30)}</strong><span>pessoa(s) vencendo em até 30 dias</span></div>
      <div class="charge-line blue"><strong>${qtdPessoasUnicas(dias60)}</strong><span>pessoa(s) vencendo de 31 a 60 dias</span></div>
      <div class="charge-line green"><strong>${qtdPessoasUnicas(dias90)}</strong><span>pessoa(s) vencendo de 61 a 90 dias</span></div>
      <p class="charge-note">Filtro atual: <b>${escapeHtml(setor)}</b> • <b>${escapeHtml(treinamento)}</b></p>
    `;
  }
}

function renderVencendoDias(linhas){
  const v = linhas
    .filter(l => isAplicavel(l) && typeof l.dias === "number" && l.dias >= 0 && l.dias <= 90)
    .sort((a,b)=>a.dias-b.dias || a.colaborador.nome.localeCompare(b.colaborador.nome));

  const faixas = [
    {label:"Até 30 dias", cls:"vencendo", itens:v.filter(l=>l.dias<=30)},
    {label:"31 a 60 dias", cls:"solicitado", itens:v.filter(l=>l.dias>30 && l.dias<=60)},
    {label:"61 a 90 dias", cls:"ok", itens:v.filter(l=>l.dias>60 && l.dias<=90)}
  ];

  $("listaVencendoDias").innerHTML = faixas.map(f => `
    <div class="faixa-vencimento">
      <div class="card-head compact"><h4>${f.label}</h4><span class="chip">${f.itens.length}</span></div>
      ${f.itens.slice(0,30).map(l => `<div class="alert-item compact-alert">
        <span class="status ${f.cls}">${l.dias === 0 ? "vence hoje" : `faltam ${l.dias} dias`}</span>
        <strong>${escapeHtml(l.colaborador.nome)}</strong>
        <small>${escapeHtml(l.treinamento.nome)} • ${escapeHtml(l.colaborador.setor || "")} • validade ${brDate(l.validade)}</small>
      </div>`).join("") || `<div class="empty small-empty">Nenhum item nessa faixa.</div>`}
    </div>`).join("");
}

function renderAderenciaTreinamento(linhas){
  if(!$("aderenciaTreinamento")) return;
  const map = new Map();
  linhas.filter(isAplicavel).forEach(l => {
    const id = l.treinamento.id;
    if(!map.has(id)) map.set(id, { nome:l.treinamento.nome, total:0, validos:0, vencidos:0, devendo:0 });
    const item = map.get(id);
    item.total++;
    if(isValido(l)) item.validos++;
    if(l.status === "vencido") item.vencidos++;
    if(l.status === "devendo") item.devendo++;
  });
  const arr = [...map.values()].sort((a,b)=>(a.validos/a.total)-(b.validos/b.total) || b.total-a.total).slice(0,40);
  $("aderenciaTreinamento").innerHTML = arr.map(x => `<div class="adherence-row">
    <div><strong>${escapeHtml(x.nome)}</strong><small>${x.validos}/${x.total} em dia • ${x.vencidos} vencido(s) • ${x.devendo} devendo</small></div>
    <span class="chip">${pct(x.validos,x.total)}</span>
  </div>`).join("") || `<div class="empty">Sem dados para o filtro.</div>`;
}

function renderAderenciaSetor(linhas){
  if(!$("aderenciaSetor")) return;
  const map = new Map();
  linhas.filter(isAplicavel).forEach(l => {
    const id = l.colaborador.setor || "Sem setor";
    if(!map.has(id)) map.set(id, { nome:id, total:0, validos:0, vencidos:0, devendo:0 });
    const item = map.get(id);
    item.total++;
    if(isValido(l)) item.validos++;
    if(l.status === "vencido") item.vencidos++;
    if(l.status === "devendo") item.devendo++;
  });
  const arr = [...map.values()].sort((a,b)=>(a.validos/a.total)-(b.validos/b.total) || a.nome.localeCompare(b.nome));
  $("aderenciaSetor").innerHTML = arr.map(x => `<div class="adherence-row">
    <div><strong>${escapeHtml(x.nome)}</strong><small>${x.validos}/${x.total} em dia • ${x.vencidos} vencido(s) • ${x.devendo} devendo</small></div>
    <span class="chip">${pct(x.validos,x.total)}</span>
  </div>`).join("") || `<div class="empty">Sem dados para o filtro.</div>`;
}

function consultaInterna(){
  const q = norm($("consultaBusca").value);
  if(!q){ toast("Digite nome ou matrícula."); return; }
  const c = db.colaboradores.find(c => norm(c.matricula) === q || norm(c.nome).includes(q));
  if(!c){ $("consultaResultado").innerHTML = `<div class="empty">Colaborador não encontrado.</div>`; return; }
  renderFicha(c, $("consultaResultado"));
}

function renderFicha(c, target){
  const linhas = linhasStatus().filter(l => l.colaborador.id === c.id).sort((a,b)=>a.status.localeCompare(b.status));
  target.innerHTML = `<div class="profile-head"><h3>${escapeHtml(c.nome)}</h3><p>${escapeHtml(c.matricula || "sem matrícula")} • ${escapeHtml(c.setor || "sem setor")} • ${escapeHtml(c.funcao || "")}</p></div>
    <div class="alert-list">${linhas.map(l => `<div class="alert-item"><span class="status ${l.status}">${STATUS_LABEL[l.status] || l.status}</span><strong>${escapeHtml(l.treinamento.nome)}</strong><small>${l.detalhe || ""} • realizado: ${brDate(l.row.data_realizacao)} • validade: ${brDate(l.validade)} • ${tipoLancamentoLabel(l.row.tipo_lancamento)}</small><div class="row-mini"><button class="btn secondary mini" onclick="abrirEditarVinculo('${escapeHtml(l.colaborador.id)}','${escapeHtml(l.treinamento.id)}')">Editar vínculo</button></div></div>`).join("") || `<div class="empty">Sem treinamentos vinculados.</div>`}</div>`;
}

function renderQrSelect(){
  const q = norm($("qrBusca")?.value);
  if(!$("qrColaborador")) return;
  const opts = db.colaboradores.filter(c => c.ativo !== false).filter(c => !q || `${c.nome} ${c.matricula} ${c.setor}`.toLowerCase().includes(q)).sort((a,b)=>a.nome.localeCompare(b.nome)).slice(0,250);
  $("qrColaborador").innerHTML = opts.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.matricula || "s/m")} - ${escapeHtml(c.nome)} | ${escapeHtml(c.setor || "")}</option>`).join("");
}

function gerarQr(){
  const id = $("qrColaborador").value;
  const c = colaboradorById(id);
  if(!c.id){ toast("Selecione um colaborador."); return; }
  if(!c.qr_token){ toast("Este colaborador ainda não tem token. Rode o SQL LGPD novamente."); return; }
  const url = `${location.origin}${location.pathname}?qr=${encodeURIComponent(c.qr_token)}`;
  $("qrNome").textContent = c.nome;
  $("qrMeta").textContent = `${c.matricula || "sem matrícula"} • ${c.setor || "sem setor"}`;
  $("qrLink").textContent = url;
  $("qrcode").innerHTML = "";
  if(window.QRCode) new QRCode($("qrcode"), { text:url, width:160, height:160, correctLevel:QRCode.CorrectLevel.M });
}

async function copiarQr(){
  const txt = $("qrLink").textContent.trim();
  if(!txt) return;
  await navigator.clipboard.writeText(txt);
  toast("Link copiado.");
}

async function showPublicQr(token){
  $("loginView").classList.add("hidden"); $("appView").classList.add("hidden"); $("publicView").classList.remove("hidden");
  const { data, error } = await supabaseClient.rpc("consultar_treinamentos_qr", { p_token: token });
  if(error){ console.error(error); $("publicContent").innerHTML = `<div class="empty">QR inválido ou acesso bloqueado.</div>`; return; }
  const payload = Array.isArray(data) ? data[0] : data;
  if(!payload || !payload.colaborador){ $("publicContent").innerHTML = `<div class="empty">QR não encontrado.</div>`; return; }
  const c = payload.colaborador;
  $("publicTitle").textContent = c.nome;
  $("publicSubtitle").textContent = `${c.matricula || "sem matrícula"} • ${c.setor || "sem setor"}`;
  const linhas = (payload.treinamentos || []).map(x => {
    const fakeT = {id:x.treinamento_id, nome:x.treinamento_nome, periodicidade_dias:x.periodicidade_dias};
    const fakeR = {treinamento_id:x.treinamento_id, tipo:x.tipo, data_realizacao:x.data_realizacao, data_validade:x.data_validade};
    const old = db; db = {colaboradores:[c], treinamentos:[fakeT], matriz:[fakeR], agenda:[], usuarios:[], auditoria:[], historico:[]};
    const s = calcStatus(fakeR); db = old;
    const validade = x.data_validade || (x.data_realizacao && x.periodicidade_dias ? addDays(x.data_realizacao, x.periodicidade_dias) : "");
    return {...x, ...s, validade};
  }).filter(l => ["em_dia","vencendo","vencido","devendo"].includes(l.status));

  const atrasados = linhas.filter(l => ["vencido","devendo"].includes(l.status)).sort((a,b)=>(a.dias??9999)-(b.dias??9999));
  const validos = linhas.filter(l => ["em_dia","vencendo"].includes(l.status)).sort((a,b)=>a.treinamento_nome.localeCompare(b.treinamento_nome));

  const renderPublicLine = (l) => {
    const ruim = ["vencido","devendo"].includes(l.status);
    const detalhe = l.status === "devendo" ? "Sem registro de realização/validade." : `${l.detalhe || ""} • validade: ${brDate(l.validade)}`;
    return `<div class="alert-item public-training-card ${ruim ? "vencido" : "em_dia"}">
      <span class="status ${ruim ? "vencido" : "em_dia"}">${ruim ? "Atrasado" : "Em dia"}</span>
      <strong>${escapeHtml(l.treinamento_nome)}</strong>
      <small>${escapeHtml(detalhe)}</small>
    </div>`;
  };

  $("publicContent").innerHTML = `
    <div class="qr-summary">
      <div><span>Em dia</span><strong>${validos.length}</strong></div>
      <div class="danger"><span>Atrasados</span><strong>${atrasados.length}</strong></div>
      <div><span>Total</span><strong>${linhas.length}</strong></div>
    </div>
    ${atrasados.length ? `<div class="qr-section-title danger">Treinamentos atrasados</div><div class="alert-list public-list">${atrasados.map(renderPublicLine).join("")}</div>` : `<div class="qr-ok-banner">Nenhum treinamento atrasado encontrado.</div>`}
    ${validos.length ? `<div class="qr-section-title">Treinamentos em dia</div><div class="alert-list public-list">${validos.map(renderPublicLine).join("")}</div>` : ""}
  `;
}

function renderUpdatePeople(){
  if(!$("updListaPessoas")) return;
  const q = norm($("updBusca").value);
  const people = db.colaboradores.filter(c => c.ativo !== false).filter(c => !q || `${c.nome} ${c.matricula} ${c.setor}`.toLowerCase().includes(q)).sort((a,b)=>a.nome.localeCompare(b.nome)).slice(0,300);
  $("updListaPessoas").innerHTML = people.map(c => `<label class="check-person"><input type="checkbox" value="${escapeHtml(c.id)}" ${selecionadosAtualizacao.has(c.id)?"checked":""} onchange="togglePessoaUpdate(this)"><span><strong>${escapeHtml(c.nome)}</strong><small>${escapeHtml(c.matricula || "s/m")} • ${escapeHtml(c.setor || "")}</small></span></label>`).join("");
  $("updQtdSelecionados").textContent = selecionadosAtualizacao.size;
}
window.togglePessoaUpdate = (el) => { el.checked ? selecionadosAtualizacao.add(el.value) : selecionadosAtualizacao.delete(el.value); $("updQtdSelecionados").textContent = selecionadosAtualizacao.size; };
function selecionarVisiveis(){ document.querySelectorAll("#updListaPessoas input[type=checkbox]").forEach(i => selecionadosAtualizacao.add(i.value)); renderUpdatePeople(); }
function calcularValidadeUpdate(){
  const tre = treinamentoById($("updTreinamento").value); const data = $("updData").value;
  if(data && tre?.periodicidade_dias && !tre.validade_direta) $("updValidade").value = addDays(data, tre.periodicidade_dias);
}

async function salvarAtualizacao(){
  const ids = [...selecionadosAtualizacao]; const treinamentoId = $("updTreinamento").value; const data = $("updData").value; let validade = $("updValidade").value; const obs = $("updObs").value.trim(); const origem = $("updOrigem")?.value || "reciclagem";
  if(!ids.length || !treinamentoId || !data){ toast("Selecione pessoas, treinamento e data realizada."); return; }
  const tre = treinamentoById(treinamentoId); if(!validade && tre.periodicidade_dias && !tre.validade_direta) validade = addDays(data, tre.periodicidade_dias);
  let anexo = { path:null, name:null };
  const file = $("updAnexo")?.files?.[0];
  if(file) anexo = await uploadAnexo(file, `reciclagens/${treinamentoId}`);

  const rows = ids.map(id => ({ colaborador_id:id, treinamento_id:treinamentoId, tipo:"data", tipo_lancamento:origem, data_realizacao:data, data_validade:validade || null, observacao:obs, anexo_url:anexo.path, anexo_nome:anexo.name, atualizado_por:perfil.usuario }));
  await gravarHistoricoAntes(ids, treinamentoId, origem, rows[0], "lancar_treinamento");
  const { error } = await supabaseClient.from("matriz_treinamentos").upsert(rows, { onConflict:"colaborador_id,treinamento_id" });
  if(error){ console.error(error); toast("Erro ao salvar atualização. Rode o SQL 05 se ainda não rodou."); return; }
  await auditar(origem === "integracao" ? "integracao" : "reciclagem", { treinamentoId, qtd:ids.length, data, validade, anexo:anexo.name });
  if($("updAnexo")) $("updAnexo").value = "";
  await loadAll(); renderAll(); toast("Treinamento atualizado com sucesso.");
}

async function marcarObrigatorio(){
  const ids = [...selecionadosAtualizacao]; const treinamentoId = $("updTreinamento").value;
  if(!ids.length || !treinamentoId){ toast("Selecione pessoas e treinamento."); return; }
  const rows = ids.map(id => ({ colaborador_id:id, treinamento_id:treinamentoId, tipo:"em_branco", observacao:"Aplicado como obrigatório", atualizado_por:perfil.usuario }));
  const { error } = await supabaseClient.from("matriz_treinamentos").upsert(rows, { onConflict:"colaborador_id,treinamento_id" });
  if(error){ console.error(error); toast("Erro ao aplicar obrigatório."); return; }
  await auditar("aplicar_obrigatorio", { treinamentoId, qtd:ids.length });
  await loadAll(); renderAll(); toast("Treinamento aplicado como obrigatório.");
}

function limparFormColab(){ ["colabId","colabMatricula","colabNome","colabSetor","colabFuncao"].forEach(id => $(id).value=""); $("colabAtivo").checked=true; }
window.editarColab = (id) => { const c = colaboradorById(id); if(!c.id) return; $("colabId").value=c.id; $("colabMatricula").value=c.matricula||""; $("colabNome").value=c.nome||""; $("colabSetor").value=c.setor||""; $("colabFuncao").value=c.funcao||""; $("colabAtivo").checked=c.ativo!==false; window.scrollTo({top:0,behavior:"smooth"}); };

async function salvarColaborador(){
  const id = $("colabId").value || `mat-${($("colabMatricula").value || uid()).replace(/[^a-zA-Z0-9]/g,"")}`;
  const row = { id, matricula:$("colabMatricula").value.trim() || null, nome:$("colabNome").value.trim(), setor:$("colabSetor").value.trim(), funcao:$("colabFuncao").value.trim(), ativo:$("colabAtivo").checked };
  if(!row.nome){ toast("Informe o nome."); return; }
  const { error } = await supabaseClient.from("colaboradores").upsert(row);
  if(error){ console.error(error); toast("Erro ao salvar colaborador. Verifique matrícula duplicada."); return; }
  await auditar("salvar_colaborador", { id:row.id, matricula:row.matricula, nome:row.nome });
  await loadAll(); hydrateSelects(); renderAll(); limparFormColab(); toast("Colaborador salvo.");
}

async function excluirColaborador(){
  const id = $("colabId").value; if(!id){ toast("Selecione um colaborador para excluir."); return; }
  if(!confirm("Excluir definitivamente? Para desligamento, prefira desmarcar Ativo.")) return;
  const { error } = await supabaseClient.from("colaboradores").delete().eq("id", id);
  if(error){ console.error(error); toast("Erro ao excluir colaborador."); return; }
  await auditar("excluir_colaborador", { id }); await loadAll(); renderAll(); limparFormColab(); toast("Colaborador excluído.");
}

async function salvarTreinamento(){
  const nome = $("treNome").value.trim(); const dias = Number($("treDias").value || 0); const setores = $("treSetores").value.trim();
  if(!nome){ toast("Informe o nome do treinamento."); return; }
  let anexo = { path:null, name:null };
  const file = $("treAnexo")?.files?.[0];
  if(file) anexo = await uploadAnexo(file, `catalogo/${Date.now()}`);
  const row = { id:`tre-${Date.now()}`, nome, periodicidade:`${dias || 0} dias`, periodicidade_dias:dias || null, validade_direta:$("treValidadeDireta").checked, ativo:true, setores_aplicaveis:setores ? setores.split(",").map(s=>s.trim()).filter(Boolean) : [], anexo_url:anexo.path, anexo_nome:anexo.name };
  const { error } = await supabaseClient.from("treinamentos").insert(row);
  if(error){ console.error(error); toast("Erro ao cadastrar treinamento. Rode o SQL 05 antes."); return; }
  await auditar("cadastrar_treinamento", { nome, dias, setores, anexo:anexo.name });
  ["treNome","treDias","treSetores"].forEach(id => $(id).value=""); if($("treAnexo")) $("treAnexo").value="";
  await loadAll(); hydrateSelects(); renderAll(); toast("Treinamento cadastrado.");
}

function renderBaseColabs(){
  if(!$("tbodyColabs")) return;
  const q = norm($("baseBusca").value);
  const rows = db.colaboradores.filter(c => !q || `${c.matricula} ${c.nome} ${c.setor} ${c.funcao}`.toLowerCase().includes(q)).sort((a,b)=>a.nome.localeCompare(b.nome)).slice(0,500);
  $("tbodyColabs").innerHTML = rows.map(c => `<tr><td>${escapeHtml(c.matricula||"")}</td><td>${escapeHtml(c.nome)}</td><td>${escapeHtml(c.setor||"")}</td><td>${escapeHtml(c.funcao||"")}</td><td>${c.ativo!==false?"Ativo":"Inativo"}</td><td><button class="btn secondary" onclick="editarColab('${escapeHtml(c.id)}')">Editar</button></td></tr>`).join("");
}

async function uploadAnexo(file, pasta="anexos"){
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path = `${pasta}/${Date.now()}-${safeName}`;
  const { error } = await supabaseClient.storage.from("treinamentos-anexos").upload(path, file, { upsert:false });
  if(error){ console.error(error); toast("Não consegui enviar o anexo. Verifique o SQL 05 e as políticas do Storage."); throw error; }
  return { path, name:file.name };
}

async function gravarHistoricoAntes(colaboradorIds, treinamentoId, origem, novo, acao){
  const rows = colaboradorIds.map(cid => {
    const anterior = db.matriz.find(m => m.colaborador_id === cid && m.treinamento_id === treinamentoId) || null;
    return {
      colaborador_id: cid,
      treinamento_id: treinamentoId,
      acao,
      tipo_lancamento: origem,
      data_realizacao: novo.data_realizacao || null,
      data_validade: novo.data_validade || null,
      observacao: novo.observacao || null,
      anexo_url: novo.anexo_url || null,
      anexo_nome: novo.anexo_nome || null,
      anterior,
      novo,
      usuario: perfil?.usuario || session?.user?.email
    };
  });
  const { error } = await supabaseClient.from("historico_treinamentos").insert(rows);
  if(error) console.warn("Histórico não gravado:", error);
}

function historicoDoVinculo(colaboradorId, treinamentoId){
  return (db.historico || [])
    .filter(h => h.colaborador_id === colaboradorId && h.treinamento_id === treinamentoId)
    .sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}

window.abrirEditarVinculo = (colaboradorId, treinamentoId) => {
  const c = colaboradorById(colaboradorId); const t = treinamentoById(treinamentoId);
  const row = db.matriz.find(m => m.colaborador_id === colaboradorId && m.treinamento_id === treinamentoId) || { colaborador_id:colaboradorId, treinamento_id:treinamentoId, tipo:"em_branco" };
  $("modalColabId").value = colaboradorId;
  $("modalTreId").value = treinamentoId;
  $("modalTituloVinculo").textContent = `${c.nome || "Colaborador"} • ${t.nome || "Treinamento"}`;
  $("modalTipo").value = row.tipo || "em_branco";
  $("modalOrigem").value = row.tipo_lancamento || (row.tipo === "nao_aplica" ? "nao_aplica" : "ajuste");
  $("modalData").value = row.data_realizacao || "";
  $("modalValidade").value = row.data_validade || "";
  $("modalObs").value = row.observacao || "";
  if($("modalAnexo")) $("modalAnexo").value = "";
  $("modalVinculo").classList.remove("hidden");
};

function fecharModalVinculo(){ $("modalVinculo").classList.add("hidden"); }

function calcularValidadeModal(){
  const tre = treinamentoById($("modalTreId").value); const data = $("modalData").value;
  if(data && tre?.periodicidade_dias && !tre.validade_direta) $("modalValidade").value = addDays(data, tre.periodicidade_dias);
}

async function salvarModalVinculo(){
  const colaboradorId = $("modalColabId").value; const treinamentoId = $("modalTreId").value;
  const tipo = $("modalTipo").value; const origem = $("modalOrigem").value; const data = $("modalData").value || null; const validade = $("modalValidade").value || null; const obs = $("modalObs").value.trim();
  let anexo = { path:null, name:null };
  const file = $("modalAnexo")?.files?.[0];
  if(file) anexo = await uploadAnexo(file, `ajustes/${treinamentoId}`);
  const anterior = db.matriz.find(m => m.colaborador_id === colaboradorId && m.treinamento_id === treinamentoId) || null;
  const row = { colaborador_id:colaboradorId, treinamento_id:treinamentoId, tipo, tipo_lancamento:origem, data_realizacao:data, data_validade:validade, observacao:obs, anexo_url:anexo.path || anterior?.anexo_url || null, anexo_nome:anexo.name || anterior?.anexo_nome || null, atualizado_por:perfil.usuario };
  await gravarHistoricoAntes([colaboradorId], treinamentoId, origem, row, tipo === "nao_aplica" ? "marcar_nao_aplica" : "ajustar_vinculo");
  const { error } = await supabaseClient.from("matriz_treinamentos").upsert(row, { onConflict:"colaborador_id,treinamento_id" });
  if(error){ console.error(error); toast("Erro ao salvar ajuste. Rode o SQL 05 se ainda não rodou."); return; }
  await auditar("ajustar_vinculo", { colaboradorId, treinamentoId, tipo, origem });
  fecharModalVinculo(); await loadAll(); renderAll(); toast("Vínculo atualizado mantendo histórico.");
}

async function salvarAgenda(){
  const row = { treinamento_id:$("agendaTreinamento").value || null, data_hora:$("agendaData").value, setor:$("agendaSetor").value.trim(), local:$("agendaLocal").value.trim(), responsavel:$("agendaResp").value.trim(), criado_por:perfil.usuario, status:"agendado" };
  if(!row.data_hora){ toast("Informe data e hora."); return; }
  const { error } = await supabaseClient.from("agenda_treinamentos").insert(row);
  if(error){ console.error(error); toast("Erro ao salvar agenda."); return; }
  await auditar("agendar_treinamento", row); await loadAll(); renderAgenda(); toast("Agenda salva.");
}

function renderAgenda(){
  if(!$("agendaLista")) return;
  const agora = new Date();
  const itens = db.agenda.filter(a => new Date(a.data_hora) >= agora).sort((a,b)=>new Date(a.data_hora)-new Date(b.data_hora)).slice(0,50);
  $("agendaLista").innerHTML = itens.map(a => `<div class="alert-item"><span class="status solicitado">${new Date(a.data_hora).toLocaleString("pt-BR")}</span><strong>${escapeHtml(treinamentoById(a.treinamento_id).nome || "Treinamento/Reunião")}</strong><small>${escapeHtml(a.setor||"")} • ${escapeHtml(a.local||"")} • ${escapeHtml(a.responsavel||"")}</small></div>`).join("") || `<div class="empty">Nenhum agendamento futuro.</div>`;
}

async function salvarAcesso(){
  if(perfil?.perfil !== "gerencia"){ toast("Apenas Gerência."); return; }
  const row = { auth_user_id:$("accUid").value.trim() || null, usuario:$("accUsuario").value.trim(), nome:$("accNome").value.trim(), perfil:$("accPerfil").value, ativo:true };
  if(!row.usuario || !row.nome){ toast("Informe e-mail/usuário e nome."); return; }
  const { error } = await supabaseClient.from("usuarios_app").upsert(row, { onConflict:"usuario" });
  if(error){ console.error(error); toast("Erro ao salvar acesso."); return; }
  await auditar("salvar_acesso", { usuario:row.usuario, perfil:row.perfil }); await loadAll(); renderAcessos(); toast("Acesso salvo. Lembre de criar/vincular o usuário no Supabase Auth.");
}

function renderAcessos(){
  if(!$("listaAcessos") || perfil?.perfil !== "gerencia") return;
  $("listaAcessos").innerHTML = db.usuarios.map(u => `<div class="alert-item"><span class="status solicitado">${escapeHtml(u.perfil)}</span><strong>${escapeHtml(u.nome || u.usuario)}</strong><small>${escapeHtml(u.usuario)} • Auth UID: ${escapeHtml(u.auth_user_id || "não vinculado")}</small></div>`).join("") || `<div class="empty">Nenhum usuário retornado.</div>`;
}

function renderAuditoria(){
  if(!$("auditoriaLista")) return;
  const itens = [...db.auditoria].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,100);
  $("auditoriaLista").innerHTML = itens.map(a => `<div class="alert-item"><span class="status solicitado">${new Date(a.created_at).toLocaleString("pt-BR")}</span><strong>${escapeHtml(a.acao)}</strong><small>${escapeHtml(a.usuario || "")}</small></div>`).join("") || `<div class="empty">Sem auditoria.</div>`;
}

async function auditar(acao, detalhes={}){
  await supabaseClient.from("auditoria_treinamentos").insert({ usuario:perfil?.usuario || session?.user?.email, acao, detalhes });
}

function toast(msg){ const el=$("toast"); el.textContent=msg; el.classList.remove("hidden"); clearTimeout(window.__t); window.__t=setTimeout(()=>el.classList.add("hidden"),4200); }
