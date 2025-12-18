
import { GoogleGenAI } from "@google/genai";

/**
 * ArduProgram IDE - AI Service
 * Utiliza a chave selecionada pelo usuário no ambiente.
 */

// Use gemini-3-pro-preview for coding-related tasks as per guidelines
export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Código Arduino Atual:\n${currentCode}\n\nDúvida do Usuário: ${prompt}`,
      config: {
        systemInstruction: "Você é um assistente especialista em Arduino e eletrônica. Responda de forma clara, técnica porém acessível, em português do Brasil. Use blocos de código 'cpp' para exemplos de código.",
      },
    });

    return response.text || "Sem resposta do assistente.";
  } catch (error: any) {
    // If the request fails with "Requested entity was not found.", prompt the user to select a key again
    if (error.message?.includes("Requested entity was not found")) {
      if (window.aistudio?.openSelectKey) {
        window.aistudio.openSelectKey();
      }
      return "Sua chave parece inválida. Por favor, selecione uma chave válida no diálogo que se abriu.";
    }
    console.error("AI Error:", error);
    return "Erro ao processar a requisição com a IA.";
  }
};

// Use gemini-3-pro-preview and add robust error handling for API keys
export const analyzeCode = async (code: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analise este código Arduino em busca de erros ou melhorias: ${code}`,
    });

    return { 
      status: "Ok", 
      summary: response.text || "Análise concluída."
    };
  } catch (error: any) {
    // Handle invalid key error explicitly
    if (error.message?.includes("Requested entity was not found")) {
      if (window.aistudio?.openSelectKey) {
        window.aistudio.openSelectKey();
      }
      return { status: "Erro", summary: "Chave de API inválida. Selecione uma chave válida no menu IA." };
    }

    const hasSetup = code.includes("void setup()");
    const hasLoop = code.includes("void loop()");
    if (!hasSetup || !hasLoop) {
      return { status: "Aviso", summary: "Estrutura básica ausente (setup/loop). Ative a IA para uma análise profunda." };
    }
    return { status: "Ok", summary: "Análise local: Estrutura OK. Ative a IA para detectar erros lógicos." };
  }
};