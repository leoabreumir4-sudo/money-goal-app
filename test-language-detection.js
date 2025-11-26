// Quick test for language detection
function detectLanguage(message) {
  const portugueseKeywords =
    /\b(olá|oi|obrigad[oa]|como|está|você|voce|porque|por que|quero|posso|preciso|fazer|tenho|meu|minha|sim|não|nao)\b/i;
  const spanishKeywords =
    /\b(hola|gracias|cómo|como|está|usted|porque|por qué|quiero|puedo|necesito|hacer|tengo|mi|sí|no)\b/i;

  const hasPortugueseChars = /[ãçõê]/i.test(message);
  const hasSpanishChars = /[ñ¿¡]/i.test(message);

  if (portugueseKeywords.test(message) || hasPortugueseChars) {
    return "pt";
  }

  if (spanishKeywords.test(message) || hasSpanishChars) {
    return "es";
  }

  return "en";
}

// Test cases
const testMessages = [
  { msg: "How can I save more money?", expected: "en" },
  { msg: "Como posso economizar mais?", expected: "pt" },
  { msg: "¿Cómo puedo ahorrar más dinero?", expected: "es" },
  { msg: "Quero criar uma meta de poupança", expected: "pt" },
  { msg: "Quiero crear una meta de ahorro", expected: "es" },
  { msg: "What's my spending pattern?", expected: "en" },
  { msg: "Qual é meu padrão de gastos?", expected: "pt" },
  { msg: "Obrigado pela ajuda!", expected: "pt" },
  { msg: "Gracias por tu ayuda", expected: "es" },
  { msg: "Thank you for the help", expected: "en" },
];

console.log("Language Detection Tests:\n");
testMessages.forEach(test => {
  const detected = detectLanguage(test.msg);
  const passed = detected === test.expected;
  console.log(
    `${passed ? "✅" : "❌"} "${test.msg}" → ${detected} (expected: ${test.expected})`
  );
});
