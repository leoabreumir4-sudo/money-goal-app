// Test conversation flow detection

const CONVERSATION_FLOWS = {
  create_goal: {
    name: "Create Savings Goal",
    steps: [
      { step: 1, question: "What would you like to save for?" },
      { step: 2, question: "How much money do you need to save?" },
      { step: 3, question: "When do you want to achieve this goal?" },
    ],
  },
  budget_review: {
    name: "Monthly Budget Review",
    steps: [
      { step: 1, question: "What's your biggest concern right now?" },
      {
        step: 2,
        question: "Which expense category would you like to focus on?",
      },
      {
        step: 3,
        question: "What's a realistic monthly budget for this category?",
      },
    ],
  },
  savings_plan: {
    name: "Personalized Savings Plan",
    steps: [
      { step: 1, question: "What's your main motivation for saving?" },
      { step: 2, question: "How much can you save each month?" },
      { step: 3, question: "Are you willing to cut any specific expenses?" },
    ],
  },
};

function detectFlowIntent(message) {
  const lowerMessage = message.toLowerCase();

  if (
    /(criar|create|start|começar|empezar).*(meta|goal|objetivo)/i.test(
      message
    ) ||
    /(quero|want|need|preciso|necesito).*(economizar|save|poupar|ahorrar)/i.test(
      message
    )
  ) {
    return "create_goal";
  }

  if (
    /(revisar|review|analisar|analyze|analizar).*(orçamento|budget|gastos|expenses|despesas)/i.test(
      message
    ) ||
    /onde (estou|tô|to) gastando/i.test(message) ||
    /where (am i|i'm) spending/i.test(message)
  ) {
    return "budget_review";
  }

  if (
    /(plano|plan).*(poupança|savings|ahorro)/i.test(message) ||
    /(como|how).*(economizar mais|save more|poupar mais|ahorrar más)/i.test(
      message
    )
  ) {
    return "savings_plan";
  }

  return null;
}

function getNextFlowStep(flowType, currentStep) {
  const flow = CONVERSATION_FLOWS[flowType];
  const nextStep = (currentStep || 0) + 1;

  const stepData = flow.steps.find(s => s.step === nextStep);
  return stepData || null;
}

// Test flow detection
const testMessages = [
  { msg: "I want to create a savings goal", expected: "create_goal" },
  { msg: "Quero criar uma meta de poupança", expected: "create_goal" },
  { msg: "Review my budget", expected: "budget_review" },
  { msg: "Onde estou gastando mais?", expected: "budget_review" },
  { msg: "Create a savings plan", expected: "savings_plan" },
  { msg: "Como economizar mais dinheiro?", expected: "savings_plan" },
  { msg: "What's my balance?", expected: null },
];

console.log("Conversation Flow Detection Tests:\n");
testMessages.forEach(test => {
  const detected = detectFlowIntent(test.msg);
  const passed = detected === test.expected;
  console.log(
    `${passed ? "✅" : "❌"} "${test.msg}" → ${detected} (expected: ${test.expected})`
  );
});

// Test flow progression
console.log("\n\nFlow Progression Tests:\n");
const flows = ["create_goal", "budget_review", "savings_plan"];

flows.forEach(flowType => {
  const flow = CONVERSATION_FLOWS[flowType];
  console.log(`\n📋 ${flow.name}:`);

  for (let step = 0; step < flow.steps.length + 1; step++) {
    const nextStep = getNextFlowStep(flowType, step);
    if (nextStep) {
      console.log(
        `  Step ${step} → Step ${nextStep.step}: "${nextStep.question}"`
      );
    } else {
      console.log(`  Step ${step} → ✅ Flow Complete`);
    }
  }
});
