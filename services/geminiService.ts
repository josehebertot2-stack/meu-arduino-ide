/**
 * ArduProgram IDE - Local Analysis Mode
 * Inteligência Artificial removida completamente.
 */

export const getCodeAssistance = async (prompt: string, currentCode: string) => {
  return "Assistente offline. A funcionalidade de IA foi removida.";
};

export const analyzeCode = async (code: string) => {
  // Simulação de análise sintática puramente local
  const hasSetup = code.includes("void setup()");
  const hasLoop = code.includes("void loop()");

  if (!hasSetup || !hasLoop) {
    return { 
      status: "Aviso", 
      summary: "Estrutura básica ausente (setup/loop). Certifique-se de que o código segue o padrão Arduino." 
    };
  }

  return { 
    status: "Ok", 
    summary: "Análise local básica: Estrutura OK." 
  };
};