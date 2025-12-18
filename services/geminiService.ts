
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Service to interact with the Google Gemini API for Arduino-specific tasks.
 */
export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    // Fix: Use process.env.API_KEY directly in the named parameter object
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      // Fix: Use gemini-3-flash-preview for general coding assistance tasks
      model: 'gemini-3-flash-preview',
      contents: `Contexto do código Arduino atual:\n\`\`\`cpp\n${currentCode}\n\`\`\`\n\nPergunta ou solicitação do usuário: ${prompt}`,
      config: {
        systemInstruction: `Você é o Assistente Sênior Especialista em Arduino. 
        Sua missão é ajudar desenvolvedores a criar sketches profissionais, seguros e eficientes.
        
        Diretrizes:
        1. Responda sempre em Português Brasileiro (PT-BR).
        2. Forneça explicações técnicas claras e concisas.
        3. Sempre formate blocos de código usando crases triplas com a linguagem 'cpp'.
        4. Priorize o uso de millis() para multitarefa e evite delay() bloqueante.
        5. Sugira boas práticas de organização de hardware e pinagem.`,
        temperature: 0.7,
      },
    });

    return response.text || "A IA não retornou uma resposta válida.";
  } catch (error: any) {
    console.error("Gemini API Error (Assistance):", error);
    if (error.status === 404 || error.message?.toLowerCase().includes("not found")) {
      return "Erro 404: Modelo não disponível ou sem permissão. Verifique sua Chave de API.";
    }
    return `Ocorreu um erro ao consultar a IA: ${error.message || "Erro desconhecido"}`;
  }
};

/**
 * Performs a deep static analysis of the Arduino code using Gemini.
 */
export const analyzeCode = async (code: string) => {
  try {
    // Fix: Use process.env.API_KEY directly
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      // Fix: Use gemini-3-pro-preview for complex reasoning and deep code analysis
      model: 'gemini-3-pro-preview',
      contents: `Analise este sketch Arduino em busca de erros de sintaxe, lógica e melhorias de performance:\n\`\`\`cpp\n${code}\n\`\`\``,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { 
              type: Type.STRING, 
              description: "Status geral da análise." 
            },
            summary: { 
              type: Type.STRING, 
              description: "Resumo em uma frase." 
            },
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
        systemInstruction: "Você é um especialista em sistemas embarcados. Analise o código rigorosamente e retorne apenas o JSON estruturado.",
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    console.error("Gemini API Error (Analysis):", error);
    return { 
      status: "Erro", 
      summary: "Falha na análise de código.", 
      issues: [{ 
        severity: "critical", 
        message: "Verifique sua chave de API nas configurações." 
      }] 
    };
  }
};
