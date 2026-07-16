"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingConfig = void 0;
const client_1 = require("@prisma/client");
class PricingConfig {
    static pricingRates = {
        [client_1.AiProvider.GROQ]: {
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
        [client_1.AiProvider.OPENAI]: {
            'default': {
                promptTokenCostPer1k: 0.005,
                completionTokenCostPer1k: 0.015,
            }
        },
        [client_1.AiProvider.ANTHROPIC]: {
            'default': {
                promptTokenCostPer1k: 0.003,
                completionTokenCostPer1k: 0.015,
            }
        },
        [client_1.AiProvider.GEMINI]: {
            'default': {
                promptTokenCostPer1k: 0.000125,
                completionTokenCostPer1k: 0.000375,
            }
        },
        [client_1.AiProvider.CUSTOM]: {
            'default': {
                promptTokenCostPer1k: 0,
                completionTokenCostPer1k: 0,
            }
        }
    };
    static calculateCost(provider, model, promptTokens, completionTokens) {
        const providerPricing = this.pricingRates[provider] || this.pricingRates[client_1.AiProvider.CUSTOM];
        let rate = providerPricing[model];
        if (!rate) {
            rate = providerPricing['default'] || { promptTokenCostPer1k: 0, completionTokenCostPer1k: 0 };
        }
        const promptCost = (promptTokens / 1000) * rate.promptTokenCostPer1k;
        const completionCost = (completionTokens / 1000) * rate.completionTokenCostPer1k;
        return promptCost + completionCost;
    }
}
exports.PricingConfig = PricingConfig;
