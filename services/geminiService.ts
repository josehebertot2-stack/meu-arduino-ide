
/**
 * ArduProgram IDE - AI Service (Powered by Puter.js)
 */

declare const puter: any;

export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  try {
    if (typeof puter === 'undefined') return "Puter.js não carregado.";

    const systemInstruction = `Você é o ArduBot, o assistente oficial da IDE ArduProgram. 
      AJUDE O USUÁRIO COM O DESENVOLVIMENTO DE FIRMWARE ARDUINO.
      REGRAS:
      1. Responda em Português (Brasil).
      2. Se sugerir alterações, forneça o bloco de código completo em C++.
      3. Seja breve e técnico.`;

    const fullPrompt = `${systemInstruction}\n\nCÓDIGO ATUAL:\n${currentCode}\n\nPERGUNTA:\n${prompt}`;
    
    const response = await puter.ai.chat(fullPrompt);
    return typeof response === 'string' ? response : (response?.text || JSON.stringify(response));
  } catch (error: any) {
    console.error("Puter AI Error:", error);
    return `❌ Erro na IA do Puter: ${error.message || "Falha na conexão."}`;
  }
};

export const analyzeCode = async (code: string) => {
  try {
    if (typeof puter === 'undefined') return { status: "Erro", summary: "Puter offline" };

    const response = await puter.ai.chat(`Aja como o compilador do Arduino. Verifique se este código tem erros óbvios de sintaxe. Responda de forma extremamente curta: ${code}`);
    const summary = typeof response === 'string' ? response : (response?.text || "Análise concluída.");

    return { 
      status: "Análise Puter", 
      summary: summary.slice(0, 500)
    };
  } catch (error: any) {
    console.error("Analysis Error:", error);
    return { 
      status: "Offline", 
      summary: "Erro na análise remota do Puter." 
    };
  }
};
