/* =========================================================
   Admin — Agenda do Dr. Alexandre Donnini
   ---------------------------------------------------------
   Use SOMENTE a chave pública (anon / publishable).
   Settings > API no Supabase.

   NUNCA cole uma chave sb_secret_ ou service_role no front-end.
   Quem protege os dados é a Row Level Security (RLS) da
   tabela "agendamentos".
   ========================================================= */

const ADMIN_CONFIG = {
  supabaseUrl: "https://fiplnxrqbcoxadzirawm.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcGxueHJxYmNveGFkemlyYXdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNTU0NDUsImV4cCI6MjEwNDgzMTQ0NX0.cu1Mb5nwAkA93mBu40W96SVKmnr7ndUSmefmHEgYpq4",
};

function configInvalida() {
  const chave = ADMIN_CONFIG.supabaseKey || "";
  return (
    !ADMIN_CONFIG.supabaseUrl ||
    !chave ||
    chave.startsWith("COLE_AQUI") ||
    chave.startsWith("sb_secret_") ||
    chave.includes("service_role")
  );
}

if (typeof window.supabase === "undefined") {
  console.error("Biblioteca do Supabase não carregou.");
}

const cliente = window.supabase
  ? window.supabase.createClient(ADMIN_CONFIG.supabaseUrl, ADMIN_CONFIG.supabaseKey || "invalid")
  : null;

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginForm = document.getElementById("login-form");
const loginErro = document.getElementById("login-erro");
const btnEntrar = document.getElementById("btn-entrar");
const btnSair = document.getElementById("btn-sair");
const btnHoje = document.getElementById("btn-hoje");

const mesTitulo = document.getElementById("mes-titulo");
const calendarioGrade = document.getElementById("calendario-grade");
const calendarioStatus = document.getElementById("calendario-status");
const btnMesAnterior = document.getElementById("mes-anterior");
const btnMesSeguinte = document.getElementById("mes-seguinte");

const painelDia = document.getElementById("painel-dia");
const painelDiaTitulo = document.getElementById("painel-dia-titulo");
const listaAgendamentos = document.getElementById("lista-agendamentos");
const formNovo = document.getElementById("form-novo");
const novoErro = document.getElementById("novo-erro");
const btnSalvarNovo = document.getElementById("btn-salvar-novo");
const detalhesNovo = document.getElementById("detalhes-novo");

let mesAtual = new Date();
mesAtual.setDate(1);
mesAtual.setHours(0, 0, 0, 0);

let agendamentosDoMes = [];
let diaSelecionado = null;
let operacaoEmAndamento = false;

const NOMES_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function dataParaISO(date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

function hojeISO() {
  return dataParaISO(new Date());
}

function normalizarHora(valor) {
  if (!valor) return "";
  const partes = String(valor).split(":");
  const hh = String(partes[0] || "00").padStart(2, "0");
  const mm = String(partes[1] || "00").padStart(2, "0");
  return hh + ":" + mm;
}

function horaParaMinutos(valor) {
  const [hh, mm] = normalizarHora(valor).split(":").map(Number);
  return hh * 60 + mm;
}

function sanitizarTelefone(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function formatarTelefone(valor) {
  const d = sanitizarTelefone(valor);
  if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return valor || "";
}

function mostrarErro(el, mensagem) {
  el.textContent = mensagem;
  el.hidden = false;
}

function limparErro(el) {
  el.textContent = "";
  el.hidden = true;
}

function mensagemAmigavel(error, fallback) {
  const raw = (error && (error.message || error.error_description)) || "";
  if (/invalid login|invalid credentials/i.test(raw)) return "E-mail ou senha incorretos.";
  if (/not configured|invalid api key|JWT/i.test(raw)) return "Configuração do Supabase inválida. Verifique a URL e a chave anon.";
  if (/row-level security|rls/i.test(raw)) return "Permissão negada pelo banco (RLS). Confira as políticas da tabela agendamentos.";
  if (/Failed to fetch|NetworkError|network/i.test(raw)) return "Falha de rede. Verifique a conexão e tente de novo.";
  return fallback || raw || "Não foi possível concluir a operação.";
}

/* ---------- Autenticação ---------- */

async function verificarSessao() {
  if (!cliente || configInvalida()) {
    mostrarView(false);
    mostrarErro(
      loginErro,
      "Configure no admin.js a Project URL e a chave anon/publishable do Supabase. Não use chave secret."
    );
    return;
  }

  const { data } = await cliente.auth.getSession();
  mostrarView(!!data.session);
}

function mostrarView(logado) {
  loginView.hidden = logado;
  appView.hidden = !logado;
  if (!logado) {
    fecharPainelDia();
    agendamentosDoMes = [];
    return;
  }
  carregarMes();
}

loginForm.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limparErro(loginErro);

  if (!cliente || configInvalida()) {
    mostrarErro(loginErro, "Configure a chave anon/publishable do Supabase em admin.js.");
    return;
  }

  const email = document.getElementById("login-email").value.trim();
  const senha = document.getElementById("login-senha").value;

  if (!email || !senha) {
    mostrarErro(loginErro, "Informe e-mail e senha.");
    return;
  }

  btnEntrar.disabled = true;
  btnEntrar.textContent = "Entrando...";

  const { error } = await cliente.auth.signInWithPassword({ email, password: senha });

  btnEntrar.disabled = false;
  btnEntrar.textContent = "Entrar";

  if (error) {
    mostrarErro(loginErro, mensagemAmigavel(error, "E-mail ou senha incorretos."));
    return;
  }

  loginForm.reset();
  mostrarView(true);
});

btnSair.addEventListener("click", async () => {
  if (cliente) await cliente.auth.signOut();
  mostrarView(false);
});

if (cliente) {
  cliente.auth.onAuthStateChange((_evento, sessao) => {
    const logado = !!sessao;
    if (loginView.hidden !== logado) mostrarView(logado);
  });
}

/* ---------- Calendário ---------- */

async function carregarMes() {
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  mesTitulo.textContent = NOMES_MES[mes] + " de " + ano;
  limparErro(calendarioStatus);
  calendarioGrade.classList.add("carregando");

  const primeiroDia = dataParaISO(new Date(ano, mes, 1));
  const ultimoDia = dataParaISO(new Date(ano, mes + 1, 0));

  if (!cliente) {
    agendamentosDoMes = [];
    desenharGrade();
    calendarioGrade.classList.remove("carregando");
    return;
  }

  const { data, error } = await cliente
    .from("agendamentos")
    .select("*")
    .gte("data", primeiroDia)
    .lte("data", ultimoDia)
    .order("hora_inicio", { ascending: true });

  agendamentosDoMes = error ? [] : (data || []);
  if (error) {
    mostrarErro(calendarioStatus, mensagemAmigavel(error, "Não foi possível carregar os agendamentos."));
  }

  desenharGrade();
  calendarioGrade.classList.remove("carregando");

  if (diaSelecionado) desenharListaDoDia();
}

function desenharGrade() {
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  calendarioGrade.innerHTML = "";

  for (let i = 0; i < primeiroDiaSemana; i++) {
    const vazio = document.createElement("div");
    vazio.className = "dia vazio";
    vazio.setAttribute("aria-hidden", "true");
    calendarioGrade.appendChild(vazio);
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const dataAtual = new Date(ano, mes, dia);
    const iso = dataParaISO(dataAtual);
    const confirmados = agendamentosDoMes.filter((a) => a.data === iso && a.status === "confirmado");

    const celula = document.createElement("button");
    celula.type = "button";
    celula.className = "dia" + (iso === hojeISO() ? " hoje" : "") + (iso === diaSelecionado ? " selecionado" : "");
    celula.setAttribute("aria-label", formatarDataTitulo(iso) + (confirmados.length ? ", " + confirmados.length + " agendamento(s)" : ""));
    celula.innerHTML = String(dia) + (confirmados.length ? '<span class="dia-badge">' + confirmados.length + "</span>" : "");
    celula.addEventListener("click", () => abrirPainelDia(iso));
    calendarioGrade.appendChild(celula);
  }
}

btnMesAnterior.addEventListener("click", () => {
  mesAtual.setMonth(mesAtual.getMonth() - 1);
  carregarMes();
});

btnMesSeguinte.addEventListener("click", () => {
  mesAtual.setMonth(mesAtual.getMonth() + 1);
  carregarMes();
});

btnHoje.addEventListener("click", () => {
  const agora = new Date();
  mesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  carregarMes().then(() => abrirPainelDia(hojeISO()));
});

/* ---------- Painel do dia ---------- */

function formatarDataTitulo(iso) {
  const [ano, mes, dia] = iso.split("-");
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return data.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function abrirPainelDia(iso) {
  diaSelecionado = iso;
  painelDiaTitulo.textContent = formatarDataTitulo(iso);
  desenharListaDoDia();
  painelDia.hidden = false;
  document.body.classList.add("painel-aberto");
  desenharGrade();
}

function fecharPainelDia() {
  painelDia.hidden = true;
  document.body.classList.remove("painel-aberto");
  diaSelecionado = null;
  formNovo.reset();
  limparErro(novoErro);
  if (detalhesNovo) detalhesNovo.open = false;
  desenharGrade();
}

document.querySelectorAll("[data-fechar]").forEach((el) => {
  el.addEventListener("click", fecharPainelDia);
});

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && !painelDia.hidden) fecharPainelDia();
});

function desenharListaDoDia() {
  const doDia = agendamentosDoMes
    .filter((a) => a.data === diaSelecionado)
    .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));

  if (!doDia.length) {
    listaAgendamentos.innerHTML = '<p class="sem-agendamentos">Nenhum agendamento neste dia.</p>';
    return;
  }

  listaAgendamentos.innerHTML = "";
  doDia.forEach((agendamento) => {
    const item = document.createElement("div");
    item.className = "agendamento-item" + (agendamento.status === "cancelado" ? " cancelado" : "");

    const faixa = agendamento.faixa_etaria ? " · " + escaparHtml(agendamento.faixa_etaria) : "";
    const obs = agendamento.observacoes ? "<p>" + escaparHtml(agendamento.observacoes) + "</p>" : "";

    item.innerHTML =
      '<span class="horario">' +
      escaparHtml(normalizarHora(agendamento.hora_inicio)) +
      " – " +
      escaparHtml(normalizarHora(agendamento.hora_fim)) +
      "</span>" +
      '<span class="status-tag">' +
      escaparHtml(agendamento.status || "") +
      "</span>" +
      "<p><strong>" +
      escaparHtml(agendamento.nome_paciente || "") +
      "</strong></p>" +
      "<p>" +
      escaparHtml(formatarTelefone(agendamento.telefone)) +
      " · " +
      escaparHtml(agendamento.modalidade || "") +
      faixa +
      "</p>" +
      obs +
      '<div class="agendamento-acoes">' +
      (agendamento.status !== "cancelado" ? '<button type="button" data-acao="cancelar">Cancelar</button>' : "") +
      '<button type="button" data-acao="excluir" class="excluir">Excluir</button>' +
      "</div>";

    item.querySelector('[data-acao="cancelar"]')?.addEventListener("click", () => atualizarStatus(agendamento.id, "cancelado"));
    item.querySelector('[data-acao="excluir"]').addEventListener("click", () => excluirAgendamento(agendamento.id));
    listaAgendamentos.appendChild(item);
  });
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto == null ? "" : String(texto);
  return div.innerHTML;
}

function horariosSobrepostos(novoInicio, novoFim, ignorarId) {
  const ini = horaParaMinutos(novoInicio);
  const fim = horaParaMinutos(novoFim);
  return agendamentosDoMes.some((a) => {
    if (a.data !== diaSelecionado) return false;
    if (a.status === "cancelado") return false;
    if (ignorarId && a.id === ignorarId) return false;
    const aIni = horaParaMinutos(a.hora_inicio);
    const aFim = horaParaMinutos(a.hora_fim);
    return ini < aFim && fim > aIni;
  });
}

async function atualizarStatus(id, novoStatus) {
  if (operacaoEmAndamento || !cliente) return;
  if (novoStatus === "cancelado" && !confirm("Cancelar este agendamento?")) return;

  operacaoEmAndamento = true;
  const { error } = await cliente.from("agendamentos").update({ status: novoStatus }).eq("id", id);
  operacaoEmAndamento = false;

  if (error) {
    alert(mensagemAmigavel(error, "Não foi possível atualizar o status."));
    return;
  }

  await carregarMes();
}

async function excluirAgendamento(id) {
  if (operacaoEmAndamento || !cliente) return;
  if (!confirm("Excluir este agendamento definitivamente?")) return;

  operacaoEmAndamento = true;
  const { error } = await cliente.from("agendamentos").delete().eq("id", id);
  operacaoEmAndamento = false;

  if (error) {
    alert(mensagemAmigavel(error, "Não foi possível excluir o agendamento."));
    return;
  }

  await carregarMes();
}

/* ---------- Novo agendamento ---------- */

formNovo.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  limparErro(novoErro);

  if (!cliente || !diaSelecionado) {
    mostrarErro(novoErro, "Selecione um dia válido.");
    return;
  }

  const nome = document.getElementById("novo-nome").value.trim();
  const telefone = sanitizarTelefone(document.getElementById("novo-telefone").value);
  const horaInicio = document.getElementById("novo-inicio").value;
  const horaFim = document.getElementById("novo-fim").value;

  if (!nome) {
    mostrarErro(novoErro, "Informe o nome do paciente.");
    return;
  }
  if (telefone.length < 10 || telefone.length > 13) {
    mostrarErro(novoErro, "Informe um telefone válido com DDD.");
    return;
  }
  if (!horaInicio || !horaFim) {
    mostrarErro(novoErro, "Informe horário de início e fim.");
    return;
  }
  if (horaParaMinutos(horaFim) <= horaParaMinutos(horaInicio)) {
    mostrarErro(novoErro, "O horário de fim precisa ser depois do início.");
    return;
  }
  if (horariosSobrepostos(horaInicio, horaFim)) {
    mostrarErro(novoErro, "Já existe um agendamento confirmado nesse horário.");
    return;
  }

  const novo = {
    nome_paciente: nome,
    telefone,
    modalidade: document.getElementById("novo-modalidade").value,
    faixa_etaria: document.getElementById("novo-faixa").value || null,
    data: diaSelecionado,
    hora_inicio: horaInicio,
    hora_fim: horaFim,
    observacoes: document.getElementById("novo-obs").value.trim() || null,
    status: "confirmado",
  };

  btnSalvarNovo.disabled = true;
  btnSalvarNovo.textContent = "Salvando...";

  const { error } = await cliente.from("agendamentos").insert(novo);

  btnSalvarNovo.disabled = false;
  btnSalvarNovo.textContent = "Salvar agendamento";

  if (error) {
    mostrarErro(novoErro, mensagemAmigavel(error, "Não foi possível salvar o agendamento."));
    return;
  }

  formNovo.reset();
  if (detalhesNovo) detalhesNovo.open = false;
  await carregarMes();
});

verificarSessao();
