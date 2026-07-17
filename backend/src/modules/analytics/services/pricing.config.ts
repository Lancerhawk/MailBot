import { AiProvider } from '@prisma/client';

export interface PricingTier {
  promptTokenCostPer1k: number;
  completionTokenCostPer1k: number;
}

export class PricingConfig {
  private static pricingRates: Record<AiProvider, Record<string, PricingTier>> = {
    [AiProvider.GROQ]: {
      'llama3-8b-8192': {
        promptTokenCostPer1k: 0.00005,
        completionTokenCostPer1k: 0.00008,
      },
      'llama3-70b-8192': {
        promptTokenCostPer1k: 0.00059,
        completionTokenCostPer1k: 0.00079,
      },
      'mixtral-8x7b-32768': {
        promptTokenCostPer1k: 0.00024,
        completionTokenCostPer1k: 0.00024,
      },
      'default': {
        promptTokenCostPer1k: 0.0005,
        completionTokenCostPer1k: 0.0005,
      }
    },
    [AiProvider.OPENAI]: {
      'default': {
        promptTokenCostPer1k: 0.005,
        completionTokenCostPer1k: 0.015,
      }
    },
    [AiProvider.ANTHROPIC]: {
      'default': {
        promptTokenCostPer1k: 0.003,
        completionTokenCostPer1k: 0.015,
      }
    },

    [AiProvider.CUSTOM]: {
      'default': {
        promptTokenCostPer1k: 0,
        completionTokenCostPer1k: 0,
      }
    }
  };

  public static calculateCost(provider: AiProvider, model: string, promptTokens: number, completionTokens: number): number {
    const providerPricing = this.pricingRates[provider] || this.pricingRates[AiProvider.CUSTOM];

    let rate = providerPricing[model];
    if (!rate) {
      rate = providerPricing['default'] || { promptTokenCostPer1k: 0, completionTokenCostPer1k: 0 };
    }

    const promptCost = (promptTokens / 1000) * rate.promptTokenCostPer1k;
    const completionCost = (completionTokens / 1000) * rate.completionTokenCostPer1k;

    return promptCost + completionCost;
  }
}
