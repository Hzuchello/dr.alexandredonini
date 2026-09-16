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
  linkSessao: "https://meet.google.com/dma-eenm-yus",
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
const loginOk = document.getElementById("login-ok");
const btnEntrar = document.getElementById("btn-entrar");
const btnEsqueci = document.getElementById("btn-esqueci");
const formNovaSenha = document.getElementById("form-nova-senha");
const senhaErro = document.getElementById("senha-erro");
const btnSalvarSenha = document.getElementById("btn-salvar-senha");
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
let timerAgenda = null;
const INTERVALO_AGENDA_MS = 10000;
const CHAVE_REALIZADOS = "ojas-admin-realizados";
const CHAVE_OBS_LOCAL = "ojas-admin-obs-realizados";
const cardsArquivadosAbertos = new Set();

function idsRealizadosLocal() {
  try {
    const lista = JSON.parse(sessionStorage.getItem(CHAVE_REALIZADOS) || "[]");
    return Array.isArray(lista) ? lista : [];
  } catch (erro) {
    return [];
  }
}

function estaArquivadoLocal(id) {
  return idsRealizadosLocal().includes(String(id));
}

function arquivarLocal(id) {
  const set = new Set(idsRealizadosLocal());
  set.add(String(id));
  sessionStorage.setItem(CHAVE_REALIZADOS, JSON.stringify(Array.from(set)));
}

function notasRealizadoLocal() {
  try {
    const mapa = JSON.parse(sessionStorage.getItem(CHAVE_OBS_LOCAL) || "{}");
    return mapa && typeof mapa === "object" ? mapa : {};
  } catch (erro) {
    return {};
  }
}

function salvarNotaRealizadoLocal(id, texto) {
  const mapa = notasRealizadoLocal();
  mapa[String(id)] = texto;
  sessionStorage.setItem(CHAVE_OBS_LOCAL, JSON.stringify(mapa));
}

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

function urlRecuperacao() {
  return window.location.origin + window.location.pathname;
}

function mostrarFormularioRecuperacao(mostrar) {
  if (!formNovaSenha) return;
  loginForm.hidden = mostrar;
  formNovaSenha.hidden = !mostrar;
}

function mostrarView(logado) {
  if (logado) mostrarFormularioRecuperacao(false);
  loginView.hidden = logado;
  appView.hidden = !logado;
  if (!logado) {
    pararAtualizacaoAgenda();
    fecharPainelDia();
    agendamentosDoMes = [];
    return;
  }
  carregarMes(false).then(() => abrirPainelDia(hojeISO()));
  iniciarAtualizacaoAgenda();
}

function pararAtualizacaoAgenda() {
  if (timerAgenda) {
    clearInterval(timerAgenda);
    timerAgenda = null;
  }
}

function iniciarAtualizacaoAgenda() {
  pararAtualizacaoAgenda();
  timerAgenda = setInterval(() => {
    if (appView.hidden) return;
    if (operacaoEmAndamento) return;
    if (document.hidden) return;
    carregarMes(true);
  }, INTERVALO_AGENDA_MS);
}

if (btnEsqueci) {
  btnEsqueci.addEventListener("click", async () => {
    limparErro(loginErro);
    if (loginOk) loginOk.hidden = true;
    const email = document.getElementById("login-email").value.trim();
    if (!email) {
      mostrarErro(loginErro, "Informe o e-mail cadastrado para enviar o link.");
      document.getElementById("login-email").focus();
      return;
    }
    if (!cliente || configInvalida()) {
      mostrarErro(loginErro, "Configure a chave anon do Supabase em admin.js.");
      return;
    }
    btnEsqueci.disabled = true;
    const { error } = await cliente.auth.resetPasswordForEmail(email, {
      redirectTo: urlRecuperacao(),
    });
    btnEsqueci.disabled = false;
    if (error) {
      mostrarErro(loginErro, mensagemAmigavel(error, "Não foi possível enviar o e-mail de recuperação."));
      return;
    }
    if (loginOk) {
      loginOk.textContent = "Se este e-mail estiver cadastrado, enviamos um link para redefinir a senha.";
      loginOk.hidden = false;
    }
  });
}

if (formNovaSenha) {
  formNovaSenha.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    limparErro(senhaErro);
    const senha = document.getElementById("nova-senha").value;
    const senha2 = document.getElementById("nova-senha-2").value;
    if (!senha || senha.length < 6) {
      mostrarErro(senhaErro, "A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== senha2) {
      mostrarErro(senhaErro, "As senhas não coincidem.");
      return;
    }
    btnSalvarSenha.disabled = true;
    btnSalvarSenha.textContent = "Salvando...";
    const { error } = await cliente.auth.updateUser({ password: senha });
    btnSalvarSenha.disabled = false;
    btnSalvarSenha.textContent = "Salvar senha";
    if (error) {
      mostrarErro(senhaErro, mensagemAmigavel(error, "Não foi possível salvar a nova senha."));
      return;
    }
    formNovaSenha.reset();
    mostrarFormularioRecuperacao(false);
    mostrarView(true);
  });
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
  cliente.auth.onAuthStateChange((eventoAuth, sessao) => {
    if (eventoAuth === "PASSWORD_RECOVERY") {
      mostrarView(false);
      mostrarFormularioRecuperacao(true);
      return;
    }
    const logado = !!sessao;
    if (loginView.hidden !== logado) mostrarView(logado);
  });
}

/* ---------- Calendário ---------- */

async function carregarMes(silencioso) {
  const ano = mesAtual.getFullYear();
  const mes = mesAtual.getMonth();
  mesTitulo.textContent = NOMES_MES[mes] + " de " + ano;
  if (!silencioso) {
    limparErro(calendarioStatus);
    calendarioGrade.classList.add("carregando");
  }

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
  if (error && !silencioso) {
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
    celula.setAttribute(
      "aria-label",
      formatarDataTitulo(iso) + (confirmados.length ? ", " + confirmados.length + " agendamento(s)" : "")
    );
    celula.innerHTML =
      String(dia) + (confirmados.length ? '<span class="dia-badge">' + confirmados.length + "</span>" : "");
    celula.addEventListener("click", () => abrirPainelDia(iso));
    calendarioGrade.appendChild(celula);
  }
}

btnMesAnterior.addEventListener("click", () => {
  mesAtual.setMonth(mesAtual.getMonth() - 1);
  carregarMes(false);
});

btnMesSeguinte.addEventListener("click", () => {
  mesAtual.setMonth(mesAtual.getMonth() + 1);
  carregarMes(false);
});

btnHoje.addEventListener("click", () => {
  const agora = new Date();
  mesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  carregarMes(false).then(() => abrirPainelDia(hojeISO()));
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
    const cancelado = agendamento.status === "cancelado";
    const realizadoLocal =
      !cancelado && (agendamento.status === "realizado" || estaArquivadoLocal(agendamento.id));
    const arquivado = cancelado || realizadoLocal;
    item.className =
      "agendamento-item" +
      (cancelado ? " cancelado" : "") +
      (realizadoLocal ? " realizado" : "") +
      (arquivado ? (cardsArquivadosAbertos.has(String(agendamento.id)) ? " aberto" : " resumido") : "");
    const faixa = agendamento.faixa_etaria ? " · " + escaparHtml(agendamento.faixa_etaria) : "";
    const notaLocal = notasRealizadoLocal()[String(agendamento.id)] || "";
    const textoObs = [agendamento.observacoes, notaLocal].filter(Boolean).join(" · ");
    const obs = textoObs ? "<p>" + escaparHtml(textoObs) + "</p>" : "";
    const rotuloStatus = cancelado ? "cancelado" : realizadoLocal ? "realizado" : (agendamento.status || "");
    const mostrarAcoes = !cancelado && !realizadoLocal;
    item.innerHTML =
      '<div class="agendamento-resumo">' +
      '<span class="horario">' +
      escaparHtml(normalizarHora(agendamento.hora_inicio)) +
      (arquivado ? "" : " – " + escaparHtml(normalizarHora(agendamento.hora_fim))) +
      "</span>" +
      '<span class="nome-resumo">' +
      escaparHtml(agendamento.nome_paciente || "") +
      "</span>" +
      '<span class="status-tag">' +
      escaparHtml(rotuloStatus) +
      "</span>" +
      "</div>" +
      '<div class="agendamento-detalhe">' +
      (arquivado
        ? "<p><strong>" +
          escaparHtml(agendamento.nome_paciente || "") +
          "</strong></p>" +
          '<span class="horario">' +
          escaparHtml(normalizarHora(agendamento.hora_inicio)) +
          " – " +
          escaparHtml(normalizarHora(agendamento.hora_fim)) +
          "</span>"
        : "") +
      "<p>" +
      escaparHtml(formatarTelefone(agendamento.telefone)) +
      " · " +
      escaparHtml(agendamento.modalidade || "") +
      faixa +
      "</p>" +
      obs +
      (mostrarAcoes
        ? '<div class="agendamento-acoes">' +
          '<button type="button" class="btn-cancelar" data-acao="cancelar" title="Cancelar" aria-label="Cancelar">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 6.4 12 12l5.6 5.6M17.6 6.4 12 12 6.4 17.6"/></svg>' +
          "</button>" +
          '<button type="button" class="btn-realizado" data-acao="realizado" title="Realizado" aria-label="Realizado">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>' +
          "</button>" +
          (String(agendamento.modalidade || "").toLowerCase() === "online"
            ? '<button type="button" class="btn-link-sessao" data-acao="link" title="Enviar link da sessão" aria-label="Enviar link da sessão">' +
              '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93M14 11a5 5 0 0 0-7.07 0L5.52 12.4a5 5 0 0 0 7.07 7.07L14 18.07"/></svg>' +
              "</button>"
            : "") +
          "</div>"
        : "") +
      "</div>";
    item.querySelector('[data-acao="cancelar"]')?.addEventListener("click", () => pedirCancelamento(agendamento.id));
    item.querySelector('[data-acao="realizado"]')?.addEventListener("click", () => marcarRealizadoNaTela(agendamento.id));
    item.querySelector('[data-acao="link"]')?.addEventListener("click", (evento) => {
      evento.stopPropagation();
      enviarLinkSessao(agendamento);
    });
    if (arquivado) {
      item.addEventListener("click", () => {
        const chave = String(agendamento.id);
        const vaiAbrir = item.classList.contains("resumido");
        item.classList.toggle("resumido");
        item.classList.toggle("aberto");
        if (vaiAbrir) cardsArquivadosAbertos.add(chave);
        else cardsArquivadosAbertos.delete(chave);
      });
    }
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
    if (a.status === "cancelado" || a.status === "realizado") return false;
    if (ignorarId && a.id === ignorarId) return false;
    const aIni = horaParaMinutos(a.hora_inicio);
    const aFim = horaParaMinutos(a.hora_fim);
    return ini < aFim && fim > aIni;
  });
}

const modalRealizado = document.getElementById("modal-realizado");
const modalPassoPergunta = document.getElementById("modal-realizado-passo-pergunta");
const modalPassoTexto = document.getElementById("modal-realizado-passo-texto");
const modalTexto = document.getElementById("modal-realizado-texto");
let idPendenteRealizado = null;

function fecharModalRealizado() {
  if (!modalRealizado) return;
  modalRealizado.hidden = true;
  idPendenteRealizado = null;
  if (modalTexto) modalTexto.value = "";
  if (modalPassoPergunta) modalPassoPergunta.hidden = false;
  if (modalPassoTexto) modalPassoTexto.hidden = true;
}

function abrirModalRealizado(id) {
  idPendenteRealizado = id;
  if (modalTexto) modalTexto.value = "";
  if (modalPassoPergunta) modalPassoPergunta.hidden = false;
  if (modalPassoTexto) modalPassoTexto.hidden = true;
  if (modalRealizado) modalRealizado.hidden = false;
}

async function concluirRealizado(nota) {
  const id = idPendenteRealizado;
  fecharModalRealizado();
  if (!id || !cliente) return;
  const atual = agendamentosDoMes.find((a) => String(a.id) === String(id));
  const junta = nota
    ? [atual && atual.observacoes, nota].filter(Boolean).join(" · ")
    : atual && atual.observacoes;
  const payload = { status: "realizado" };
  if (nota) payload.observacoes = junta;
  const { error } = await cliente.from("agendamentos").update(payload).eq("id", id);
  if (error) {
    alert(mensagemAmigavel(error, "Não foi possível marcar como realizado. Confira se a coluna status aceita esse valor."));
    return;
  }
  if (nota) salvarNotaRealizadoLocal(id, nota);
  arquivarLocal(id);
  await carregarMes(false);
}

function marcarRealizadoNaTela(id) {
  abrirModalRealizado(id);
}

function enviarLinkSessao(agendamento) {
  const link = (ADMIN_CONFIG.linkSessao || "").trim();
  if (!link || link.startsWith("COLE_")) {
    alert("Cole o link da sessão (Meet, Zoom etc.) em ADMIN_CONFIG.linkSessao no admin.js.");
    return;
  }
  const digitos = sanitizarTelefone(agendamento.telefone);
  if (digitos.length < 10) {
    alert("Este agendamento não tem WhatsApp válido para envio.");
    return;
  }
  const e164 = digitos.length === 11 || digitos.length === 10 ? "55" + digitos : digitos;
  const hora = normalizarHora(agendamento.hora_inicio);
  const texto =
    "Olá, " +
    (agendamento.nome_paciente || "") +
    ". Segue o link da sessão de hoje às " +
    hora +
    ": " +
    link;
  window.open("https://wa.me/" + e164 + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
}

if (modalRealizado) {
  document.getElementById("modal-realizado-sim")?.addEventListener("click", () => {
    if (modalPassoPergunta) modalPassoPergunta.hidden = true;
    if (modalPassoTexto) modalPassoTexto.hidden = false;
    modalTexto?.focus();
  });
  document.getElementById("modal-realizado-nao")?.addEventListener("click", () => concluirRealizado(""));
  document.getElementById("modal-realizado-abortar")?.addEventListener("click", () => fecharModalRealizado());
  document.getElementById("modal-realizado-salvar")?.addEventListener("click", () => {
    concluirRealizado((modalTexto && modalTexto.value.trim()) || "");
  });
  document.getElementById("modal-realizado-pular")?.addEventListener("click", () => concluirRealizado(""));
  modalRealizado.querySelector("[data-modal-fechar]")?.addEventListener("click", () => fecharModalRealizado());
}

const modalCancelar = document.getElementById("modal-cancelar");
let idPendenteCancelar = null;

function fecharModalCancelar() {
  if (modalCancelar) modalCancelar.hidden = true;
  idPendenteCancelar = null;
}

function pedirCancelamento(id) {
  idPendenteCancelar = id;
  if (modalCancelar) modalCancelar.hidden = false;
}

if (modalCancelar) {
  document.getElementById("modal-cancelar-sim")?.addEventListener("click", () => {
    const id = idPendenteCancelar;
    fecharModalCancelar();
    if (id) atualizarStatus(id, "cancelado");
  });
  document.getElementById("modal-cancelar-nao")?.addEventListener("click", fecharModalCancelar);
  modalCancelar.querySelector("[data-modal-cancelar-fechar]")?.addEventListener("click", fecharModalCancelar);
}

async function atualizarStatus(id, novoStatus) {
  if (operacaoEmAndamento || !cliente) return;
  operacaoEmAndamento = true;
  const { error } = await cliente.from("agendamentos").update({ status: novoStatus }).eq("id", id);
  operacaoEmAndamento = false;
  if (error) {
    alert(mensagemAmigavel(error, "Não foi possível atualizar o status."));
    return;
  }
  await carregarMes(false);
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
  operacaoEmAndamento = true;
  const { error } = await cliente.from("agendamentos").insert(novo);
  operacaoEmAndamento = false;
  btnSalvarNovo.disabled = false;
  btnSalvarNovo.textContent = "Salvar agendamento";

  if (error) {
    mostrarErro(novoErro, mensagemAmigavel(error, "Não foi possível salvar o agendamento."));
    return;
  }

  formNovo.reset();
  if (detalhesNovo) detalhesNovo.open = false;
  await carregarMes(false);
});

verificarSessao();
