
import { GoogleGenAI } from "@google/genai";

/**
 * ArduProgram IDE - AI Service
 * Utiliza a chave pré-configurada no ambiente.
 */

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
    console.error("AI Error:", error);
    return "Erro ao processar a requisição com a IA. Verifique sua conexão.";
  }
};

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
    const hasSetup = code.includes("void setup()");
    const hasLoop = code.includes("void loop()");
    if (!hasSetup || !hasLoop) {
      return { status: "Aviso", summary: "Estrutura básica ausente (setup/loop). Verifique o código manualmente." };
    }
    return { status: "Erro", summary: "Não foi possível realizar a análise avançada com a IA no momento." };
  }
};
