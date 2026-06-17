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
let db = { colaboradores: [], treinamentos: [], matriz: [], agenda: [], usuarios: [], auditoria: [] };
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
  document.querySelectorAll(".kpi").forEach(btn => btn.addEventListener("click", () => { statusAtivo = btn.dataset.status; renderDashboard(); }));
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
  const [colabs, treinamentos, matriz, agenda, usuarios, auditoria] = await Promise.all([
    selectAll("colaboradores", "*") ,
    selectAll("treinamentos", "*"),
    selectAll("matriz_treinamentos", "*"),
    selectAll("agenda_treinamentos", "*"),
    perfil?.perfil === "gerencia" ? selectAll("usuarios_app", "*") : Promise.resolve([]),
    selectAll("auditoria_treinamentos", "*")
  ]);
  db = { colaboradores: colabs || [], treinamentos: treinamentos || [], matriz: matriz || [], agenda: agenda || [], usuarios: usuarios || [], auditoria: auditoria || [] };
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
  const base = row.data_validade || (row.data_realizacao && t.periodicidade_dias ? addDays(row.data_realizacao, t.periodicidade_dias) : "");
  if(!base) return {status:"devendo", label:"Devendo", detalhe:"Sem data registrada"};
  const venc = new Date(`${base}T00:00:00`);
  const agora = today();
  const dias = Math.ceil((venc - agora) / 86400000);
  if(dias < 0) return {status:"vencido", label:"Vencido", dias, detalhe:`Venceu há ${Math.abs(dias)} dia(s)`};
  if(dias <= 30) return {status:"vencendo", label:"Vencendo", dias, detalhe: dias === 0 ? "Vence hoje" : `Faltam ${dias} dia(s)`};
  return {status:"em_dia", label:"Em dia", dias, detalhe:`Válido até ${brDate(base)}`};
}

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
  const gVencido = agruparPorColaborador(linhas,"vencido");
  const gVencendo = agruparPorColaborador(linhas,"vencendo");
  const gDevendo = agruparPorColaborador(linhas,"devendo");
  const ok = pessoasSemPendencia(linhas);
  $("kpiVencidos").textContent = gVencido.length;
  $("kpiVencendo").textContent = gVencendo.length;
  $("kpiDevendo").textContent = gDevendo.length;
  $("kpiOk").textContent = ok.length;
  $("kpiColaboradores").textContent = db.colaboradores.filter(c => c.ativo !== false).length;
  document.querySelectorAll(".kpi").forEach(k => k.classList.toggle("active", k.dataset.status === statusAtivo));
  let grupos;
  if(statusAtivo === "vencido") grupos = gVencido;
  else if(statusAtivo === "vencendo") grupos = gVencendo;
  else if(statusAtivo === "devendo") grupos = gDevendo;
  else if(statusAtivo === "ok") grupos = ok.map(c => ({colaborador:c, itens:linhas.filter(l=>l.colaborador.id===c.id && l.status === "em_dia")}));
  else grupos = agruparPorColaborador(linhas,"todos");
  const titulos = {vencido:"Colaboradores com treinamentos vencidos", vencendo:"Colaboradores com treinamentos vencendo", devendo:"Colaboradores devendo treinamentos", ok:"Colaboradores sem pendência crítica", todos:"Todos os colaboradores"};
  $("listaTitulo").textContent = titulos[statusAtivo] || titulos.vencido;
  $("listaResumo").textContent = `${grupos.length} pessoa(s)`;
  $("listaAgrupada").innerHTML = grupos.map(renderGrupo).join("") || `<div class="empty">Nenhum colaborador encontrado para esse filtro.</div>`;
  renderVencendoDias(linhas);
}

function renderGrupo(g){
  const c = g.colaborador;
  const statusCount = g.itens.reduce((acc,i)=>{ acc[i.status]=(acc[i.status]||0)+1; return acc; },{});
  const resumo = Object.entries(statusCount).map(([s,q]) => `${q} ${STATUS_LABEL[s] || s}`).join(" • ");
  const detalhes = g.itens.sort((a,b)=>(a.dias??9999)-(b.dias??9999)).map(i => `
    <div class="detail-row">
      <span><strong>${escapeHtml(i.treinamento.nome)}</strong><br><small>${i.detalhe || ""} • validade: ${brDate(i.validade)}</small></span>
      <span class="status ${i.status}">${STATUS_LABEL[i.status] || i.status}</span>
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

function renderVencendoDias(linhas){
  const v = linhas.filter(l => l.status === "vencendo").sort((a,b)=>a.dias-b.dias || a.colaborador.nome.localeCompare(b.colaborador.nome)).slice(0,60);
  $("listaVencendoDias").innerHTML = v.map(l => `<div class="alert-item">
    <span class="status vencendo">${l.dias === 0 ? "vence hoje" : `faltam ${l.dias} dias`}</span>
    <strong>${escapeHtml(l.colaborador.nome)}</strong>
    <small>${escapeHtml(l.treinamento.nome)} • ${escapeHtml(l.colaborador.setor || "")} • validade ${brDate(l.validade)}</small>
  </div>`).join("") || `<div class="empty">Nenhum treinamento vencendo em até 30 dias.</div>`;
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
    <div class="alert-list">${linhas.map(l => `<div class="alert-item"><span class="status ${l.status}">${STATUS_LABEL[l.status] || l.status}</span><strong>${escapeHtml(l.treinamento.nome)}</strong><small>${l.detalhe || ""} • realizado: ${brDate(l.row.data_realizacao)} • validade: ${brDate(l.validade)}</small></div>`).join("") || `<div class="empty">Sem treinamentos vinculados.</div>`}</div>`;
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
    const old = db; db = {colaboradores:[c], treinamentos:[fakeT], matriz:[fakeR], agenda:[], usuarios:[], auditoria:[]};
    const s = calcStatus(fakeR); db = old;
    const validade = x.data_validade || (x.data_realizacao && x.periodicidade_dias ? addDays(x.data_realizacao, x.periodicidade_dias) : "");
    return {...x, ...s, validade};
  });
  $("publicContent").innerHTML = `<div class="alert-list">${linhas.map(l => `<div class="alert-item"><span class="status ${l.status}">${STATUS_LABEL[l.status] || l.status}</span><strong>${escapeHtml(l.treinamento_nome)}</strong><small>${l.detalhe || ""} • validade: ${brDate(l.validade)}</small></div>`).join("") || `<div class="empty">Sem treinamentos vinculados.</div>`}</div>`;
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
  const ids = [...selecionadosAtualizacao]; const treinamentoId = $("updTreinamento").value; const data = $("updData").value; let validade = $("updValidade").value; const obs = $("updObs").value.trim();
  if(!ids.length || !treinamentoId || !data){ toast("Selecione pessoas, treinamento e data realizada."); return; }
  const tre = treinamentoById(treinamentoId); if(!validade && tre.periodicidade_dias && !tre.validade_direta) validade = addDays(data, tre.periodicidade_dias);
  const rows = ids.map(id => ({ colaborador_id:id, treinamento_id:treinamentoId, tipo:"data", data_realizacao:data, data_validade:validade || null, observacao:obs, atualizado_por:perfil.usuario }));
  const { error } = await supabaseClient.from("matriz_treinamentos").upsert(rows, { onConflict:"colaborador_id,treinamento_id" });
  if(error){ console.error(error); toast("Erro ao salvar atualização."); return; }
  await auditar("reciclagem", { treinamentoId, qtd:ids.length, data, validade });
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
  const row = { id:`tre-${Date.now()}`, nome, periodicidade:`${dias || 0} dias`, periodicidade_dias:dias || null, validade_direta:$("treValidadeDireta").checked, ativo:true, setores_aplicaveis:setores ? setores.split(",").map(s=>s.trim()).filter(Boolean) : [] };
  const { error } = await supabaseClient.from("treinamentos").insert(row);
  if(error){ console.error(error); toast("Erro ao cadastrar treinamento. Rode o SQL LGPD para adicionar setores_aplicaveis."); return; }
  await auditar("cadastrar_treinamento", { nome, dias, setores });
  await loadAll(); hydrateSelects(); renderAll(); toast("Treinamento cadastrado.");
}

function renderBaseColabs(){
  if(!$("tbodyColabs")) return;
  const q = norm($("baseBusca").value);
  const rows = db.colaboradores.filter(c => !q || `${c.matricula} ${c.nome} ${c.setor} ${c.funcao}`.toLowerCase().includes(q)).sort((a,b)=>a.nome.localeCompare(b.nome)).slice(0,500);
  $("tbodyColabs").innerHTML = rows.map(c => `<tr><td>${escapeHtml(c.matricula||"")}</td><td>${escapeHtml(c.nome)}</td><td>${escapeHtml(c.setor||"")}</td><td>${escapeHtml(c.funcao||"")}</td><td>${c.ativo!==false?"Ativo":"Inativo"}</td><td><button class="btn secondary" onclick="editarColab('${escapeHtml(c.id)}')">Editar</button></td></tr>`).join("");
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
