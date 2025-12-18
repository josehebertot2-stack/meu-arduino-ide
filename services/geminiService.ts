
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Service to interact with the Google Gemini API for Arduino-specific tasks.
 */
export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Contexto do código Arduino atual:\n\`\`\`cpp\n${currentCode}\n\`\`\`\n\nPergunta do usuário: ${prompt}`,
      config: {
        systemInstruction: `Você é o "Arduino Gemini Master", um assistente especialista em hardware, C++ para microcontroladores e eletrônica.
        
        Suas funções:
        1. Gerar sketches Arduino eficientes e bem comentados.
        2. Explicar conceitos de eletrônica (pull-ups, PWM, I2C, etc).
        3. Ajudar a depurar erros de compilação ou lógica.
        
        Diretrizes de Resposta:
        - Responda SEMPRE em Português Brasileiro.
        - Se o usuário pedir um código, use blocos de código markdown com a tag 'cpp'.
        - Seja direto e técnico, mas didático.
        - Sugira o uso de bibliotecas padrão quando apropriado.`,
        temperature: 0.7,
      },
    });

    return response.text || "Desculpe, não consegui processar sua solicitação no momento.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes("API key")) {
      return "Erro: Chave de API não configurada corretamente no ambiente.";
    }
    return `Erro ao consultar a IA: ${error.message || "Erro desconhecido"}`;
  }
};

/**
 * Static code analysis using Gemini Pro for deep reasoning.
 */
export const analyzeCode = async (code: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Analise este código Arduino em busca de erros: \n\`\`\`cpp\n${code}\n\`\`\``,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING, description: "'Ok', 'Alerta' ou 'Erro'" },
            summary: { type: Type.STRING, description: "Resumo rápido da análise" },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { type: Type.STRING },
                  message: { type: Type.STRING },
                  line: { type: Type.NUMBER }
                },
                required: ["severity", "message"]
              }
            }
          },
          required: ["status", "summary", "issues"],
        },
        systemInstruction: "Você é um compilador humano de Arduino. Analise o código estaticamente e identifique bugs, vazamentos de memória ou má práticas. Retorne apenas JSON.",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    return { 
      status: "Erro", 
      summary: "Falha técnica na análise via IA.", 
      issues: [{ severity: "critical", message: "Conexão com Gemini falhou ou API Key ausente." }] 
    };
  }
};
