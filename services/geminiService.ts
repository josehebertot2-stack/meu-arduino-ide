
import { GoogleGenAI } from "@google/genai";

/**
 * ArduProgram IDE - AI Service
 * Especializado em desenvolvimento de firmware Arduino.
 */

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    const ai = getAIClient();
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é o ArduBot, o assistente oficial da IDE ArduProgram. 
          AJUDE O USUÁRIO COM O CÓDIGO ABAIXO.
          
          CÓDIGO ATUAL:
          \`\`\`cpp
          ${currentCode}
          \`\`\`
          
          PERGUNTA: ${prompt}
          
          REGRAS:
          1. Responda em Português (Brasil).
          2. Se sugerir alterações, forneça o bloco de código completo em C++.
          3. Seja breve e técnico.`,
      config: {
        temperature: 0.7,
        topP: 0.9,
      },
    });

    return response.text || "Sem resposta da IA.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message === "API_KEY_MISSING") {
      return "⚠️ Erro: Chave de API não configurada. Clique no botão de chave acima ou configure o ambiente.";
    }
    if (error.message?.includes("Requested entity was not found")) {
      return "⚠️ Erro: Modelo não encontrado ou chave expirada. Tente selecionar sua chave novamente.";
    }
    return `❌ Erro na IA: ${error.message || "Falha na conexão."}`;
  }
};

export const analyzeCode = async (code: string) => {
  try {
    const ai = getAIClient();
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Aja como o compilador do Arduino. Verifique se este código compilaria ou se tem erros óbvios: ${code}`,
    });

    return { 
      status: "Análise", 
      summary: response.text?.slice(0, 500) || "Análise concluída."
    };
  } catch (error: any) {
    console.error("Analysis Error:", error);
    return { 
      status: "Offline", 
      summary: error.message === "API_KEY_MISSING" ? "Chave de API ausente." : "Erro na análise remota." 
    };
  }
};
