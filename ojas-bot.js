/* =========================================================
   Ôjas Bot — triagem e agendamento
   Site: Dr. Alexandre Donnini (Psicólogo Clínico)
   ---------------------------------------------------------
   Como conectar ao n8n mais adiante:
   1. Publique um workflow no n8n com um nó "Webhook" (POST).
   2. Copie a URL do webhook e preencha OJAS_CONFIG.webhookUrl abaixo.
   3. Pronto — a cada triagem concluída, o bot envia um POST em
      JSON para essa URL, além de continuar oferecendo o
      atalho para o WhatsApp como confirmação para o cliente.
   Enquanto webhookUrl estiver vazio, o bot funciona 100% no
   navegador e conduz o cliente até um link pronto do WhatsApp.
   ========================================================= */

const OJAS_CONFIG = {
  webhookUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/1d08054d-8c65-44d8-94ea-2f199427137a/chat", // ex: "https://seu-n8n.dominio.com/webhook/ojas-bot"
  whatsappNumero: "5541991151535", // Dr. Alexandre Donnini
  nomeAnfitriao: "Dr. Alexandre Donnini",
};

(function () {
  const app = document.getElementById("ojas-bot-app");
  if (!app) return;

  const mensagensEl = app.querySelector("[data-ojas-mensagens]");
  const opcoesEl = app.querySelector("[data-ojas-opcoes]");
  const formEl = app.querySelector("[data-ojas-form]");
  const inputEl = app.querySelector("[data-ojas-input]");
  const resumoEl = app.querySelector("[data-ojas-resumo]");

  const respostas = {};
  let etapaAtual = 0;
  let aguardandoTexto = false;
  let textoOpcional = false;

  function rolarParaFinal() {
    mensagensEl.scrollTop = mensagensEl.scrollHeight;
  }

  function falarBot(texto) {
    const bolha = document.createElement("div");
    bolha.className = "bolha bot";
    bolha.textContent = texto;
    mensagensEl.appendChild(bolha);
    rolarParaFinal();
  }

  function falarUsuario(texto) {
    const bolha = document.createElement("div");
    bolha.className = "bolha usuario";
    bolha.textContent = texto;
    mensagensEl.appendChild(bolha);
    rolarParaFinal();
  }

  function limparOpcoes() {
    opcoesEl.innerHTML = "";
  }

  function mostrarOpcoes(lista, aoEscolher) {
    limparOpcoes();
    lista.forEach((opcao) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "opcao-btn";
      btn.textContent = opcao;
      btn.addEventListener("click", () => {
        limparOpcoes();
        falarUsuario(opcao);
        aoEscolher(opcao);
      });
      opcoesEl.appendChild(btn);
    });
  }

  function habilitarTexto(placeholder, opcional) {
    aguardandoTexto = true;
    textoOpcional = !!opcional;
    inputEl.placeholder = placeholder;
    inputEl.disabled = false;
    inputEl.value = "";
    inputEl.focus();
  }

  function desabilitarTexto() {
    aguardandoTexto = false;
    inputEl.disabled = true;
    inputEl.placeholder = "Escolha uma das opções acima";
  }

  // Roteiro da triagem
  const etapas = [
    {
      pergunta: "Olá! Eu sou o Ôjas Bot, assistente de primeiro contato do " + OJAS_CONFIG.nomeAnfitriao + ". Para começarmos, qual é o seu nome?",
      tipo: "texto",
      placeholder: "Digite seu nome",
      chave: "nome",
    },
    {
      pergunta: (r) => `Prazer, ${r.nome}. Você prefere atendimento presencial (região central de Curitiba) ou online?`,
      tipo: "opcoes",
      opcoes: ["Presencial — Curitiba", "Online"],
      chave: "modalidade",
    },
    {
      pergunta: "E o atendimento é para qual faixa de idade?",
      tipo: "opcoes",
      opcoes: ["Jovem", "Adulto", "Idoso"],
      chave: "publico",
    },
    {
      pergunta: "Se quiser, conte brevemente o que te motivou a buscar atendimento (você pode pular esta pergunta).",
      tipo: "texto",
      placeholder: "Escreva aqui ou clique em Pular",
      chave: "motivo",
      opcional: true,
    },
    {
      pergunta: "Por fim, qual o melhor dia e horário para retornarmos o contato?",
      tipo: "texto",
      placeholder: "Ex.: terças à tarde",
      chave: "melhorHorario",
    },
  ];

  function iniciar() {
    executarEtapa(0);
  }

  function executarEtapa(indice) {
    etapaAtual = indice;

    if (indice >= etapas.length) {
      finalizarTriagem();
      return;
    }

    const etapa = etapas[indice];
    const textoPergunta = typeof etapa.pergunta === "function" ? etapa.pergunta(respostas) : etapa.pergunta;

    setTimeout(() => {
      falarBot(textoPergunta);

      if (etapa.tipo === "opcoes") {
        desabilitarTexto();
        mostrarOpcoes(etapa.opcoes, (escolha) => {
          respostas[etapa.chave] = escolha;
          executarEtapa(indice + 1);
        });
      } else {
        limparOpcoes();
        if (etapa.opcional) {
          mostrarOpcoes(["Pular"], () => {
            respostas[etapa.chave] = "(não informado)";
            desabilitarTexto();
            executarEtapa(indice + 1);
          });
        }
        habilitarTexto(etapa.placeholder, etapa.opcional);
      }
    }, 350);
  }

  formEl.addEventListener("submit", (evento) => {
    evento.preventDefault();
    if (!aguardandoTexto) return;

    const valor = inputEl.value.trim();
    if (!valor) return;

    const etapa = etapas[etapaAtual];
    falarUsuario(valor);
    respostas[etapa.chave] = valor;
    desabilitarTexto();
    executarEtapa(etapaAtual + 1);
  });

  function montarResumoTexto() {
    return (
      `Olá, ${OJAS_CONFIG.nomeAnfitriao}! Vim pelo site e passei pela triagem do Ôjas Bot:\n\n` +
      `Nome: ${respostas.nome}\n` +
      `Modalidade: ${respostas.modalidade}\n` +
      `Faixa etária: ${respostas.publico}\n` +
      `Motivo: ${respostas.motivo}\n` +
      `Melhor dia/horário para contato: ${respostas.melhorHorario}`
    );
  }

  function enviarParaWebhook() {
    if (!OJAS_CONFIG.webhookUrl) return;
    fetch(OJAS_CONFIG.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origem: "ojas-bot-site", respostas, criadoEm: new Date().toISOString() }),
    }).catch(() => {
      /* Falha silenciosa: o WhatsApp continua como canal de confirmação. */
    });
  }

  function finalizarTriagem() {
    falarBot("Perfeito, já tenho tudo que preciso! Veja o resumo abaixo e confirme pelo WhatsApp para agendarmos.");
    enviarParaWebhook();

    resumoEl.hidden = false;
    resumoEl.innerHTML = `
      <dl>
        <dt>Nome</dt><dd>${respostas.nome}</dd>
        <dt>Modalidade</dt><dd>${respostas.modalidade}</dd>
        <dt>Faixa etária</dt><dd>${respostas.publico}</dd>
        <dt>Motivo</dt><dd>${respostas.motivo}</dd>
        <dt>Melhor horário</dt><dd>${respostas.melhorHorario}</dd>
      </dl>
      <a class="btn btn-primaria" style="margin-top:14px" target="_blank" rel="noopener"
         href="https://wa.me/${OJAS_CONFIG.whatsappNumero}?text=${encodeURIComponent(montarResumoTexto())}">
        Confirmar pelo WhatsApp
      </a>
    `;
    rolarParaFinal();
  }

  iniciar();
})();
