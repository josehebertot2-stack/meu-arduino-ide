
import { GoogleGenAI, Type } from "@google/genai";

/**
 * Service to interact with the Google Gemini API for Arduino-specific tasks.
 */
export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    // We create a new instance each time to ensure we pick up the latest API key from the environment/dialog
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest', // Most robust and widely available model
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
    if (error.message?.includes("not found") || error.status === 404) {
      return "Erro 404: Modelo não encontrado ou sem permissão. Verifique se sua chave de API está correta e se o faturamento está ativo no Google AI Studio.";
    }
    return `Ocorreu um erro: ${error.message || "Verifique sua conexão e chave de API."}`;
  }
};

/**
 * Performs a deep static analysis of the Arduino code using Gemini.
 */
export const analyzeCode = async (code: string) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `Analise este sketch Arduino em busca de erros de sintaxe, lógica e melhorias de performance:\n\`\`\`cpp\n${code}\n\`\`\``,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { 
              type: Type.STRING, 
              description: "Status geral da análise (ex: 'Alerta', 'Ok', 'Crítico')." 
            },
            summary: { 
              type: Type.STRING, 
              description: "Resumo em uma frase do que foi encontrado." 
            },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  severity: { 
                    type: Type.STRING, 
                    description: "Nível do problema: 'critical', 'warning' ou 'suggestion'." 
                  },
                  message: { 
                    type: Type.STRING, 
                    description: "Descrição detalhada do problema em PT-BR." 
                  },
                  line: { 
                    type: Type.NUMBER, 
                    description: "Número da linha aproximada onde o problema ocorre." 
                  }
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
      summary: error.message?.includes("not found") ? "Modelo não encontrado (404)." : "A análise falhou.", 
      issues: [{ 
        severity: "critical", 
        message: "Erro na análise de código. Verifique sua configuração de API nas preferências." 
      }] 
    };
  }
};
