
import { GoogleGenAI } from "@google/genai";

/**
 * ArduProgram IDE - AI Service
 * Especializado em desenvolvimento de firmware Arduino.
 */

// Use direct initialization from process.env.API_KEY as per @google/genai guidelines
export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Simplifed content structure as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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

    // Use .text property directly (it's a getter, not a method)
    return response.text || "Sem resposta da IA.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return `❌ Erro na conexão: ${error.message || "Verifique sua conexão."}`;
  }
};

export const analyzeCode = async (code: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Aja como o compilador do Arduino. Verifique se este código compilaria ou se tem erros óbvios: ${code}`,
    });

    // Use .text property directly
    return { 
      status: "Análise", 
      summary: response.text?.slice(0, 500) || "Análise concluída."
    };
  } catch (error) {
    console.error("Analysis Error:", error);
    return { status: "Offline", summary: "Não foi possível verificar o código remotamente." };
  }
};
