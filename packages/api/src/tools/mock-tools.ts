import { tool } from "ai";
import { z } from "zod";

/**
 * Quick tool — returns immediately
 */
export const get_weather = tool({
  description: "Get current weather for a given city. Returns mock data.",
  inputSchema: z.object({
    city: z.string().describe("The city name to get weather for"),
  }),
  execute: async ({ city }) => {
    const conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Snowy"];
    const condition = conditions[Math.floor(Math.random() * conditions.length)]!;
    const temp = Math.floor(Math.random() * 35) + 5;
    return {
      city,
      temperature: `${temp}°C`,
      condition,
      humidity: `${Math.floor(Math.random() * 60) + 30}%`,
      wind: `${Math.floor(Math.random() * 30) + 5} km/h`,
    };
  },
});

/**
 * Slow tool — simulates a deep research task that takes 5-12 seconds
 */
export const deep_research = tool({
  description:
    "Perform deep research on a topic. This takes some time as it searches multiple sources, compiles findings, and synthesizes a report.",
  inputSchema: z.object({
    topic: z.string().describe("The topic to research"),
    depth: z
      .enum(["brief", "standard", "thorough"])
      .default("standard")
      .describe("How deep to research"),
  }),
  execute: async ({ topic, depth }) => {
    const delayMs =
      depth === "brief" ? 5000 : depth === "standard" ? 8000 : 12000;

    // Simulate research taking time
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    const sources = [
      "Academic Papers Database",
      "News Archives",
      "Technical Documentation",
      "Expert Forums",
      "Government Reports",
    ];

    const selectedSources = sources.slice(
      0,
      depth === "brief" ? 2 : depth === "standard" ? 3 : 5
    );

    return {
      topic,
      depth,
      timeSpent: `${(delayMs / 1000).toFixed(0)}s`,
      sourcesConsulted: selectedSources,
      findings: [
        `Key finding 1: ${topic} has seen significant developments in recent years.`,
        `Key finding 2: Experts suggest ${topic} will continue evolving rapidly.`,
        `Key finding 3: There are both opportunities and challenges in ${topic}.`,
      ],
      summary: `Research on "${topic}" completed at ${depth} depth. Consulted ${selectedSources.length} sources. The topic shows significant activity and ongoing developments across multiple domains.`,
      confidence: depth === "thorough" ? "high" : depth === "standard" ? "medium" : "low",
    };
  },
});

/**
 * Medium speed tool — calculator with a slight delay
 */
export const calculate = tool({
  description: "Evaluate a mathematical expression. Supports basic arithmetic.",
  inputSchema: z.object({
    expression: z.string().describe("The math expression to evaluate, e.g. '2 + 3 * 4'"),
  }),
  execute: async ({ expression }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      const result = new Function(`return (${sanitized})`)();
      return {
        expression,
        result: String(result),
        type: typeof result,
      };
    } catch {
      return {
        expression,
        error: "Could not evaluate expression",
        result: null,
      };
    }
  },
});
