
/**
 * ArduProgram IDE - AI Service (Powered by Puter.js)
 */

declare const puter: any;

export const getCodeAssistance = async (prompt: string, currentCode: string, boardInfo: string, consoleLogs?: string) => {
  try {
    if (typeof puter === 'undefined') return "Puter.js não carregado.";

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

    const fullPrompt = `${systemInstruction}\n\nCÓDIGO ATUAL:\n${currentCode}\n\nPERGUNTA DO USUÁRIO:\n${prompt}`;
    
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

    const response = await puter.ai.chat(`Valide este código Arduino. Se houver erros de sintaxe ou lógica, aponte-os brevemente. Se estiver OK, diga "Código Validado". Código: ${code}`);
    const summary = typeof response === 'string' ? response : (response?.text || "Análise concluída.");

    return { 
      status: "Diagnóstico", 
      summary: summary.slice(0, 800)
    };
  } catch (error: any) {
    return { status: "Offline", summary: "Erro na análise remota." };
  }
};
