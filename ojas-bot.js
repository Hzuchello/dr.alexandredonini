/* =========================================================
   Ôjas Bot — chat livre conectado ao Agente de IA no n8n
   Site: Dr. Alexandre Donnini (Psicólogo Clínico)
   ---------------------------------------------------------
   O node "Chat Trigger" do n8n espera POST com:
     { "chatInput": "texto do usuário", "sessionId": "..." }
   e responde com:
     { "output": "texto da resposta" }

   IMPORTANTE (checklist no n8n):
   - Workflow precisa estar "Active"
   - Chat Trigger > "Make Chat Publicly Available": ligado
   - Chat Trigger > "Allowed Origins (CORS)": inclua o domínio
     onde este site estiver hospedado (ou "*" em teste)
   - Em teste local com ngrok, sirva o site por um servidor
     (ex.: "python -m http.server") em vez de abrir o arquivo
     direto — abrir como file:// pode ser bloqueado pelo CORS.
   ========================================================= */

const OJAS_CONFIG = {
  webhookUrl: "https://overfunctioning-undefensibly-johnette.ngrok-free.dev/webhook/1d08054d-8c65-44d8-94ea-2f199427137a/chat",
  whatsappNumero: "5541991151535", // Dr. Alexandre Donnini
  nomeAnfitriao: "Dr. Alexandre Donnini",
};

(function () {
  const app = document.getElementById("ojas-bot-app");
  if (!app) return;

  const mensagensEl = app.querySelector("[data-ojas-mensagens]");
  const formEl = app.querySelector("[data-ojas-form]");
  const inputEl = app.querySelector("[data-ojas-input]");
  const botaoEl = formEl.querySelector("button");

  function obterSessionId() {
    let id = localStorage.getItem("ojas-session-id");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : "sess-" + Date.now() + "-" + Math.random().toString(16).slice(2));
      localStorage.setItem("ojas-session-id", id);
    }
    return id;
  }

  const sessionId = obterSessionId();

  function rolarParaFinal() {
    mensagensEl.scrollTop = mensagensEl.scrollHeight;
  }

  function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
  }

  function formatarTextoBot(texto) {
    let seguro = escaparHtml(texto);
    seguro = seguro.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    seguro = seguro.replace(/__(.+?)__/g, "<strong>$1</strong>");
    seguro = seguro.replace(/\*(.+?)\*/g, "<em>$1</em>");
    seguro = seguro.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<em>$1</em>");
    seguro = seguro.replace(/\n/g, "<br>");
    return seguro;
  }

  function falarBot(texto) {
    const bolha = document.createElement("div");
    bolha.className = "bolha bot";
    bolha.innerHTML = formatarTextoBot(texto);
    mensagensEl.appendChild(bolha);
    rolarParaFinal();
    return bolha;
  }

  function falarUsuario(texto) {
    const bolha = document.createElement("div");
    bolha.className = "bolha usuario";
    bolha.textContent = texto;
    mensagensEl.appendChild(bolha);
    rolarParaFinal();
  }

  function mostrarDigitando() {
    const bolha = document.createElement("div");
    bolha.className = "bolha bot";
    bolha.dataset.digitando = "true";
    bolha.textContent = "digitando...";
    mensagensEl.appendChild(bolha);
    rolarParaFinal();
    return bolha;
  }

  function travarEntrada(travar) {
    inputEl.disabled = travar;
    botaoEl.disabled = travar;
  }

  async function enviarMensagem(texto) {
    falarUsuario(texto);
    travarEntrada(true);
    const bolhaDigitando = mostrarDigitando();

    if (!OJAS_CONFIG.webhookUrl) {
      bolhaDigitando.remove();
      falarBot("O bot ainda não está conectado ao n8n. Configure OJAS_CONFIG.webhookUrl no arquivo ojas-bot.js.");
      travarEntrada(false);
      return;
    }

    try {
      const resposta = await fetch(OJAS_CONFIG.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ chatInput: texto, sessionId }),
      });

      if (!resposta.ok) throw new Error("Resposta HTTP " + resposta.status);

      const dados = await resposta.json();
      const textoResposta = dados.output || dados.text || dados.reply || "Recebi sua mensagem, mas não consegui montar uma resposta agora.";

      bolhaDigitando.remove();
      falarBot(textoResposta);
    } catch (erro) {
      bolhaDigitando.remove();
      falarBot(
        "Não consegui falar com o servidor agora. Você pode continuar direto pelo WhatsApp: " +
        "https://wa.me/" + OJAS_CONFIG.whatsappNumero
      );
      console.error("Ôjas Bot — falha ao chamar o webhook:", erro);
    } finally {
      travarEntrada(false);
      inputEl.focus();
    }
  }

  formEl.addEventListener("submit", (evento) => {
    evento.preventDefault();
    const valor = inputEl.value.trim();
    if (!valor) return;
    inputEl.value = "";
    enviarMensagem(valor);
  });

  falarBot(
    "Olá! Eu sou o Ôjas Bot, assistente de primeiro contato do " + OJAS_CONFIG.nomeAnfitriao + ". " +
    "Pode me contar seu nome pra começarmos?"
  );
  travarEntrada(false);
  inputEl.focus();
})();
