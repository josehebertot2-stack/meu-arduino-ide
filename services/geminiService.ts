
import { GoogleGenAI } from "@google/genai";

/**
 * Serviço ultra-simplificado para o ArduProgram.
 * O sistema assume que a chave está presente no ambiente (process.env.API_KEY).
 */
export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Código Arduino:\n${currentCode}\n\nDúvida: ${prompt}`,
      config: {
        systemInstruction: "Você é um especialista em Arduino. Responda de forma curta, direta e em português. Use blocos de código 'cpp' quando necessário.",
        temperature: 0.5,
      },
    });

    return response.text || "Sem resposta da IA.";
  } catch (error) {
    console.error("AI Error:", error);
    return "A IA está temporariamente indisponível (verifique a conexão ou os limites da API).";
  }
};

/**
 * Análise rápida de código.
 */
export const analyzeCode = async (code: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analise erros neste código Arduino e responda brevemente: ${code}`,
    });
    return { status: "Ok", summary: response.text };
  } catch (error) {
    return { status: "Erro", summary: "Não foi possível analisar no momento." };
  }
};
