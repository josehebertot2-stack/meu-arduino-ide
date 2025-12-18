# 🚀 ArduProgram IDE

> **Descrição para o Repositório:** IDE Arduino Web moderna com IA Gemini, Monitor Serial (Web Serial API) e Temas. Programe seu Arduino diretamente do navegador sem instalações. Desenvolvido por José Heberto Torres da Costa.

---

Uma IDE do Arduino poderosa, moderna e totalmente baseada na web. Desenvolvida para facilitar a vida de makers e programadores, eliminando a necessidade de instalações locais e trazendo o poder da Inteligência Artificial para o desenvolvimento de hardware.

## 🛠️ Funcionalidades Principais

- **🤖 IA Gemini Integrada:** Peça ajuda para criar códigos, corrigir erros de lógica ou explicar funções complexas diretamente no chat.
- **🔌 Monitor Serial Web:** Comunique-se com sua placa Arduino diretamente pelo navegador usando a Web Serial API (requer Chrome ou Edge).
- **🎨 Interface Profissional:** Suporte a temas **Dark (Escuro)** e **Light (Claro)**, editor com destaque de sintaxe e números de linha.
- **📚 Gerenciador de Bibliotecas e Placas:** Interface intuitiva para buscar e incluir bibliotecas essenciais no seu projeto.
- **💾 Persistência Local:** Seus códigos ficam salvos no navegador, para você nunca perder seu progresso.
- **📥 Exportação:** Baixe seus arquivos `.ino` prontos para serem usados na IDE oficial.

## 🚀 Como fazer o Deploy

Este projeto está pronto para ser hospedado na **Netlify** ou **Vercel**.

1. Faça o upload dos arquivos para um repositório no GitHub.
2. Conecte o repositório ao **Netlify**.
3. **Importante:** Adicione a Variável de Ambiente:
   - **Key:** `API_KEY`
   - **Value:** Sua chave do [Google AI Studio](https://aistudio.google.com/app/apikey).
4. O site deve ser acessado via **HTTPS** para que a conexão USB (Serial) funcione.

## 👤 Desenvolvedor

Projeto mantido e desenvolvido por:
**José Heberto Torres da Costa**
- 📸 Instagram: [@josehebertot2](https://instagram.com/josehebertot2)

## ⚠️ Requisitos
- Navegador baseado em Chromium (Google Chrome, Microsoft Edge, Opera) para suporte à porta Serial.
- Conexão com a internet para as funções de IA.

---
*Este projeto utiliza a Google Gemini API para processamento de linguagem natural e análise de código.*