
import { GoogleGenAI } from "@google/genai";

/**
 * ArduProgram IDE - AI Service
 * Especializado em desenvolvimento de firmware Arduino.
 */

const getAIClient = () => {
  // Always use process.env.API_KEY directly as per guidelines.
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// Use gemini-3-pro-preview for complex coding tasks.
export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    const ai = getAIClient();
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `CÓDIGO ATUAL:
          \`\`\`cpp
          ${currentCode}
          \`\`\`
          
          PERGUNTA DO USUÁRIO: ${prompt}`,
      config: {
        // Use systemInstruction as recommended.
        systemInstruction: `Você é o ArduBot, o assistente oficial da IDE ArduProgram. 
          AJUDE O USUÁRIO COM O DESENVOLVIMENTO DE FIRMWARE ARDUINO.
          REGRAS:
          1. Responda em Português (Brasil).
          2. Se sugerir alterações, forneça o bloco de código completo em C++.
          3. Seja breve e técnico.`,
        temperature: 0.7,
        topP: 0.9,
      },
    });

    // response.text is a property, not a method.
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
      contents: `Verifique se este código compilaria ou se tem erros óbvios: ${code}`,
      config: {
        systemInstruction: "Aja como o compilador do Arduino.",
      }
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
