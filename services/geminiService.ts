
import { GoogleGenAI } from "@google/genai";

/**
 * ArduProgram IDE - AI Service (Powered by Google Gemini)
 */

// Initialize the Google GenAI client using the API_KEY from environment variables.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getCodeAssistance = async (prompt: string, currentCode: string, boardInfo: string, consoleLogs?: string) => {
  try {
    // For coding assistance and reasoning, use the gemini-3-pro-preview model.
    const systemInstruction = `Você é o ArduBot, um Engenheiro de Sistemas Embarcados sênior.
      CONTEXTO TÉCNICO:
      - Placa selecionada: ${boardInfo}
      - Logs do Console: ${consoleLogs || 'Nenhum erro detectado'}
      
      REGRAS DE RESPOSTA:
      1. Use Português do Brasil.
      2. Se houver código, use blocos markdown com \`\`\`cpp.
      3. Explique POR QUE a solução funciona.
      4. Priorize código otimizado e legível.
      5. Se houver erro no console, foque em resolvê-lo primeiro.`;

    const fullPrompt = `CÓDIGO ATUAL:\n${currentCode}\n\nPERGUNTA DO USUÁRIO:\n${prompt}`;
    
    // Call generateContent with system instruction in config as per guidelines.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: fullPrompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    // Access text property directly.
    return response.text || "Desculpe, não consegui processar sua solicitação.";
  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    return `❌ Erro na IA: ${error.message || "Falha na conexão."}`;
  }
};

export const analyzeCode = async (code: string) => {
  try {
    // For quick syntax and logic analysis, use the gemini-3-flash-preview model.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Valide este código Arduino. Se houver erros de sintaxe ou lógica, aponte-os brevemente. Se estiver OK, diga "Código Validado". Código: ${code}`,
    });
    
    const summary = response.text || "Análise concluída.";

    return { 
      status: "Diagnóstico", 
      summary: summary.slice(0, 800)
    };
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    return { status: "Offline", summary: "Erro na análise remota." };
  }
};

/**
 * Simula logs de compilação reais do arduino-cli/avrdude
 */
export const simulateCompilationLogs = async (board: string, fileName: string) => {
    const logs = [
        `Compiling sketch...`,
        `Using board '${board}' from platform in folder: /home/user/.arduino15/packages/arduino/hardware/avr/1.8.6`,
        `Detecting libraries used...`,
        `Compiling core...`,
        `Linking everything together...`,
        `Sketch uses 444 bytes (1%) of program storage space. Maximum is 32256 bytes.`,
        `Global variables use 9 bytes (0%) of dynamic memory, leaving 2039 bytes for local variables. Maximum is 2048 bytes.`
    ];
    return logs;
};
